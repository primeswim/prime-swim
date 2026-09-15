# Prime Swim Academy — Meet 模块终稿设计

独立比赛作业系统。不复用 makeup RSVP，不和公开 `/events` 日历双写。`/events` 继续只做官网展示。

参考：SportsEngine / TeamUnify 家长路径、PNS 公告与 Event File 流程。样例场次：`2026 PN TAC Fall Pentathlon and Distance Open`（Approval #2609-SP05）。

---

## 1. 目标与原则

Prime 替家庭向 Host 报名并代收代付 entry fees。家长不直接向 Host 报名。

1. 家长只有 **Attend / Decline**。未操作是系统状态 `no_response`，不是第三个按钮。
2. 家长勾的项目就是发给 Host 的名单，提交前没有教练批准。
3. **开放 Attend ≠ 发给 Host ≠ Publish confirmed。** Host 确认并改完砍项之前，家长只看到 Pending for review。
4. Invitational：`invitationStatus` 必须是 `invited` 才能 Publish。没邀请只内部审。
5. Prime Deadline、PNS Deadline、Announcement Deadline、Host 确认 Deadline 分开存。家长只盯 Prime Deadline。
6. 勾选与算费只信 **Event File（`.ev3` / `.hyv` / zip）**。公告 PDF 给家长看，并辅助抽取邀请、邮箱、叙事规则。
7. 没有 Event File 时：可以 Attend + 选天 + notes，**不能勾具体项目，不能出 SD3，不能定最终费用**。
8. 费用协议写「Prime 支持的付款方式」，不写死 Zelle。当前用 Zelle 人工核对。
9. 学费 invoice 和 meet invoice **分开付、分开记**。没有家庭 Total Due。Meet fee 是代收代付，不是 training income。
10. **家长 Dashboard 是独立一块，不是附带一句。** 每个孩子卡片上要有学费，以及（有 invoice 之后）该孩子的 meet 应付；卡片下方另有「付给 Prime 的比赛费」清单。学费和比赛费永远分开展示、分开付。
11. 默认：**正式 entries 提交给 Host 之后费用不可退**。
12. 自动化只做发现和建议。eligibility、invitation、deadline 冲突、PNS 更新，必须 Admin 确认后才改家长页。

明确不做（本模块第一期之后再说）：Stripe / ACH 自动扣款、results / best times、群发 reminder、OME 自动填报、完整 QT 引擎、会计科目落地。

---

## 2. 角色

### Parent

可以：在 Dashboard 看到每个孩子的学费、确认后的 meet invoice、以及要付给 Prime 的比赛费；Attend / Decline；勾项目和 notes；Prime Deadline 前改。Host 确认并被 Publish confirmed 之前，项目一律标 **Pending for review**。确认 Publish 之后才看到最终版。

不能：改别人的数据；Deadline 后自己改；提交 Host 后自己取消并要求退费；改单价；把学费和 meet fee 合成一笔付。

没有 USA Swimming ID 时不能 Attend，必须先走 Club OMR 注册 Premium / year-round，再回来填 ID。

### Coach（新角色，见第 16 节）

独立账号，**不是**往 `admin` / `admins` 里加一条。自己申请注册，Admin 审批通过后才能进 `/coach`。

第一期：看自己组 Attend / 已勾项目。**不在提交前批准家长勾选。** Host 回邮之后，可以给自己组的孩子**去掉被砍的项**。点 Publish confirmed 仍是 Admin。

不能进现有 `/admin/*`。发给 Host、invoice、PNS、OMR 仍只有 Admin。

### Admin

可以：审 PNS draft；改 Prime Deadline；联系 Host 要邀请和 Event File；设 `invitationStatus`；Approve / Publish；Check PNS 并 Accept 更新；上传 Event File；按家长已勾项目生成 SD3 + 两份 PDF；**预填并点发送**给 Host（收件人可改）；挂 Host 回执 / psych sheet；生成/确认 meet invoice；记录付给 Host 的总额；维护 OMR link；必要时手改某孩子已提交的项（Host 砍项后）。

---

## 3. 状态机

一条作业状态，不要两套并行：

```text
draft
→ admin_review
→ invitation_pending          // 仅 invitational
→ ready_to_publish            // 已批准，家长看不见
→ commitment_open             // 已开放给家长 Attend（第一次 Publish）
→ commitment_closed            // Prime Deadline，家长不能再改勾选
→ submitted                    // 已把家长勾选发给 Host；家长仍显示 Pending for review
→ host_reply_received          // 已记下 Host 回邮；Coach/Admin 按人去掉被砍的项
→ entries_confirmed            // 改完后点 Publish confirmed；家长才看到确认版
→ upcoming / in_progress / completed
→ cancelled
```

