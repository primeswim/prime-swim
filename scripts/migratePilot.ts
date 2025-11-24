// scripts/migratePilot.ts
// 自包含、幂等、安全（支持 dry-run）的历史数据迁移/回填脚本
// 回填字段：registrationAnchorDate / currentPeriodStart / currentPeriodEnd / nextDueDate
//          renewalWindowDays(30) / graceDays(30) /
//          pilot(true 默认) / isPaid(依据历史推断) / updatedAt(serverTimestamp)

import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore"

// ---- ENV & Admin 初始化 ----
const projectId = process.env.FIREBASE_PROJECT_ID!
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Missing FIREBASE_* envs. Check .env.local")
  process.exit(1)
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId })
}
const db = getFirestore()

// ---- CLI 参数处理（兼容 --k=v 与 --k v 两种写法） ----
type CliFlags = {
  ids?: string[]
  parentUid?: string
  all?: boolean
  dryRun?: boolean
  rebuildCoverage?: boolean
  freezeIds?: string[]
  unfreezeIds?: string[]
}

function getArgValue(args: string[], key: string): string | undefined {
  // 支持 --key=value
  const eq = args.find(a => a.startsWith(`${key}=`))
  if (eq) return eq.split("=")[1]
  // 支持 --key value
  const idx = args.findIndex(a => a === key)
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1]
  return undefined
}

function parseArgs(): CliFlags {
  // 兼容 npx ts-node ... -- <args> 的情况：取 -- 之后的参数；否则取全部
  const full = process.argv.slice(2)
  const sepIdx = full.indexOf("--")
  const args = sepIdx >= 0 ? full.slice(sepIdx + 1) : full

  const idsStr = getArgValue(args, "--ids")
  const parentUid = getArgValue(args, "--parent-uid")
  const freezeIdsStr = getArgValue(args, "--freeze-ids")
  const unfreezeIdsStr = getArgValue(args, "--unfreeze-ids")

  const flags: CliFlags = {
    ids: idsStr ? idsStr.split(",").map(s => s.trim()).filter(Boolean) : undefined,
    parentUid: parentUid?.trim(),
    all: args.includes("--all"),
    dryRun: args.includes("--dry-run"),
    rebuildCoverage: args.includes("--rebuild-coverage"),
    freezeIds: freezeIdsStr ? freezeIdsStr.split(",").map(s => s.trim()).filter(Boolean) : undefined,
    unfreezeIds: unfreezeIdsStr ? unfreezeIdsStr.split(",").map(s => s.trim()).filter(Boolean) : undefined,
  }

  if (
    !flags.all &&
    !flags.ids?.length &&
    !flags.parentUid &&
    !flags.freezeIds?.length &&
    !flags.unfreezeIds?.length
  ) {
    console.log(`Usage:
  ts-node scripts/migratePilot.ts [--all] [--ids id1,id2] [--parent-uid UID] \\
    [--freeze-ids id1,id2] [--unfreeze-ids id1,id2] [--rebuild-coverage] [--dry-run]

Examples:
  # Dry-run 指定两个 swimmer
  npx ts-node scripts/migratePilot.ts -- --ids=ID1,ID2 --dry-run

  # 真写入指定两个 swimmer
  npx ts-node scripts/migratePilot.ts -- --ids=ID1,ID2

  # 全量 + 缺失时重建覆盖期
  npx ts-node scripts/migratePilot.ts -- --all --rebuild-coverage

  # 冻结 / 解冻
  npx ts-node scripts/migratePilot.ts -- --freeze-ids=ID1,ID2
  npx ts-node scripts/migratePilot.ts -- --unfreeze-ids=ID1
`)
    process.exit(0)
  }

  return flags
}

const flags = parseArgs()

// ---- 日期工具 ----
const toMidnight = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const addYearsMinusOneDay = (start: Date, years = 1) => {
  const end = new Date(start)
  end.setFullYear(end.getFullYear() + years)
  end.setDate(end.getDate() - 1)
  return end
}
const nextDueFromAnchor = (anchor: Date) =>
  toMidnight(new Date(anchor.getFullYear() + 1, anchor.getMonth(), anchor.getDate()))

