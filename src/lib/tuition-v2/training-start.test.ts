import { computeTrainingRoster } from "../training-roster";
import { getBillableSessionsForSwimmer } from "./calculate-engine";
import { enrollmentForMonth, validTrainingStartDate } from "./enrollment-schedule";
import { upsertEnrollmentFromSwimmer, updateEnrollmentRegularWeekdays } from "./enrollment-service";
import { recalculateInvoices } from "./invoice-service";
import { ensureMonthInvoicesCurrent } from "./refresh-month";
import type { TuitionV2Session, TuitionV2SwimmerEnrollment } from "./types";
import type { Firestore } from "firebase-admin/firestore";
import { currentCalendarMonth, getNextMonth } from "./shared-ui";

function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
const swimmer: TuitionV2SwimmerEnrollment = {
  swimmerId: "julien", swimmerName: "Julien", level: "Bronze Beginner",
  parentName: "", parentEmail: "", regularWeekdays: [0],
  weekdaysByMonth: { "2026-10": [6] }, trainingStartDate: "2026-11-08",
};
function session(date: string, weekday: number): TuitionV2Session {
  return { id: date, date, weekday, level: swimmer.level, timeSlot: "5-6PM",
    location: "Pool", source: "generated", cancelled: false };
}
const sessions = [session("2026-10-03", 6), session("2026-11-01", 0),
  session("2026-11-08", 0), session("2026-11-15", 0)];
const october = enrollmentForMonth(swimmer, "2026-10");
assert(october.regularWeekdays[0] === 6, "October preview must resolve the same pinned Saturday as the roster");
assert(getBillableSessionsForSwimmer(october, sessions, null).length === 0, "No October training before November start");
const november = getBillableSessionsForSwimmer(enrollmentForMonth(swimmer, "2026-11"), sessions, null);
assert(november.map(s => s.date).join() === "2026-11-08,2026-11-15", "Start is inclusive and excludes earlier sessions in the same month");
const explicit = { sessionIds: new Set(sessions.map(s => s.id)), dateLevelKeys: new Set<string>() };
const extras = getBillableSessionsForSwimmer(swimmer, sessions, {swimmerId: swimmer.swimmerId, adjustments: [
  { type: "add_session", toSessionId: "2026-10-03" },
  { type: "swap_session", fromSessionId: "2026-11-15", toSessionId: "2026-11-01" },
]}, explicit);
assert(extras.every(s => s.date >= swimmer.trainingStartDate!), "Extra, add and swap must never bypass first date");
assert(extras.length === 1 && extras[0].date === "2026-11-08", "Skip/swap still apply after date filtering");
assert(getBillableSessionsForSwimmer({...swimmer, trainingStartDate: undefined, trainingStartRequired: true}, sessions, null).length === 0,
  "New swimmer without start date waits for staff");
assert(getBillableSessionsForSwimmer({...swimmer, trainingStartDate: undefined}, sessions, null).length === 3,
  "Legacy students without a recorded date retain existing sessions");
assert(validTrainingStartDate("2028-02-29") && !validTrainingStartDate("2026-02-29") && !validTrainingStartDate("2026-13-01"), "Validate real dates");

assert(getNextMonth(new Date("2026-10-31T12:00:00Z")) === "2026-11", "Month-end upgrade must not skip November");
assert(currentCalendarMonth(new Date("2026-11-01T02:00:00Z")) === "2026-10", "Effective month uses club timezone, not UTC");
assert(getNextMonth(new Date("2026-12-31T12:00:00Z")) === "2027-01", "Year rollover");

// Registration in October must not imply any October attendance.
for (const example of [
  { name: "Julien", start: "2026-11-01", weekday: 0, expected: "2026-11-01,2026-11-08,2026-11-15,2026-11-22,2026-11-29" },
  { name: "Matthew", start: "2026-11-02", weekday: 1, expected: "2026-11-02,2026-11-09,2026-11-16,2026-11-23,2026-11-30" },
]) {
  const person = {...swimmer, swimmerName: example.name, weekdaysByMonth: undefined,
    regularWeekdays: [example.weekday], trainingStartDate: example.start};
  const all: TuitionV2Session[] = [];
  for (const month of ["2026-10", "2026-11"]) {
    const [year, mo] = month.split("-").map(Number);
    for (let d=1; d<=new Date(year,mo,0).getDate(); d++) {
      all.push(session(`${month}-${String(d).padStart(2,"0")}`,new Date(year,mo-1,d).getDay()));
    }
  }
  const result = getBillableSessionsForSwimmer(person, all, null);
  assert(result.map(s=>s.date).join() === example.expected, `${example.name}: October registration, only eligible November sessions`);
}