Invitational 未受邀停在 `invitation_pending`，**不能 Publish**。

Open / 对 PNS 开放的场：`invitationStatus = not_required`，跳过 `invitation_pending`。

发现用辅助字段，不另做一套状态：`sourceLastCheckedAt`、`pendingSourceReview`。

---

## 4. 从 PNS 到家长：整条作业

1. 系统每天扫 PNS Upcoming Calendar（也可手动 Check PNS for Updates）
        ↓
自动建 draft：名字、日期、地点、Host、PNS deadline、公告/附件链接
        ↓
Admin 打开审核
        ├─ 看见 invitational → 先联系 Host 要邀请 + Event File
        │                    → 只有 invited 才能往下
        └─ open meet → 不必先联系 Host
        ↓
改建议的 Prime Deadline（需要时）→ Approve → ready_to_publish
        ↓
Publish to all 在册参赛孩子（不群发邮件）
        ↓
家长 Attend / Decline + 能到的天 + notes
        │   没有 Event File：到此为止，不能勾项
        ↓
Event File 出现（PNS 附件 / Host 邮件 / Admin 上传）
        ↓
Admin 看解析核对表 → Accept update
        ↓
已 Attend 的家长回来勾要参加的项目（这就是提交内容）
        ↓
系统按勾选算费；Deadline 后 lock
        ↓
Admin Compose entry email（预填、收件人可改）→ 点 Send
        ↓
附件：SD3 + Entry Report PDF + Fee Report PDF（内容 = 家长已勾项目）
        ↓
家长仍显示 Pending for review（不要写成已确认）
        ↓
Host 回邮件（收下 / 砍项）→ Admin 点 Record host reply
        ↓
Coach 或 Admin 按每个运动员去掉被砍的项（可写 note）
        ↓
Admin 点 Publish confirmed entries
        ↓
家长 Dashboard 才出现确认版项目和最终应付

**Event File 到、Accept 之前，对 Host：**

- Invitational：只问「能不能参加、把 event file 发来」。不交正式报名。
- Open：对 Host 可以什么都不做。缺文件就 Check PNS 或问 `office@pns.org` / Meet Director。
- 没有 Event File、或还没有任何 Attend+项目时，不要发 SD3。

---

## 5. Deadline

全部带时间，默认时区 `America/Los_Angeles`。


| 字段                          | 含义                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnsPublishedDeadline`      | PNS 日历上的 Registration Deadline                                                                                   |
| `announcementEntryDeadline` | 公告里的正式 Entry Deadline                                                                                            |
| `hostConfirmedDeadline`     | Host 书面/邮件确认的日期（有才填）                                                                                             |
| `effectiveHostDeadline`     | 优先级：Host 确认 > 公告 > PNS                                                                                           |
| `primeCommitmentDeadline`   | 家长队内截止。建议：`effectiveHostDeadline - 7 calendar days` 当天 11:59 PM PT。Championship / travel 可预填 −10 / −14。Admin 可改。 |
| `targetSubmissionDate`      | 计划提交日，建议 Host − 2～3 个工作日                                                                                         |
| `entriesSubmittedAt`        | 实际点 Send 的时间                                                                                                     |


PNS 与公告日期不一致：Admin 上 warning，**不自动改 Prime Deadline，不自动 Approve / Publish**。

家长页突出 Prime Deadline。Host Deadline 放 Details。

可能提前满额的 invitational，Admin 自行提早 Prime Deadline，并显示：*This meet may close before the published deadline if it reaches capacity.*

---

## 6. 发布范围与资格

**Publish to all** = 在册、有参赛意向的队员（已付会员、非 freeze）。不是试课 / clinic-only。

过滤放在「能不能 Attend」，**不把比赛藏起来**。


| 孩子情况                         | 看不看得到                          | 能不能 Attend  |
| ---------------------------- | ------------------------------ | ----------- |
| 年龄/性别对得上至少一项（或尚无 Event File） | 能看                             | 能（无文件时只能选天） |
| Event File 显示一项都报不了          | 能看，标 Not eligible              | 不能          |
| 要 QT、我们还没成绩库                 | 能看，标 Qualifying times required | 能，提示教练会核对   |
| 没有 USA Swimming ID           | 能看                             | 不能，去 OMR    |
| 本场 `not_invited`             | 看不见或只读不可 Attend                | 不能          |
| Invitational 且队未受邀           | 整场未 Publish                    | —           |


Championship 仍 Publish to all，用资格提示挡误报。

要排除某个人：Admin 在该场标 `not_invited`，不必做复杂 group picker。

---

## 7. 家长端（对齐 SE / TU）

入口：`/meets` + dashboard 待办。不塞进旧 `/events/[id]`。

顶部：Meet 名、日期、地点、Host、course、类型、Prime Deadline、公告 PDF、预估费用说明、当前状态、PNS 更新条（Admin Accept 之后）。

### 7.1 每个孩子

```text
Will this swimmer attend?
[ Attend ]  [ Decline ]
```

未提交 = 后台 `no_response`。家长不能选 No Response / Interested。

### 7.2 Notes（两阶段都必须有，同一条字段）

`parentNotes` 从 Attend 那一刻就出现，Event File 到了之后**还在，不清空、不换成别的框**。

用途：时间限制、接送、第一次比赛、不想游某项、只能待到几点。这和「勾哪几天 / 勾哪些项目」是两件事，不能互相替代。

- Event File 还没有：选完天数就能写 notes，并保存。
- Event File 已 Accept：天数、Requested events、**原来的 notes** 同时在。家长可以改 notes，教练始终看得到。
- Admin Accept 新文件、补勾项目，都不得覆盖已有 notes。
- Prime Deadline 前可改；lock 之后只读。

占位示例：`Available Saturday only. Must leave by 2:00 PM. First meet.`

### 7.3 Attend 之后，Event File 还没有（TU 现状）

家长仍能看公告里的 Order of Events，但**没有项目勾选框**。

```text
Which days can they attend?
[ ] Saturday
[ ] Sunday

