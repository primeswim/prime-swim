"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { collection, getDoc, getDocs, doc } from "firebase/firestore";

interface Preference {
  location: string;
  timeSlots: string[];
}

type GroupLevel = "bronze" | "silver-beginner" | "silver-performance" | "gold" | string;

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
        weight: number;
        swimmers: string[];
        swimmerDetails?: { name: string; requiredPerWeek: number }[];
      };
    };
  };
}

interface SlotAssignments {
  [slotKey: string]: string[]; // "location||time||group" -> ["Alice", "Bob", ...]
}

const LANE_CAPACITY = 4;
const MAX_LANE_SIZE = 6;

// —— 工具 —— //
const getDayFromTime = (t: string) => t.split(" ")[0]; // "Mon" | "Tue" | "Wed" ...
const slotKeyOf = (location: string, time: string, group: string) => `${location}||${time}||${group}`;
const poolDayKeyOf = (location: string, time: string) => `${location}||${getDayFromTime(time)}`;

const REQUIRED_PER_WEEK: Record<Exclude<GroupLevel, string>, number> = {
  bronze: 2,
  "silver-beginner": 3,
  "silver-performance": 4,
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
  if (group === "silver-performance") return "Silver Performance";
  return group;
}

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
      if (required <= 0) return; // 非 bronze/silver 或无需求的记录不参与

      // 统计总选择数（跨场馆/时段）
      const totalChoices = data.preferences.reduce((acc, pref) => acc + pref.timeSlots.length, 0);
      if (totalChoices < required) {
        insufficientSelections.push({ name: data.swimmerName, required, selected: totalChoices });
      }
      if (totalChoices === 0) return;

      swimmerMap[data.swimmerName] = data;

      // 权重 = 组别最低周频 / 该泳员总选择数
      const weight = required / totalChoices;
      const group = (data.groupLevel ?? "unknown").toString();

      for (const pref of data.preferences) {
        if (!weightedStats[pref.location]) weightedStats[pref.location] = {};
        for (const time of pref.timeSlots) {
          if (!weightedStats[pref.location][time]) weightedStats[pref.location][time] = {};
          if (!weightedStats[pref.location][time][group]) {
            weightedStats[pref.location][time][group] = { weight: 0, swimmers: [], swimmerDetails: [] };
          }
          const bucket = weightedStats[pref.location][time][group];
          bucket.weight += weight;

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
    // 约束1：同一泳馆同一天，每个泳员最多一个 spot
    // 约束2：同一 (location, time) 只允许一个 group 占用（不混排）

    const assignedBySwimmer: { [name: string]: string[] } = {};
    const swimmerAssignedCount: { [name: string]: number } = {};
    const swimmerPoolDayAssigned: { [name: string]: Set<string> } = {}; // location||day

    Object.entries(swimmerMap).forEach(([name]) => {
      assignedBySwimmer[name] = [];
      swimmerAssignedCount[name] = 0;
      swimmerPoolDayAssigned[name] = new Set();
    });

    // 汇总所有 (location, time) 的 group 选项，并为每个时段挑选“占用组”
    type SlotGroupOpt = { location: string; time: string; group: string; weight: number; demandCount: number };
    const slotToGroupOpts: { [slotLT: string]: SlotGroupOpt[] } = {};

    for (const [location, timeMap] of Object.entries(weightedStats)) {
      for (const [time, groupMap] of Object.entries(timeMap)) {
        const lt = `${location}||${time}`;
        slotToGroupOpts[lt] = Object.entries(groupMap).map(([group, info]) => ({
          location,
          time,
          group,
          weight: info.weight,
          demandCount: info.swimmers.length,
        }))
        // 优先权：权重 > 报名人数
        .sort((a, b) => (b.weight !== a.weight ? b.weight - a.weight : b.demandCount - a.demandCount));
      }
    }

    // 形成“时段工作清单”：每个 (location,time) 只出现一次，按最高权重排序
    const workList = Object.values(slotToGroupOpts)
      .map((opts) => opts[0]) // 暂定首选占用组，若无法分配，再尝试备选组
      .sort((a, b) => (b.weight !== a.weight ? b.weight - a.weight : b.demandCount - a.demandCount));

    // 计算候选人灵活度：剩余可用的 “pool-day” 数（越少越优先）
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

    const slotAssignments: SlotAssignments = {};

    // 遍历每个 (location, time)，尝试用第一优先组分配；若该组没人可排，再尝试下一组
    for (const head of workList) {
      const lt = `${head.location}||${head.time}`;
      const groupOptions = slotToGroupOpts[lt]; // 按优先级已排序

      let assignedHere = 0;
      for (const { location, time, group } of groupOptions) {
        const info = weightedStats[location][time][group];

        // 候选：该组的泳员，尚未达最低周频，且这个泳馆这一天尚未被安排
        const candidates = info.swimmers.filter((name) => {
          const entry = swimmerMap[name];
          const required = getRequiredPerWeek(entry);
          const poolDayKey = poolDayKeyOf(location, time);
          return swimmerAssignedCount[name] < required && !swimmerPoolDayAssigned[name].has(poolDayKey);
        });

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

        // 填充该时段（只给这个 group）
        const sKey = slotKeyOf(location, time, group);
        for (const name of candidates) {
          const entry = swimmerMap[name];
          const required = getRequiredPerWeek(entry);
          if (swimmerAssignedCount[name] >= required) continue;

          if (!slotAssignments[sKey]) slotAssignments[sKey] = [];
          slotAssignments[sKey].push(name);
          assignedBySwimmer[name].push(sKey);
          swimmerAssignedCount[name]++;
          swimmerPoolDayAssigned[name].add(poolDayKeyOf(location, time));

          assignedHere++;
          if (assignedHere >= MAX_LANE_SIZE) break;
        }

        // 只要这个 group 在该时段成功分到至少1人，就不再尝试其他组（保证单组占用）
        if (assignedHere > 0) break;
        // 否则继续尝试下一个 group（仍然保持“每个时段最多只被一个 group 使用”）
      }
    }

    setStats(weightedStats);
    setAssignments(slotAssignments);
    setLoading(false);

    // 选得不够的人，打印到控制台（可改成 UI 提示）
    if (insufficientSelections.length) {
      // eslint-disable-next-line no-console
      console.warn("Selected fewer slots than required:", insufficientSelections);
    }
  };

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
                          <span className="text-gray-600"> {Math.ceil(weight / LANE_CAPACITY)} lanes</span>
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

          {/* 最终排班（时段只会显示一个组） */}
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-4">📅 Final Assignment</h2>
            {Object.keys(assignments).length === 0 ? (
              <p>No final assignments available.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {Object.entries(assignments).map(([slotKey, swimmers]) => {
                  const [location, time, group] = slotKey.split("||");
                  return (
                    <li key={slotKey} className="border-b pb-2">
                      <strong>{`${time} (${prettyGroup(group)}) @ ${location}`}</strong>: {swimmers.join(", ")}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
