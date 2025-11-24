"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { collection, getDoc, getDocs, doc } from "firebase/firestore";

interface Preference {
  location: string;
  timeSlots: string[];
}

type GroupLevel =
  | "bronze"
  | "silver-beginner"
  | "silver-beginner-1"
  | "silver-performance"
  | "silver-performance-1"
  | "gold"
  | string;

interface SurveyEntry {
  swimmerName: string;
  groupLevel?: GroupLevel;  // 新：按组别驱动
  timesPerWeek?: number;    // 旧数据兼容
  preferences: Preference[];
}

// 统计结构：location -> time -> group -> info
interface WeightedStats {
  [location: string]: {
    [timeSlot: string]: {
      [group: string]: {
        weight: number;                        // 需求权重之和
        swimmers: string[];                    // 选择了该 slot 的该组泳员
        swimmerDetails?: { name: string; requiredPerWeek: number }[];
      };
    };
  };
}

interface SlotAssignments {
  [slotKey: string]: string[]; // "location||time||group" -> ["Alice", "Bob", ...]
}

const LANE_CAPACITY = 4;  // 推荐按权重 -> 需求转化为车道数时的基准
const MAX_LANE_SIZE = 6;  // 每条泳道最大人数（硬上限）

// —— 泳道可用量配置 —— //
// 默认每个 (location, time) 有 2 条泳道可用；可按需覆盖具体泳馆/时段。
const DEFAULT_LANES_PER_SLOT = 2;
const LANES_BY_SLOT: { [location: string]: { [time: string]: number } } = {
  "Mary Wayte Pool (Mercer Island)": {
    "*": 2, // 任意时段 2 条
  },
  "Bellevue Aquatic Center (Bellevue)": {
    "*": 2,
  },
  // 其他泳馆按需补充，或使用默认值
};

const getLanesForSlot = (location: string, time: string): number => {
  const byLoc = LANES_BY_SLOT[location];
  if (!byLoc) return DEFAULT_LANES_PER_SLOT;
  return byLoc[time] ?? byLoc["*"] ?? DEFAULT_LANES_PER_SLOT;
};

// —— 工具 —— //
const getDayFromTime = (t: string) => t.split(" ")[0]; // "Mon" | "Tue" | "Wed" ...
const slotKeyOf = (location: string, time: string, group: string) => `${location}||${time}||${group}`;
const poolDayKeyOf = (location: string, time: string) => `${location}||${getDayFromTime(time)}`;

// 每周最低频次（可按实际需要调整）
const REQUIRED_PER_WEEK: Record<Exclude<GroupLevel, string>, number> = {
  bronze: 2,
  "silver-beginner": 3,
  "silver-beginner-1": 2,       // ✅ 新增
  "silver-performance": 4,
  "silver-performance-1": 5,    // ✅ 新增
  gold: 0, // 本页不安排 gold
};

function getRequiredPerWeek(entry: SurveyEntry): number {
  if (entry.groupLevel && entry.groupLevel in REQUIRED_PER_WEEK) {
    return REQUIRED_PER_WEEK[entry.groupLevel as keyof typeof REQUIRED_PER_WEEK];
  }
  // 兼容旧数据：没有 groupLevel 就退回 timesPerWeek；否则不参与
  return entry.timesPerWeek ?? 0;
}

function prettyGroup(group: string) {
  if (group === "bronze") return "Bronze";
  if (group === "silver-beginner") return "Silver Beginner";
  if (group === "silver-beginner-1") return "Silver Beginner 1";
  if (group === "silver-performance") return "Silver Performance";
  if (group === "silver-performance-1") return "Silver Performance 1";
  return group;
}

// ---------- 每天的配色（Tailwind 颜色系） ----------
const DAY_STYLE: Record<
  string,
  {
    panelBorder: string;   // 天的容器边框色
    headerBg: string;      // 天标题背景
    headerText: string;    // 天标题文字
    headerBorder: string;  // 天标题下边框
    groupBg: string;       // 组卡片背景
    groupBorder: string;   // 组卡片边框
  }