Event selection opens when the host event file is available.

Notes to coach
[ 只能周六 / 必须两点前走 / 第一次比赛 ]
```

Incomplete：选了 Attend 但没选天或没勾 fee policy → 后台 `incomplete`，不算正式 attend。  
没写 notes 不挡 Attend（notes 可选）。

### 7.4 Event File 已 Accept

只列出该孩子按 **比赛首日年龄** 和性别可能参加的 session / 项目。

样例 TAC Fall Pentathlon：

- Session：Saturday Pentathlon、Sunday Distance
- 8&U 只看周六 25s + 50 free；11 岁看得到周六 50s 和周日距离项
- 上限当场拦住：全场 8、周六 5、周日 3
- 预估：`$25 + $4.50 × 请求项数`（最终按教练项目算）

```text
Which days can they attend?
[x] Saturday   [ ] Sunday

Events to enter（家长勾的就是将提交给 Host 的项目）
文案：Prime will submit the events you select. The host may still cut events after we send the file.

Notes to coach                    ← 文件到来之前写的内容还在
[ Available Saturday only. Must leave by 2:00 PM. ]
```

Invitational 额外条：*Prime must be invited or the host will reject entries.*

### 7.5 Fee policy（Attend 时必须勾）

> I understand that Prime Swim Academy will select and submit meet entries on behalf of my swimmer. I agree to pay the final meet fees using a payment method supported by Prime Swim Academy. Meet fees are based on the events selected for the swimmer and become non-refundable once the entries are submitted to the host club.

可能提前提交时再加一句 capacity。保存 `feePolicyVersion`、`feePolicyAcceptedAt`、`feePolicyAcceptedBy`。不要写 Zelle。

### 7.6 家长何时看到确认版：Pending for review → Publish confirmed

提交前不需要教练批准。家长勾的就是发给 Host 的名单。

**Host 还没书面确认、你们还没按回邮改完并 Publish 之前，家长看到的项目一律是 Pending for review。** 不要写成 Submitted / Final / Confirmed。他们仍能看见自己勾过的项，但必须带这句：

```text
Pending for review
  Saturday: 50 Fly, 50 Back, 50 Breast

Prime has received your selections (or has sent them to the host).
The host has not confirmed the lineup yet. Events may be cut.
```

从勾选完成、经过发给 Host、一直到你们处理完 Host 回邮，都用这一个标签。

Host 回邮之后（收下、砍项、或附 psych sheet）：

1. Admin 点 **Record host reply**（可贴摘要 / 上传邮件或 PDF，不自动解析）。
2. **Coach 或 Admin** 打开每个运动员，去掉被砍的项，可选写 note（*Host cut Sunday 1000 for timeline*）。没被砍的保持不动。
3. 改完后 Admin 点 **Publish confirmed entries**（不默认发信）。
4. 家长 Dashboard / meet 页才换成确认版：

```text
Confirmed
  Saturday: 50 Fly, 50 Back

Host confirmed this lineup. This is what your swimmer is entered in.
```

没点 Publish confirmed，家长继续只看到 Pending for review，即使你们后台已经改完。这样不会把改到一半的砍项先暴露出去。

Invoice / Payments to Prime 跟确认版走：Publish confirmed 之后按**留下的项**算出最终应付。Pending 期间可以显示预估（按当时勾选），并标明金额未确认。

Host 回邮不是标准 ev3/sd3，第一期不自动解析。人手按人去掉砍项即可。

---

## 8. PNS 更新

Check PNS 和定时扫描必须做。更新很勤。

```text
发现新 PDF / 新 Event File / 日期或截止变化
        ↓