// ---- 推断是否“历史已付费”（仅在 isPaid 缺失时才会用到） ----
function inferPaid(data: any): boolean {
  if (typeof data?.isPaid === "boolean") return data.isPaid
  if (data?.paymentStatus === "paid") return true
  if (data?.registrationAnchorDate || data?.currentPeriodStart || data?.nextDueDate) return true
  // payments 子集合存在 status='paid'
  return !!data?.__hasPaidPayment // 由预查询注入
}

// ---- 计算覆盖期（仅在缺失或显式 --rebuild-coverage 时使用） ----
function buildCoverageFromAnchor(anchor: Date) {
  const start = toMidnight(anchor)
  const end = addYearsMinusOneDay(start, 1)
  const due = nextDueFromAnchor(start)
  return {
    registrationAnchorDate: Timestamp.fromDate(start),
    currentPeriodStart: Timestamp.fromDate(start),
    currentPeriodEnd: Timestamp.fromDate(end),
    nextDueDate: Timestamp.fromDate(due),
  }
}

// ---- 选取用于锚定的日期（优先级从高到低） ----
function pickAnchorDate(data: any): Date {
  const paidAt: Date | undefined =
    data?.paidAt?.toDate?.() ||
    data?.currentPeriodStart?.toDate?.() ||
    data?.registrationAnchorDate?.toDate?.() ||
    data?.createdAt?.toDate?.()
  return toMidnight(paidAt || new Date())
}

// ---- 读取 swimmers 列表 ----
async function loadTargets(): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const swimmersRef = db.collection("swimmers")
  if (flags.ids?.length) {
    const docs = await Promise.all(
      flags.ids.map(async (id) => {
        const s = await swimmersRef.doc(id).get()
        return s.exists ? s : null
      })
    )
    const list = docs.filter(Boolean) as FirebaseFirestore.QueryDocumentSnapshot[]
    if (!list.length) console.log("⚠️ No swimmer found by those ids.")
    return list
  }
  if (flags.parentUid) {
    const qs = await swimmersRef.where("parentUID", "==", flags.parentUid).get()
    if (qs.empty) console.log("⚠️ No swimmer found for parentUID:", flags.parentUid)
    return qs.docs
  }
  if (flags.all) {
    const qs = await swimmersRef.get()
    return qs.docs
  }
  return []
}

// ---- 预查询 payments 子集合（仅取有没有 paid 记录的布尔值，避免大流量读） ----
async function hasPaidPayment(swimmerId: string): Promise<boolean> {
  const qs = await db
    .collection("payments")
    .where("swimmerId", "==", swimmerId)
    .where("status", "==", "paid")
    .limit(1)
    .get()
  return !qs.empty
}

// ---- 冻结/解冻（只改 isFrozen） ----
async function applyFreezeToggles() {
  const ops: Array<Promise<any>> = []
  if (flags.freezeIds?.length) {
    for (const id of flags.freezeIds) {
      const ref = db.collection("swimmers").doc(id)
      if (flags.dryRun) {
        console.log(`(dry-run) would freeze ${id}`)
      } else {
        ops.push(ref.set({ isFrozen: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true }))
      }
    }
  }
  if (flags.unfreezeIds?.length) {
    for (const id of flags.unfreezeIds) {
      const ref = db.collection("swimmers").doc(id)
      if (flags.dryRun) {
        console.log(`(dry-run) would unfreeze ${id}`)
      } else {
        ops.push(ref.set({ isFrozen: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true }))
      }
    }
  }
  await Promise.all(ops)
}