> = {
  Mon: {
    panelBorder: "border-blue-200",
    headerBg: "bg-blue-50",
    headerText: "text-blue-900",
    headerBorder: "border-blue-200",
    groupBg: "bg-blue-50",
    groupBorder: "border-blue-200",
  },
  Tue: {
    panelBorder: "border-emerald-200",
    headerBg: "bg-emerald-50",
    headerText: "text-emerald-900",
    headerBorder: "border-emerald-200",
    groupBg: "bg-emerald-50",
    groupBorder: "border-emerald-200",
  },
  Wed: {
    panelBorder: "border-amber-200",
    headerBg: "bg-amber-50",
    headerText: "text-amber-900",
    headerBorder: "border-amber-200",
    groupBg: "bg-amber-50",
    groupBorder: "border-amber-200",
  },
  Thu: {
    panelBorder: "border-violet-200",
    headerBg: "bg-violet-50",
    headerText: "text-violet-900",
    headerBorder: "border-violet-200",
    groupBg: "bg-violet-50",
    groupBorder: "border-violet-200",
  },
  Fri: {
    panelBorder: "border-rose-200",
    headerBg: "bg-rose-50",
    headerText: "text-rose-900",
    headerBorder: "border-rose-200",
    groupBg: "bg-rose-50",
    groupBorder: "border-rose-200",
  },
  Sat: {
    panelBorder: "border-sky-200",
    headerBg: "bg-sky-50",
    headerText: "text-sky-900",
    headerBorder: "border-sky-200",
    groupBg: "bg-sky-50",
    groupBorder: "border-sky-200",
  },
  Sun: {
    panelBorder: "border-lime-200",
    headerBg: "bg-lime-50",
    headerText: "text-lime-900",
    headerBorder: "border-lime-200",
    groupBg: "bg-lime-50",
    groupBorder: "border-lime-200",
  },
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayIndex = (d: string) => DAY_ORDER.indexOf(d);

export default function TrainingSurveyStatsWeighted() {
  const [stats, setStats] = useState<WeightedStats>({});
  const [assignments, setAssignments] = useState<SlotAssignments>({});
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const adminDocRef = doc(db, "admin", user.email ?? "");
      const adminSnap = await getDoc(adminDocRef);
      if (adminSnap.exists()) {
        setIsAdmin(true);
        fetchStats();
      } else {
        router.push("/not-authorized");
      }
      setChecked(true);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchStats = async () => {
    const snapshot = await getDocs(collection(db, "trainingSurveys"));
    const weightedStats: WeightedStats = {};
    const swimmerMap: { [name: string]: SurveyEntry } = {};
    const insufficientSelections: { name: string; required: number; selected: number }[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as SurveyEntry;
      const required = getRequiredPerWeek(data);

      if (!data?.preferences?.length) return;
      if (required <= 0) return; // 非 bronze/silver 或无需求的不参与

      // 统计总选择数（跨场馆/时段）
      const totalChoices = data.preferences.reduce((acc, pref) => acc + pref.timeSlots.length, 0);
      if (totalChoices < required) {
        insufficientSelections.push({ name: data.swimmerName, required, selected: totalChoices });
      }
      if (totalChoices === 0) return;

      swimmerMap[data.swimmerName] = data;

      // 权重 = 组别最低周频 / 该泳员总选择数
      const weightEach = required / totalChoices;
      const group = (data.groupLevel ?? "unknown").toString();

      for (const pref of data.preferences) {
        if (!weightedStats[pref.location]) weightedStats[pref.location] = {};
        for (const time of pref.timeSlots) {
          if (!weightedStats[pref.location][time]) weightedStats[pref.location][time] = {};
          if (!weightedStats[pref.location][time][group]) {
            weightedStats[pref.location][time][group] = { weight: 0, swimmers: [], swimmerDetails: [] };
          }
          const bucket = weightedStats[pref.location][time][group];
          bucket.weight += weightEach;

          if (!bucket.swimmers.includes(data.swimmerName)) {
            bucket.swimmers.push(data.swimmerName);
            bucket.swimmerDetails?.push({
              name: data.swimmerName,
              requiredPerWeek: required,
            });
          }
        }
      }
    });

    // —— 自动排班 —— //
    // 新规则：
    //  - 每个 (location, time) 允许多个组同时上课（多泳道）
    //  - 该 (location, time) 的可用泳道总数受 getLanesForSlot(location, time) 限制
    //  - 仍保留：同一泳馆同一天，每个泳员最多一个 spot

    const assignedBySwimmer: { [name: string]: string[] } = {};
    const swimmerAssignedCount: { [name: string]: number } = {};
    const swimmerPoolDayAssigned: { [name: string]: Set<string> } = {}; // location||day

    Object.keys(swimmerMap).forEach((name) => {
      assignedBySwimmer[name] = [];
      swimmerAssignedCount[name] = 0;
      swimmerPoolDayAssigned[name] = new Set();
    });

    // 汇总 (location, time) -> 按权重排序的 group 选项
    type SlotGroupOpt = { location: string; time: string; group: string; weight: number; demandCount: number };
    const slotToGroupOpts: { [slotLT: string]: SlotGroupOpt[] } = {};

    for (const [location, timeMap] of Object.entries(weightedStats)) {
      for (const [time, groupMap] of Object.entries(timeMap)) {
        const lt = `${location}||${time}`;
        slotToGroupOpts[lt] = Object.entries(groupMap)
          .map(([group, info]) => ({
            location,
            time,
            group,
            weight: info.weight,
            demandCount: info.swimmers.length,
          }))
          .sort((a, b) => (b.weight !== a.weight ? b.weight - a.weight : b.demandCount - a.demandCount));
      }
    }

    const slotAssignments: SlotAssignments = {};

    // 辅助：计算候选并按“剩余需求/灵活度”排序
    const getSortedCandidates = (location: string, time: string, group: string): string[] => {
      const info = weightedStats[location][time][group];
      // 候选：该组的泳员，尚未达最低周频，且这个泳馆这一天尚未被安排
      const candidates = info.swimmers.filter((name) => {
        const entry = swimmerMap[name];
        const required = getRequiredPerWeek(entry);
        const poolDayKey = poolDayKeyOf(location, time);
        return swimmerAssignedCount[name] < required && !swimmerPoolDayAssigned[name].has(poolDayKey);
      });

      // 计算灵活度（剩余可用的 pool-day 数）
      const countFlexiblePoolDays = (name: string): number => {
        const entry = swimmerMap[name];
        const taken = swimmerPoolDayAssigned[name];
        const set = new Set<string>();
        for (const pref of entry.preferences) {
          for (const tm of pref.timeSlots) {
            const key = poolDayKeyOf(pref.location, tm);
            if (!taken.has(key)) set.add(key);
          }
        }
        return set.size;
      };

      // 候选排序：剩余需求多者优先；灵活度低者优先
      candidates.sort((A, B) => {
        const aEntry = swimmerMap[A]; const bEntry = swimmerMap[B];
        const aNeed = getRequiredPerWeek(aEntry) - swimmerAssignedCount[A];
        const bNeed = getRequiredPerWeek(bEntry) - swimmerAssignedCount[B];
        if (bNeed !== aNeed) return bNeed - aNeed;
        const aFlex = countFlexiblePoolDays(A);
        const bFlex = countFlexiblePoolDays(B);
        return aFlex - bFlex;
      });

      return candidates;
    };

    // 对每个 (location, time) 分配其泳道数，允许多组并行
    for (const [lt, groupOptions] of Object.entries(slotToGroupOpts)) {
      const [location, time] = lt.split("||");
      let lanesRemaining = getLanesForSlot(location, time);

      if (lanesRemaining <= 0) continue;

      // 先做一轮“每组最多先拿 1 条泳道”的分配，保证多组并行的机会
      for (const { group } of groupOptions) {
        if (lanesRemaining <= 0) break;

        // 试着为该组开一条泳道
        const candidates = getSortedCandidates(location, time, group);
        if (candidates.length === 0) continue;

        const sKey = slotKeyOf(location, time, group);
        let placed = 0;

        for (const name of candidates) {
          const entry = swimmerMap[name];
          const required = getRequiredPerWeek(entry);
          if (swimmerAssignedCount[name] >= required) continue;

          if (!slotAssignments[sKey]) slotAssignments[sKey] = [];
          slotAssignments[sKey].push(name);
          assignedBySwimmer[name].push(sKey);
          swimmerAssignedCount[name]++;
          swimmerPoolDayAssigned[name].add(poolDayKeyOf(location, time));

          placed++;
          if (placed >= MAX_LANE_SIZE) break;
        }

        if (placed > 0) {
          lanesRemaining--; // 成功开出一条泳道
        }
      }

      // 若还剩泳道，再按权重高到低继续给“仍有候选”的组追加泳道
      // 直到用完泳道或没有可分配的候选
      // （这一步允许某个大组在该时段占用多条泳道）
      let progress = true;
      while (lanesRemaining > 0 && progress) {
        progress = false;
        for (const { group } of groupOptions) {
          if (lanesRemaining <= 0) break;

          const candidates = getSortedCandidates(location, time, group);
          if (candidates.length === 0) continue;

          const sKey = slotKeyOf(location, time, group);
          let placed = 0;

          for (const name of candidates) {
            const entry = swimmerMap[name];
            const required = getRequiredPerWeek(entry);
            if (swimmerAssignedCount[name] >= required) continue;

            if (!slotAssignments[sKey]) slotAssignments[sKey] = [];
            // 避免重复塞进同一 (slot,group)
            if (slotAssignments[sKey].includes(name)) continue;

            slotAssignments[sKey].push(name);
            assignedBySwimmer[name].push(sKey);
            swimmerAssignedCount[name]++;
            swimmerPoolDayAssigned[name].add(poolDayKeyOf(location, time));

            placed++;
            if (placed >= MAX_LANE_SIZE) break;
          }

          if (placed > 0) {
            lanesRemaining--;
            progress = true;
          }
        }
      }
    }

    setStats(weightedStats);
    setAssignments(slotAssignments);
    setLoading(false);

    if (insufficientSelections.length) {
      console.warn("Selected fewer slots than required:", insufficientSelections);
    }
  };

  // ---------- Final Assignment：按 周 → 泳池 → 组 列表展示（带配色） ----------
  // 将 assignments 按 Day -> Location -> Group 分组
  const groupedAssignments = useMemo(() => {
    type Entry = { time: string; swimmers: string[] };
    const map: Record<string, Record<string, Record<string, Entry[]>>> = {};
    for (const [slotKey, swimmers] of Object.entries(assignments)) {
      const [location, time, group] = slotKey.split("||");
      const day = getDayFromTime(time); // "Mon" / "Tue" ...

      if (!map[day]) map[day] = {};
      if (!map[day][location]) map[day][location] = {};
      if (!map[day][location][group]) map[day][location][group] = [];
      map[day][location][group].push({ time, swimmers });
    }

    // 每个组内按时间字典序排（需要更智能排序可再增强）
    for (const day of Object.keys(map)) {
      for (const loc of Object.keys(map[day])) {
        for (const grp of Object.keys(map[day][loc])) {
          map[day][loc][grp].sort((a, b) => a.time.localeCompare(b.time));
        }
      }
    }
    return map;
  }, [assignments]);

  if (!checked) return <p className="text-center mt-10">Checking access...</p>;
  if (!isAdmin) return null;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">📊 Weighted Survey Demand + Final Schedule</h1>

      {loading ? (
        <p>Loading survey responses...</p>
      ) : (
        <>
          {/* 需求统计：按场馆/时段/组别展示 */}
          {Object.entries(stats).map(([location, timeMap]) => (
            <div key={location} className="mb-6 border border-gray-300 rounded-md p-4">
              <h2 className="text-lg font-semibold mb-3">🏊 {location}</h2>
              <ul className="space-y-3">
                {Object.entries(timeMap).map(([time, groupMap]) => (
                  <li key={time} className="space-y-1">
                    <div className="font-medium">{time}</div>
                    {Object.entries(groupMap).map(([group, { weight, swimmerDetails }]) => (
                      <div key={group} className="flex flex-col sm:flex-row sm:items-center sm:justify-between pl-2">
                        <span className="text-sm">
                          Group: <strong>{prettyGroup(group)}</strong>
                        </span>
                        <span className="text-sm">
                          <strong>{weight.toFixed(1)}</strong> demand →
                          <span className="text-gray-600"> {Math.ceil(weight / LANE_CAPACITY)} lanes (suggested)</span>
                        </span>
                        {swimmerDetails && swimmerDetails.length > 0 && (
                          <div className="text-xs text-gray-700 mt-1 sm:mt-0">
                            👤 {swimmerDetails.map((s) => `${s.name} (${s.requiredPerWeek})`).join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* 最终排班（按 周→池→组 展示 + 每天不同配色） */}
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-4">📅 Final Assignment (By Day → Pool → Group)</h2>

            {Object.keys(assignments).length === 0 ? (
              <p>No final assignments available.</p>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedAssignments)
                  .sort((a, b) => dayIndex(a) - dayIndex(b))
                  .map((day) => {
                    const style = DAY_STYLE[day] ?? {
                      panelBorder: "border-gray-200",
                      headerBg: "bg-gray-50",
                      headerText: "text-gray-900",
                      headerBorder: "border-gray-200",
                      groupBg: "bg-white",
                      groupBorder: "border-gray-200",
                    };
                    return (
                      <div
                        key={day}
                        className={`rounded-lg overflow-hidden border ${style.panelBorder}`}
                      >
                        <div className={`px-4 py-2 ${style.headerBg} ${style.headerText} ${style.headerBorder} border-b font-semibold`}>
                          {day}
                        </div>

                        {/* 每个泳池 */}
                        {Object.entries(groupedAssignments[day]).map(([location, groups], idx, arr) => (
                          <div
                            key={`${day}-${location}`}
                            className={`px-4 py-3 ${idx < arr.length - 1 ? "border-b" : ""} border-gray-100`}
                          >
                            <div className="font-medium text-gray-800 mb-2">🏊 {location}</div>

                            {/* 每个组 */}
                            <div className="space-y-2">
                              {Object.entries(groups).map(([group, entries]) => (
                                <div
                                  key={`${day}-${location}-${group}`}
                                  className={`rounded-md border ${style.groupBorder} ${style.groupBg} p-3`}
                                >
                                  <div className="text-sm font-semibold mb-1">{prettyGroup(group)}</div>
                                  <ul className="text-sm leading-relaxed list-disc pl-5">
                                    {entries.map(({ time, swimmers }) => (
                                      <li key={`${day}-${location}-${group}-${time}`}>
                                        <span className="font-medium">{time}</span>
                                        {" — "}
                                        <span>{swimmers.join(", ")}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