Admin 看 diff
        ↓
Accept update
        ↓
家长页立刻换成新公告、新项目表
        ↓
顶部：Updated Sep 18 — Sunday 1000 heats may be limited
```

- 不自动改已 Publish 内容，必须 Accept。
- Accept 后马上同步家长页，**不默认发信**。
- 已 Attend：项目表变了提示 *Review your event requests*；deadline 提前要标出。
- 已 `submitted`：只记日志，不再改 entry。

---

## 9. Event File 从哪来、怎么解析

公开 PNS 先贴公告 PDF，**ev3/hyv 经常晚到，invitational 可能只邮件发给受邀队**。只在日历上看到 PDF 是正常的。

Host 在 Meet Manager：`File → Export → Events for TM` → zip（`.hyv` + `.ev3`）。PNS 要求 sanction 后发给 `office@pns.org`，并在 deadline 前约 3 周发给办公室和/或受邀队。

我们的获取：

1. Check PNS：同一条日历上的新 zip / hyv / ev3
2. Admin **Upload Event File**（Host 邮件发来）
3. 联系邀请时一并要文件

### 解析分层（准确度）

SE/TU **不从 PDF 生成勾选表**。没有文件就不能电子勾项。


| 来源                         | 用途                                  | 准确度                   |
| -------------------------- | ----------------------------------- | --------------------- |
| `.ev3`（zip 里优先）/ 否则 `.hyv` | session、项目、年龄、费用、上限、QT、是否 NT        | 目标 99.9%，用真实 PNS 文件回归 |
| 公告 PDF                     | 家长全文；抽取 invitational、报名邮箱、warmup 叙述 | 抽出的字段必须人审             |
| Admin 核对页                  | Publish / Accept 前对照解析 vs 公告        | 挡住不一致                 |


没有 Event File：**不能开项目勾选，不能出 SD3，不能 Finalize fee。**

实现可参考 `hytek-parser`、swimsnap ev3 parser，用 TypeScript 自写。不要求字节级模仿 SE，输入必须是同一份 Hy-Tek 文件。

Publish / Accept 前核对表示例（TAC）：

```text
Sessions: Saturday, Sunday
Events: 34
Fees: surcharge $25 · individual $4.50
Limits: meet 8 · Sat 5 · Sun 3
Invitation: yes → not invited → Publish locked
```

对不上就挡住。

---

## 10. 算费（按家长勾选，无教练批准）

费用按家长已勾项目即时算，勾几项就是几项。

```text
Host fee = swimmer surcharge + (individual events × event fee)
Relay 第一期默认 paid_by_prime，不进家庭账单
```

TAC 例：只周六 5 项 = `$25 + 5 × $4.50 = $47.50`。

单价来自 Event File。没有文件只能显示区间，不能出 invoice、不能出 SD3。

Fee 生命周期：

```text
家长勾项                    → 预估（Pending for review）
发给 Host / 等回邮           → 仍是预估
Coach/Admin 去掉砍项
Admin Publish confirmed     → 最终 invoice（按留下的项）
提交后 Host 又砍             → 再改、再 Publish confirmed
```

Invoice 状态：`estimated | finalized | invoiced | payment_reported | paid | overdue | waived`  
`I have sent payment` 只能到 `payment_reported`。Admin 核对到账 → `paid`。

付款字段预留 `paymentMethodType`、`paymentProvider` 等。第一期 UI 只展示当前支持的 Zelle 信息和 unique reference。以后加 Stripe 不改作业流程，且要另做扣款授权。

Host 应付与家庭是否付清分开记。家庭未付清不表示已付给 Host。

---

## 11. 交给 Host

Host（PNS）要的是：

- Team management 的 entry file（Meet Manager 能导入的 `**.SD3**`）
- Meet Entry Report PDF（按人）
- Meet Entry Fee Report PDF

我们自己的 CSV **只内用**（谁 Attend、谁欠费、谁没回），不能当正式报名。

**不自动发邮件。** Admin 点 **Compose entry email**：

- To：默认公告/解析出的 entry email，**可改**，可加抄送
- Subject：`Prime Swim Academy entries — {meet name}`
- Body：按公告封面清单预填（联系人、unattached、Outreach、Volunteer Coordinator）
- 附件：SD3 + 两份 PDF
- 点 **Send** 才经 Resend 发出

记录：收件人、时间、操作者、附件版本。可改 To 再发。

已 `submitted` 后家长不能自行撤并要求退费。要撤走 Admin。默认 `nonRefundableAt = entriesSubmittedAt`。

OME 场次不收上传的 TM 文件：用 Entry Report 对照，人手录 OME。第一期不自动填 OME。

SD3 需要法定姓名、性别、生日、**USA Swimming ID**。`swimmers` 必须补 `usaSwimmingId`。

---

## 12. USA Swimming ID 与 Club OMR

没有 ID 不能 Attend，也不能进 SD3。

家长在孩子档案填写 `usaSwimmingId`。没有则 CTA：用 Admin 配置的 **Club OMR link** 去 USA Swimming 注册 **Premium / year-round（full price）**，不要引 Flex。注册在官网上完成；回系统填 ID 后再 Attend。

Admin 设置（链接会换，不要写死）：

```text
usaSwimmingOmrUrl
usaSwimmingOmrUpdatedAt
usaSwimmingOmrUpdatedBy
requiredMembershipLabel     // 例如 Premium (full year)
```

18+ APT 以后再卡。第一期先卡 ID。

---

## 13. 家长 Dashboard 模块（第一期就要做）

这是家长登录后的主画面，和 `/meets` 作业页并列，不是 meet 设计的附录。

现在的 dashboard 已经按孩子分卡：会员、单月学费、makeup。Meet 加上之后，**每个孩子卡片里要能看见这个孩子的学费和这个孩子的比赛账单**；**所有孩子卡片下面再单独一块：这个家庭要付给 Prime 的 meet payments**。

两块都要有。缺任何一块都不算做完。

### 13.1 页面结构

```text
Dashboard
│
├── 每个 Swimmer 一张卡（现有 grid，保持一人一卡）
│     ├── 姓名 / 年龄 / level / 会员状态
│     ├── USA Swimming ID（没有则去 OMR 的条）
│     ├── Tuition（这个孩子当月学费）
│     ├── Membership due / renew（已有，不动）
│     ├── Upcoming meets（这个孩子待处理的 Attend）
│     └── Meet invoices（这个孩子已被 Notify 的比赛费）
│
└── Payments to Prime · Meet fees（所有孩子卡片下面）
      这个家庭现在要交给俱乐部的比赛报名费
      每个 invoice 一行，按孩子 + 场次，分开付