// ---- 迁移单个 swimmer ----
async function migrateOne(docSnap: FirebaseFirestore.QueryDocumentSnapshot) {
  const id = docSnap.id
  const data = docSnap.data() || {}

  // 注入“是否有已支付记录”
  const hasPaid = await hasPaidPayment(id)
  const enriched = { ...data, __hasPaidPayment: hasPaid }

  // 1) 计算 isPaid（仅在 undefined 时填充）
  const shouldSetIsPaid = typeof data.isPaid !== "boolean"
  const inferredPaid = inferPaid(enriched)

  // 2) 决定是否需要补覆盖期（仅当缺失字段 或 指定 --rebuild-coverage）
  const needCoverage =
    flags.rebuildCoverage ||
    !data.registrationAnchorDate ||
    !data.currentPeriodStart ||
    !data.currentPeriodEnd ||
    !data.nextDueDate

  const anchor = pickAnchorDate(data)
  const coveragePatch = needCoverage ? buildCoverageFromAnchor(anchor) : {}

  // 3) 其它默认值（不覆盖已有）
  const currency = data.currency || "USD"
  const renewalWindowDays = typeof data.renewalWindowDays === "number" ? data.renewalWindowDays : 30
  const graceDays = typeof data.graceDays === "number" ? data.graceDays : 30
  const pilot = typeof data.pilot === "boolean" ? data.pilot : true

  // 4) 组合 patch（只合并需要写入的键；renewalWindowDays/graceDays/pilot 若缺失则写默认）
  const patch: Record<string, any> = {
    ...(coveragePatch as any),
    ...(data.currency === undefined ? { currency } : {}),
    ...(data.renewalWindowDays === undefined ? { renewalWindowDays } : {}),
    ...(data.graceDays === undefined ? { graceDays } : {}),
    ...(data.pilot === undefined ? { pilot } : {}),
    ...(shouldSetIsPaid ? { isPaid: inferredPaid } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  }

  // 如果 patch 除了 updatedAt 外没任何变更，就跳过
  const keys = Object.keys(patch).filter(k => k !== "updatedAt")
  if (keys.length === 0) {
    console.log(
      `= ${id} (no changes)  |  hasPaid:${hasPaid}  isPaid:${data.isPaid}  coverage:`,
      !!data.registrationAnchorDate, !!data.currentPeriodStart, !!data.currentPeriodEnd, !!data.nextDueDate
    )
    return
  }

  if (flags.dryRun) {
    // 友好打印 Timestamp
    const printable = { ...patch }
    for (const k of ["registrationAnchorDate","currentPeriodStart","currentPeriodEnd","nextDueDate"]) {
      if (printable[k]?.toDate) printable[k] = printable[k].toDate().toISOString()
    }
    console.log(`(dry-run) PATCH ${id}:`, JSON.stringify(printable, null, 2))
  } else {
    await db.collection("swimmers").doc(id).set(patch, { merge: true })
    console.log(`✅ patched ${id}`)
  }

  // 额外打印可读信息（仅提示，不写库）
  if (coveragePatch && Object.keys(coveragePatch).length) {
    const a = (coveragePatch as any).registrationAnchorDate.toDate() as Date
    const s = (coveragePatch as any).currentPeriodStart.toDate() as Date
    const e = (coveragePatch as any).currentPeriodEnd.toDate() as Date
    const n = (coveragePatch as any).nextDueDate.toDate() as Date
    console.log(`   anchor: ${a.toISOString()}
   coverage: ${s.toDateString()} — ${e.toDateString()}
   nextDue:  ${n.toDateString()}`)
  } else {
    console.log(`   (coverage unchanged)`)
  }
  if (shouldSetIsPaid) {
    console.log(`   isPaid -> ${inferredPaid}  (paymentStatus:${data.paymentStatus} hasPaidPayment:${hasPaid})`)
  }
}

// ---- 主流程 ----
async function main() {
  // 先处理冻结/解冻（可独立运行）
  if (flags.freezeIds?.length || flags.unfreezeIds?.length) {
    await applyFreezeToggles()
  }

  const targets = await loadTargets()
  if (!targets.length) {
    console.log("No swimmers matched the filter. Done.")
    return
  }

  console.log(
    `Migrating ${targets.length} swimmers...  (dry-run=${!!flags.dryRun}, rebuildCoverage=${!!flags.rebuildCoverage})`
  )

  // 控制并发，避免一次性打爆
  const concurrency = 50
  for (let i = 0; i < targets.length; i += concurrency) {
    const chunk = targets.slice(i, i + concurrency)
    await Promise.all(chunk.map(migrateOne))
  }

  console.log("🎉 Migration completed.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
