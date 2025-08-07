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
  [swimmerName: string]: string[]; // selected time slots
}

export default function TrainingSurveyStatsWeighted() {
  const [stats, setStats] = useState<WeightedStats>({});
  const [assignments, setAssignments] = useState<AssignmentMap>({});
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
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

    snapshot.forEach((doc) => {
      const data = doc.data() as SurveyEntry;
      if (!data.preferences || data.preferences.length === 0) return;
      if (!data.timesPerWeek) return;

      swimmerMap[data.swimmerName] = data;

      const totalChoices = data.preferences.reduce((acc, pref) => acc + pref.timeSlots.length, 0);
      if (totalChoices === 0) return;

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
              timesPerWeek: data.timesPerWeek
            });
          }
        }
      }
    });

    // Auto assignment logic
    const assigned: AssignmentMap = {};
    const swimmerAssignedCount: { [name: string]: number } = {};
    Object.entries(swimmerMap).forEach(([name, entry]) => {
      swimmerAssignedCount[name] = 0;
      assigned[name] = [];
    });

    const allSlots: { location: string; time: string; count: number }[] = [];
    for (const [location, timeMap] of Object.entries(weightedStats)) {
      for (const [time, info] of Object.entries(timeMap)) {
        allSlots.push({ location, time, count: info.swimmers.length });
      }
    }
    allSlots.sort((a, b) => b.count - a.count);

    const slotAssignments: { [key: string]: string[] } = {};

    for (const { location, time } of allSlots) {
      const key = `${time}-${location}`;
      const slot = weightedStats[location][time];
      let count = 0;

      for (const swimmer of slot.swimmers) {
        const entry = swimmerMap[swimmer];
        if (
          swimmerAssignedCount[swimmer] < entry.timesPerWeek &&
          !assigned[swimmer].some(slot => slot.startsWith(time.split(" ")[0]))
        ) {
          assigned[swimmer].push(key);
          swimmerAssignedCount[swimmer]++;
          if (!slotAssignments[key]) slotAssignments[key] = [];
          slotAssignments[key].push(swimmer);
          count++;
          if (count >= MAX_LANE_SIZE) break;
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
          {/* Demand section */}
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

          {/* Assignment section */}
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-4">📅 Final Assignment</h2>
            {Object.entries(assignments).length === 0 ? (
              <p>No final assignments available.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {Object.entries(assignments).map(([slot, swimmers]) => {
                  const [day, time, ...rest] = slot.split(" ");
                  const location = rest.join(" ");
                  return (
                    <li key={slot} className="border-b pb-2">
                      <strong>{`${day} ${time} @ ${location}`}</strong>:{" "}
                      {swimmers.join(", ")}
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