```

没有家庭「Total due $276」。学费在孩子卡里付，比赛费在下面清单里按场付。

### 13.2 每个孩子卡：Tuition

继续用现有学费逻辑，每人只显示**已经对家长公开**的当月学费。

```text
Everly Young
  Tuition · March 2026          待支付
  $240                          Due Mar 1
```


| 学费状态               | 家长看到                                        |
| ------------------ | ------------------------------------------- |
| 未 `publishedToApp` | 「核算中」，不显示金额                                 |
| 已公开、未付             | 金额 + Due 日期 + 待支付                           |
| 家长点了已付、Admin 未确认   | Payment reported — waiting for confirmation |
| Admin 已确认          | 已支付                                         |


学费付款入口仍走现在的学费/Zelle 流程，**不要和 meet 做成同一个 Pay 按钮**。

### 13.3 每个孩子卡：该孩子的 Meet invoice

Pending 期间孩子卡上可显示预估金额 + Pending for review。**Publish confirmed 之后**才出现确认项目和最终应付，并进入下方 Payments to Prime。

```text
Everly Young
  Meet · TAC Fall Pentathlon          Unpaid
  Host entry fees (pass-through)
  Sat: 50 Fly, 50 Back, 50 Breast, 50 Free, 200 IM
  $47.50                              Due Oct 12
  [View events]   [Pay this meet]
```

同一孩子多场未付，就多行，每场一行：

```text
  Meet · TAC Fall Pentathlon     $47.50   Unpaid
  Meet · IST Fall Open           $36.00   Payment reported
```


| Meet invoice 状态    | 卡上文案                                        |
| ------------------ | ------------------------------------------- |
| 未 Notify           | 不出现                                         |
| `invoiced`         | Unpaid + 金额 + Due + Pay this meet           |
| `payment_reported` | Payment reported — waiting for confirmation |
| `paid`             | Paid（可收进次要位置，不占主行动）                         |
| `overdue`          | Overdue，仍要能付                                |
| `waived`           | Waived                                      |


必须写明 **Host entry fees / pay Prime (pass-through)**，避免家长以为这是课费。  
Prime administrative fee 第一期默认 $0，有的话另起一行，不要和 Host fee 混成一项。

孩子卡上的 Meet invoice 和底部「Payments to Prime」是同一批账单的两处展示：卡上看「这个孩子欠哪几场」，底部看「这个家庭现在要交给我们哪些比赛费」。

### 13.4 每个孩子卡：Upcoming meets（行动，不是账单）

已 Publish、这个孩子在 audience 里、尚未 lock 的场，出现在该孩子卡上：

```text
Upcoming meet · TAC Fall Pentathlon
  Prime deadline: Sep 8, 11:59 PM PT
  Status: No response / Attend / Pending for review / Confirmed
  Events: Sat 50 Fly, 50 Back              ← Pending 显示已勾选；Confirmed 显示改完后的项
  [Respond] 或 [View events]
