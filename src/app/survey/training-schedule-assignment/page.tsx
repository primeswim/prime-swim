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

interface SurveyEntry {
  swimmerName: string;
  timesPerWeek: number;
  preferences: Preference[];
}

interface WeightedStats {
  [location: string]: {
    [timeSlot: string]: {
      weight: number;
      swimmers: string[];
      swimmerDetails?: { name: string; timesPerWeek: number }[];
    };
  };
}

interface AssignmentMap {
  [swimmerName: string]: string[]; // per-swimmer selected slot keys (for调试/观测)
}

interface SlotAssignments {
  [slotKey: string]: string[]; // "location||time" -> ["Alice", "Bob", ...]
}

// —— 工具函数：从 "Wed 8–9pm" 提取星期 —— //
const getDayFromTime = (t: string) => t.split(" ")[0]; // "Mon" | "Tue" | "Wed" ...

export default function TrainingSurveyStatsWeighted() {
  const [stats, setStats] = useState<WeightedStats>({});
  const [assignments, setAssignments] = useState<SlotAssignments>({});
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  // 需求/容量参数
  const LANE_CAPACITY = 4;
  const MAX_LANE_SIZE = 6;

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

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as SurveyEntry;
      if (!data?.preferences?.length) return;
      if (!data.timesPerWeek) return;

      swimmerMap[data.swimmerName] = data;

      const totalChoices = data.preferences.reduce((acc, pref) => acc + pref.timeSlots.length, 0);
      if (totalChoices === 0) return;

      // 每个被选时段的权重 = timesPerWeek / 总选择数
      const weight = data.timesPerWeek / totalChoices;

      for (const pref of data.preferences) {
        if (!weightedStats[pref.location]) weightedStats[pref.location] = {};
        for (const slot of pref.timeSlots) {
          if (!weightedStats[pref.location][slot]) {
            weightedStats[pref.location][slot] = { weight: 0, swimmers: [], swimmerDetails: [] };
          }
          weightedStats[pref.location][slot].weight += weight;

          if (!weightedStats[pref.location][slot].swimmers.includes(data.swimmerName)) {
            weightedStats[pref.location][slot].swimmers.push(data.swimmerName);
            weightedStats[pref.location][slot].swimmerDetails?.push({
              name: data.swimmerName,
              timesPerWeek: data.timesPerWeek,
            });
          }
        }
      }
    });

    // —— 自动排班：同一天只给每位泳员安排一次 —— //
    const assignedBySwimmer: AssignmentMap = {};
    const swimmerAssignedCount: { [name: string]: number } = {};
    const swimmerDayAssigned: { [name: string]: Set<string> } = {}; // 记录每个泳员已占用的“星期”

    Object.keys(swimmerMap).forEach((name) => {
      swimmerAssignedCount[name] = 0;
      assignedBySwimmer[name] = [];
      swimmerDayAssigned[name] = new Set();
    });

    // 所有时段，按需求人数降序（优先分配需求高的）
    const allSlots: { location: string; time: string; count: number }[] = [];
    for (const [location, timeMap] of Object.entries(weightedStats)) {
      for (const [time, info] of Object.entries(timeMap)) {
        allSlots.push({ location, time, count: info.swimmers.length });
      }
    }
    allSlots.sort((a, b) => b.count - a.count);

    // 最终结果：slot -> swimmers
    const slotAssignments: SlotAssignments = {};

    for (const { location, time } of allSlots) {
      const slotKey = `${location}||${time}`; // 清晰分隔，便于展示解析
      const slotInfo = weightedStats[location][time];

      let filled = 0;
      for (const swimmer of slotInfo.swimmers) {
        const entry = swimmerMap[swimmer];
        const day = getDayFromTime(time);

        if (
          swimmerAssignedCount[swimmer] < entry.timesPerWeek &&
          !swimmerDayAssigned[swimmer].has(day) // 同一天不重复
        ) {
          assignedBySwimmer[swimmer].push(slotKey);
          swimmerAssignedCount[swimmer]++;
          swimmerDayAssigned[swimmer].add(day);

          if (!slotAssignments[slotKey]) slotAssignments[slotKey] = [];
          slotAssignments[slotKey].push(swimmer);

          filled++;
          if (filled >= MAX_LANE_SIZE) break; // 达到该时段泳道上限
        }
      }
    }

    setStats(weightedStats);
    setAssignments(slotAssignments);
    setLoading(false);
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
          {/* 需求统计 */}
          {Object.entries(stats).map(([location, slots]) => (
            <div key={location} className="mb-6 border border-gray-300 rounded-md p-4">
              <h2 className="text-lg font-semibold mb-3">🏊 {location}</h2>
              <ul className="space-y-3">
                {Object.entries(slots).map(([time, { weight, swimmerDetails }]) => (
                  <li key={time}>
                    <div className="flex justify-between items-center">
                      <span>{time}</span>
                      <span>
                        <strong>{weight.toFixed(1)}</strong> demand →
                        <span className="text-sm text-gray-600">
                          {" "}
                          {Math.ceil(weight / LANE_CAPACITY)} lanes
                        </span>
                      </span>
                    </div>
                    {swimmerDetails && swimmerDetails.length > 0 && (
                      <div className="text-sm text-gray-700 mt-1">
                        👤 {swimmerDetails.map((s) => `${s.name} (${s.timesPerWeek})`).join(", ")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* 最终排班 */}
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-4">📅 Final Assignment</h2>
            {Object.keys(assignments).length === 0 ? (
              <p>No final assignments available.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {Object.entries(assignments).map(([slotKey, swimmers]) => {
                  const [location, time] = slotKey.split("||");
                  return (
                    <li key={slotKey} className="border-b pb-2">
                      <strong>{`${time} @ ${location}`}</strong>: {swimmers.join(", ")}
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