async function testRosterSync() {
  let saved: Record<string, unknown> | undefined;
  const month = currentCalendarMonth();
  const old = {...swimmer, weekdaysByMonth: {[month]: [6]}, ratePerHourOverride: 42};
  const db = { collection(name: string) { return { doc() { return {
    async get() { return { exists: true, data() { return name === "swimmers"
      ? {level: "Bronze Performance", childFirstName: "Julien", trainingWeekdays: [2]}
      : old; } }; },
    async set(data: Record<string, unknown>) { saved = data; },
  }; } }; } } as unknown as Firestore;
  await upsertEnrollmentFromSwimmer(db, swimmer.swimmerId);
  assert(saved?.trainingStartDate === "2026-11-08", "Level changes preserve first training date");
  assert(JSON.stringify(saved?.regularWeekdays) === "[0]", "Roster updates preserve V2 days rather than copying V1");
  assert(saved?.ratePerHourOverride === 42, "Roster updates preserve pricing overrides");
  const pinned = enrollmentForMonth(saved as unknown as TuitionV2SwimmerEnrollment, month);
  assert(pinned.level === "Bronze Beginner" && pinned.regularWeekdays[0] === 6, "Level upgrade keeps current month plan");
}
async function testActualRoster() {
  const people: TuitionV2SwimmerEnrollment[] = [
    {...swimmer, swimmerId:"julien",swimmerName:"Julien",trainingStartDate:"2026-11-01"},
    {...swimmer,swimmerId:"matthew",swimmerName:"Matthew",regularWeekdays:[1],weekdaysByMonth:undefined,trainingStartDate:"2026-11-02"},
    {...swimmer,swimmerId:"upgrade",swimmerName:"Upgrade",trainingStartDate:undefined,
      level:"Bronze Performance",regularWeekdays:[2,4],levelByMonth:{"2026-10":"Bronze Beginner"}},
  ];
  const data = new Map<string, Record<string,unknown>>();
  for(const person of people) data.set(`tuition_v2_swimmer_enrollment/${person.swimmerId}`, person);
  for(const month of ["2026-10","2026-11"]) {
    data.set(`tuition_v2_months/${month}`,{noTrainingDates:[]});
    for(const [level,days,timeSlot] of [
      ["Bronze Beginner",[0,1,6],"4-5PM"], ["Bronze Performance",[2,4],"6:30-7:30PM"],
    ] as const) data.set(`tuition_v2_months/${month}/level_plans/${level}`,{
      weeklySlots:days.map(weekday=>({weekday,timeSlot,location:"Test pool"})),
    });
  }
  const snapshot = (path:string) => ({id:path.split("/").pop()!,exists:data.has(path),data:()=>data.get(path)});
  function collection(path:string): unknown {
    return {doc:(id:string)=>({get:async()=>snapshot(`${path}/${id}`),collection:(name:string)=>collection(`${path}/${id}/${name}`)}),
      get:async()=>({docs:[...data.keys()].filter(key=>key.startsWith(`${path}/`) && key.split("/").length===path.split("/").length+1).map(snapshot)})};
  }
  const db = {collection} as unknown as Firestore;
  const october = await computeTrainingRoster(db,"2026-10");
  const attendees = october.slots.flatMap(s=>s.levels.flatMap(l=>l.attendees));
  assert(attendees.every(a=>a.swimmerId!=="julien"&&a.swimmerId!=="matthew"),"Actual October roster excludes both new students by name");
  assert(october.slots.length===5 && october.slots.every(s=>s.weekday===6&&s.timeSlot==="4-5PM"),"Upgrade retains October Saturday time and level");
  const november = await computeTrainingRoster(db,"2026-11");
  const datesFor=(id:string)=>november.slots.filter(s=>s.levels.some(l=>l.attendees.some(a=>a.swimmerId===id))).map(s=>s.date);
  assert(datesFor("julien").join() === "2026-11-01,2026-11-08,2026-11-15,2026-11-22,2026-11-29","Actual November roster: Julien Sundays");
  assert(datesFor("matthew").join() === "2026-11-02,2026-11-09,2026-11-16,2026-11-23,2026-11-30","Actual November roster: Matthew Mondays from November 2");
  assert(datesFor("upgrade").length===8 && november.slots.filter(s=>s.levels.some(l=>l.attendees.some(a=>a.swimmerId==="upgrade"))).every(s=>s.timeSlot==="6:30-7:30PM"),"Actual November roster adopts new plan after upgrade");
}
async function testExplicitDateUpdatesOnlySelectedSwimmer() {
  const data = new Map<string, Record<string, unknown>>();
  const month = "2026-11";
  const enrollmentPath = "tuition_v2_swimmer_enrollment";
  const jasper = {...swimmer, swimmerId: "jasper", swimmerName: "Jasper",
    regularWeekdays: [1], trainingStartDate: "2026-11-01",
    weekdaysByMonth: {"2026-10": [6], [month]: [1]}};
  const other = {...jasper, swimmerId: "other", swimmerName: "Other"};
  data.set(`${enrollmentPath}/jasper`, jasper);
  data.set(`${enrollmentPath}/other`, other);
  data.set(`tuition_v2_months/${month}`, {status:"computed",noTrainingDates:[]});
  data.set(`tuition_v2_months/${month}/level_plans/${swimmer.level}`, {
    weeklySlots:[1,5].map(weekday=>({weekday,timeSlot:"5-6PM",location:"Pool"})),
  });
  const snap=(path:string)=>({id:path.split("/").pop()!,exists:data.has(path),data:()=>data.get(path)});
  const writes: string[] = [];
  function set(path:string,value:Record<string,unknown>) {
    writes.push(path); data.set(path,{...data.get(path),...value});
  }
  function collection(path:string):unknown { return {
    doc:(id:string)=>({path:`${path}/${id}`,get:async()=>snap(`${path}/${id}`),
      set:async(value:Record<string,unknown>)=>set(`${path}/${id}`,value),
      collection:(name:string)=>collection(`${path}/${id}/${name}`)}),
    get:async()=>({docs:[...data.keys()].filter(k=>k.startsWith(`${path}/`) &&
      k.split("/").length===path.split("/").length+1).map(snap)}),
  }; }
  function batch() { const b = {
    set(ref:{path:string},value:Record<string,unknown>){set(ref.path,value);return b;},
    update(ref:{path:string},value:Record<string,unknown>){set(ref.path,value);return b;},
    delete(ref:{path:string}){writes.push(ref.path);data.delete(ref.path);return b;},
    async commit(){},
  }; return b; }
  const db={collection,batch} as unknown as Firestore;
  await recalculateInvoices(db,month);
  const otherPaths=[`${enrollmentPath}/other`,`tuition_v2_months/${month}/invoices/other`];
  const before=otherPaths.map(path=>JSON.stringify(data.get(path)));
  writes.length=0;
  // Date already equals November 1: saving again must repair the stale pin.
  const updated=await updateEnrollmentRegularWeekdays(db,"jasper",[1,5],"2026-11-01");
  assert(updated && enrollmentForMonth(updated,month).regularWeekdays.join()==="1,5",
    "Explicit November date replaces the old November pin even when unchanged");
  assert(updated && enrollmentForMonth(updated,"2026-10").regularWeekdays.join()==="6",
    "Prior month training days remain unchanged");
  await recalculateInvoices(db,month,{swimmerIds:["jasper"]});
  const invoice=data.get(`tuition_v2_months/${month}/invoices/jasper`)!;
  assert(invoice.billableSessionCount===9,"Jasper bills all five Mondays and four Fridays in November");
  assert((invoice.lineItems as {date:string}[]).every(item=>item.date>="2026-11-01"),"No sessions before effective date");
  for (const [index,path] of otherPaths.entries()) {
    assert(JSON.stringify(data.get(path))===before[index],"Other swimmer data remains byte-for-byte unchanged");
    assert(!writes.includes(path),"No enrollment or invoice write for other swimmers");
  }
  // A partial month already has two invoices, so the old `length > 0`
  // shortcut would never generate the rest, even on repeated Review opens.
  data.set("tuition_v2_settings/default", {lastRosterSyncAt:new Date().toISOString()});
  data.set(`${enrollmentPath}/missing`, {...other,swimmerId:"missing",swimmerName:"Missing"});
  data.set(`${enrollmentPath}/inactive`, {...other,swimmerId:"inactive",active:false});
  data.set(`${enrollmentPath}/waiting`, {...other,swimmerId:"waiting",trainingStartDate:undefined,trainingStartRequired:true});
  const existingInvoicePaths=["jasper","other"].map(id=>`tuition_v2_months/${month}/invoices/${id}`);
  const originals=existingInvoicePaths.map(path=>JSON.stringify(data.get(path)));
  writes.length=0;
  const filled=await ensureMonthInvoicesCurrent(db,month,"test");
  assert(filled.invoices.length===3 && filled.invoices.some(i=>i.swimmerId==="missing"),
    "Review fills a partial month even when roster sync is skipped");
  assert(!filled.invoices.some(i=>["inactive","waiting"].includes(i.swimmerId)),
    "Inactive swimmers and swimmers awaiting a first date are not billed");
  for(const [index,path] of existingInvoicePaths.entries()) {
    assert(JSON.stringify(data.get(path))===originals[index] && !writes.includes(path),
      "Backfill must not rewrite either existing invoice");
  }
  writes.length=0;
  await ensureMonthInvoicesCurrent(db,month,"test");
  assert(!writes.some(path=>path.includes("/invoices/")),"Repeated Review opens do not rewrite invoices");
}
Promise.all([testRosterSync(),testActualRoster(),testExplicitDateUpdatesOnlySelectedSwimmer()]).then(() => console.log("training-start tests passed")).catch(e=>{console.error(e);process.exitCode=1;});