```

没有 USA ID：Attend 不可用，出现 Register USA Swimming（Club OMR）。  
这是作业，不是付款。没 invoice 之前这里没有金额。

### 13.5 卡片下方：Payments to Prime · Meet fees

所有 swimmer 卡 **下面** 单独一模块，标题明确：这些钱是交给 Prime、由 Prime 转付给 Host 的比赛报名费。

只列出 **meet invoice**，不把学费、会员续费卷进来。

```text
Payments to Prime
Meet entry fees — pay Prime, we pay the host club

  Everly Young · TAC Fall Pentathlon
  Host: Thunderbird Aquatic Club
  5 events · surcharge $25 + $4.50 × 5
  $47.50    Due Oct 12    Unpaid
  Zelle reference: TAC26-EVERLY-1042
  [Copy Zelle info]  [Copy reference]  [I have sent payment]

  Miles Chen · TAC Fall Pentathlon
  $47.50    Due Oct 12    Payment reported
  Waiting for Prime to confirm the transfer.

没有未付比赛费时：No meet payments due.
```

规则：

- 一行 = 一个孩子 × 一场 meet。两兄弟同一场就是两行，两笔付、两个 reference。
- 没有「Pay all meets」或家庭合计。
- `I have sent payment` → `payment_reported`，不能直接 `paid`。
- 已付清的默认不占主清单；需要可展开 Recent meet payments。
- 当前付款方式展示 Zelle；文案仍是「a payment method supported by Prime」。
- 学费不出现在这一块。学费只在对应孩子卡里。

### 13.6 什么时候各块出现


| 阶段                 | 孩子卡 Tuition | 孩子卡 Meet invoice | 孩子卡 Upcoming meet | 下方 Payments to Prime |
| ------------------ | ----------- | ---------------- | ----------------- | -------------------- |
| 学费已公开未付            | 有金额         | —                | —                 | 不出现学费                |
| Meet 已开放，未勾项 | 照旧 | 不出现 | 要 Attend | 不出现 |
| 已勾项，Host 未确认或未 Publish confirmed | 照旧 | 预估 + Pending for review | Pending for review | 不进最终应付 |
| Admin 已 Publish confirmed | 照旧 | 最终金额 + Confirmed | Confirmed | **该场出现，要付给我们** |
| 家长已上报付款            | 照旧          | Payment reported | —                 | Payment reported     |
| Admin 确认到账         | 照旧          | Paid             | —                 | 移出主清单                |


### 13.7 和现有 dashboard 的关系

- 会员状态、renew、学费「核算中」逻辑保留。
- Makeup RSVP 本模块不依赖；是否从 dashboard 拿掉另说，不挡 meet。
- `/meets` 是作业详情（公告、勾选、提交状态）。Dashboard 是「每个孩子现在怎样 + 要交给我们哪些比赛费」。

### 13.8 Admin 对称面

Admin Outstanding 同样分开，不要合成一笔：

- 谁的学费未付 / 已上报  
- 谁的哪场 meet fee 未付 / 已上报 / 已确认

家长看「我每个孩子的学费」和「我要交给 Prime 的比赛费」。Admin 看「谁还没把学费交给我们」和「谁还没把这场 meet fee 交给我们」。

---

## 14. 数据模型（第一期要建的）

```text
meets
  id, name, hostClub, meetType, course
  startDate, endDate, location, sanctionNumber
  sourceUrl, announcementUrl, eventFileUrl
  eligibilityStatus, invitationStatus, mayCloseEarly
  pnsPublishedDeadline, announcementEntryDeadline
  hostConfirmedDeadline, effectiveHostDeadline
  primeCommitmentDeadline, targetSubmissionDate
  deadlineTimezone                  // America/Los_Angeles
  status, publishedToFamiliesAt
  entriesSubmittedAt, hostConfirmedAt, nonRefundableAt
  hostEntryEmail                    // 预填，发送时可改
  sourceLastCheckedAt, pendingSourceReview

meet_source_versions
  meetId, sourceType, sourceUrl, retrievedAt, contentHash
  parsedData, previousVersionId, reviewStatus

meet_sessions / meet_events         // 来自 Event File
meet_audiences                      // 默认 all competitive；可 not_invited 排除

meet_commitments
  meetId, swimmerId, parentUID
  attendance                        // no_response | incomplete | attend | decline
  parentNotes                   // 选天阶段就可写；Event File 到了保留，不覆盖
  lockedAt
  feePolicyVersion, feePolicyAcceptedAt, feePolicyAcceptedBy

meet_session_availability
meet_event_requests                 // 家长请求，非正式 entry

meet_entries                        // 教练最终项
  selectedByParent                  // 家长勾的即为将提交项

meet_invoices
  meetId, swimmerId
  hostFeeAmount, primeFeeAmount     // prime 第一期默认 0
  totalAmount, paymentMethod, paymentReference
  status, issuedAt, dueAt
  paymentReportedAt, paidAt, confirmedBy

host_payments                       // 队付给 Host 的一笔
meet_submissions                    // 每次生成的 SD3/PDF 版本 + 是否已 Send

app_settings / club_settings
  usaSwimmingOmrUrl, requiredMembershipLabel

coaches
  uid, email, firstName, lastName, phone
  status                  // pending | approved | rejected | deactivated
  assignedLevelIds, assignedSwimmerIds
  appliedAt, reviewedAt, reviewedBy

swimmers 增补
  usaSwimmingId
```

`coaches` 第一期要建。relay、results 等按需后补。

现有 `events.swim_meet` 仅官网展示，运营以 `meets` 为准。

Commitment 的 lock / withdrawal 用独立字段，不和 `attendance` 揉成一串枚举。

---

## 15. Admin 画面与按钮

每场：

**Readiness：** 公告 / Event File / Eligibility / Invitation / Deadline 冲突 / 是否已 Publish  

**Responses：** Eligible / Attend / Decline / No Response / Incomplete  

**Entries：** 待选 / 已选 / 已批准  

**Financial：** Host fees、家庭 invoice、已收、未收、已付给 Host（两套账）

**动作（都是人工点）：**

```text
Check PNS for Updates
Accept update
Upload Event File
Approve
Publish to families              // 不发信
Compose entry email              // 按家长勾选出 SD3；点 Send；家长仍 Pending for review
Record host reply                // 收到 Host 邮件后点
Remove cut events per swimmer    // Coach 或 Admin
Publish confirmed entries        // 改完后才让家长看到确认版
Mark paid / Record host payment
```

Invitational 未 `invited`：Publish 锁定。  
无 Event File：Compose / SD3 锁定。

---

## 16. Coach 角色模块

现在系统只有家长（Firebase Auth）和 Admin（`admin` / `admins` 集合、`ADMIN_ALLOW_EMAILS`、custom claim）。**没有 coach 角色。** 招新教练后必须能单独登录，且不能拥有 Admin 全权限。

Admin 保持现在的默认入口和权限，不动。Coach 另做一套注册、审批、有限权限。

### 16.1 注册与审批

```text
教练打开 /coach/register
        ↓
填姓名、邮箱、手机、可带的组（可选）
        ↓
创建/登录 Firebase Auth（可用已有家长账号，角色可叠加）
        ↓
写入 coaches，status = pending
        ↓
Admin 在 /admin/coaches 批准或拒绝
        ↓
approved → 可进 /coach
rejected / deactivated → 不能进
```

- 未批准时登录只能看到「申请审核中」，进不了 meet 名单。
- Admin 可停用（`deactivated`），立刻丢掉 `/coach` 权限。
- **不要**把教练写进现有 `admin` 集合，否则会误开学费、群发等全部后台。

### 16.2 负责哪些孩子

Admin 批准时可指定范围，教练只看见范围内的孩子：

```text
assignedLevelIds     // 例如 Silver Beginner、Gold
assignedSwimmerIds   // 额外点名，或从某组排除某人
```

可见 = 该孩子 `level` 在 assigned levels 里，或在 `assignedSwimmerIds` 里。  
看不见别组的 commitment、notes、USA ID。

一人可兼家长和教练：自己孩子走 `/dashboard`，带组走 `/coach`。

### 16.3 第一期放开的权限（仅 Meet）

`/coach` 独立导航，不要套 Admin 菜单。

| 可以 | 不可以 |
|---|---|
| 看已 Publish 的 meet | Approve / Publish / 改 deadline |
| 看自己组：Attend、Decline、No Response、Incomplete | Check PNS、上传 Event File |
| 看天数、notes、家长已勾项目 | 提交前改写家长勾选 |
| Host 回邮后：给自己组去掉被砍的项 | Publish confirmed、Send、invoice |
| | 进 `/admin/*`、群发、学费、考勤、OMR |

Admin 负责：邀请、开放 Attend、按家长勾选发 SD3、Record host reply、Publish confirmed、确认付款。教练在 Host 回邮后改自己组被砍的项，不点对家长的确认 Publish。

### 16.4 Coach 画面

```text
/coach/meets              我组相关的场次
/coach/meets/[id]         我组名单（只读）
```

```text
TAC Fall Pentathlon · Prime deadline Sep 8

Attend 6 · Decline 2 · No response 3 · Incomplete 1

Everly Young · 9 · Silver Beginner · USA ID on file
  Days: Saturday
  Notes: Must leave by 2:00 PM
  Selected: 50 Fly, 50 Back, 50 Free
  Status: attend · pending review / confirmed
  After host reply: [ Remove cut events ]
```

### 16.5 数据

```text
coaches
  id                  // Firebase uid 或独立 id + uid
  uid, email
  firstName, lastName, phone
  status              // pending | approved | rejected | deactivated
  assignedLevelIds
  assignedSwimmerIds
  appliedAt, reviewedAt, reviewedBy
  createdAt
```

API：家长路由验 `parentUID`；Admin 路由验现有 `isInAdminsServer`；Coach 路由验 `coaches.status === approved` 且该 swimmer 在其范围内。三者分开，Coach token 打不开 `/api/admin/*`。

以后要给教练考勤或评价，再按模块加权限位。第一期不要预开空菜单。

---

## 17. 第一期范围

做：

- PNS 自动建 draft + 手动 Check PNS
- Admin 审、改 Prime Deadline、Approve；Publish 另一步
- Invitational 闸：先联系 Host，`invited` 才能 Publish
- Publish to all + Attend 资格过滤
- 家长：公告、Attend/Decline、选天、notes、fee policy
- Event File 导入与 99.9% 解析；Accept 后家长勾项（勾的就是提交内容）
- Coach 角色：注册 → Admin 审批 → 只读自己组 RSVP/项目；不批准、不进 Admin
- 按家长勾选自动算 Host fee；独立 meet invoice；与学费分开付
- SD3 + 两份 PDF；点 Send 后家长仍 Pending for review
- Host 回邮后 Coach/Admin 按人去掉砍项，Admin Publish confirmed 后家长才看到确认版和最终应付
- USA Swimming ID + Admin OMR link
- 家长 Dashboard 整块：每卡学费 + 每卡该孩子 meet invoice；卡下「Payments to Prime · Meet fees」分开付给我们
- 付款方式可扩展，不做 Stripe
- 内用 CSV

不做：教练批准关卡、lineup Notify、解析 Host 回邮/psych sheet、群发/reminder、results、Stripe、OME 自动填、家庭 Total Due、从 PDF 硬造勾选表、把教练做成 Admin。

---

## 18. 样例：TAC Fall Pentathlon

1. 扫到 PNS → `draft`
2. 公告抽出 invitational、截止 2026-09-15、$25 / $4.50、Sat/Sun
3. Admin 联系 `haunnah@gmail.com` / `gminkel@fidalgopool.com` 要邀请 + Event File
4. `invited` 后 Approve；建议 Prime Deadline **Sep 8, 2026 11:59 PM PT**（可改）
5. Publish；无 USA ID 去 OMR
6. 无文件：Attend + Saturday/Sunday + notes
7. 文件到了 Accept：按年龄勾项，卡 5/3/8，费用即时算出
8. Compose email，点 Send；家长仍 Pending for review
9. Host 回邮 → Record host reply → Coach/Admin 按人去掉砍项 → Publish confirmed → Dashboard 出确认版

---

## 19. 产品原则（收口）

1. PNS 列出 ≠ Prime 可以参加。
2. 系统发现，Admin 确认和发布。
3. 家长只有 Attend / Decline；未操作是 No Response。
4. 三种 Deadline 分开；家长遵守 Prime Deadline。
5. 家长勾的项目就是提交名单。教练只读自己组，不批准。
6. 没 Event File 就先声明，不假装能勾项。
7. 没邀请就不 Publish。
8. 没 ID 就不 Attend，去 Club OMR 注册 full price。
9. 发给 Host 之后到 Publish confirmed 之前，家长项目一律 Pending for review。确认版只在改完砍项并 Publish 后出现。
10. 当前 Zelle，协议不绑 Zelle。
11. 家庭付款和付给 Host 分开。
12. 学费和 meet fee 分开付。
13. Dashboard：每卡学费 + 每卡该孩子比赛账单；卡下单独列出要付给 Prime 的 meet fees。
14. 提交 Host 后原则上不退。
15. PNS 更新必须 Accept 后才出现在家长页。
16. 发给 Host 的邮件必须能改收件人，并且点了才发送。

