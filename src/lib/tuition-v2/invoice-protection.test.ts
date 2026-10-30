import type { Firestore } from "firebase-admin/firestore";
import { recalculateInvoices } from "./invoice-service";
import { isFinalizedTuitionInvoice } from "./invoice-protection";
import type { TuitionV2Invoice } from "./types";
function assert(value:unknown,message:string){if(!value)throw new Error(message);}
async function run(){
  const data=new Map<string,Record<string,unknown>>();
  const writes:string[]=[];
  const month="2026-10";
  data.set(`tuition_v2_months/${month}`,{status:"computed",noTrainingDates:[]});
  data.set(`tuition_v2_months/${month}/level_plans/Bronze Beginner`,{weeklySlots:[{weekday:0,timeSlot:"5-6PM",location:"Test pool"}]});
  for(const [id,flags] of Object.entries({legacy:{},draft:{},paid:{paid:true},sent:{emailStatus:"sent"},published:{publishedToApp:true},manual:{manualOverride:{amount:175,reason:"Staff adjustment"}}})) {
    data.set(`tuition_v2_swimmer_enrollment/${id}`,{swimmerId:id,swimmerName:id,level:"Bronze Beginner",regularWeekdays:[0],active:true,
      ...(id!=="legacy"?{trainingStartDate:"2026-11-01"}:{})});
    data.set(`tuition_v2_months/${month}/invoices/${id}`,{swimmerId:id,swimmerName:id,level:"Bronze Beginner",parentName:"",parentEmail:"",regularWeekdays:[0],
      ratePerHour:60,rateTier:"normal",rateTierReason:"Existing",billableSessionCount:4,amount:240,baseAmount:240,
      lineItems:[3,10,17,24].map(day=>({date:`2026-10-${String(day).padStart(2,"0")}`,timeSlot:"5-6PM",location:"Test pool",amount:60})),
      practiceText:"Original record",dueDate:"2026-10-01",months:["October 2026"],afterFeeNote:"Keep note",paid:false,paidOn:null,emailStatus:"pending",...flags});
  }
  const finalizedBefore=new Map(["paid","sent","published","manual"].map(id=>[id,JSON.stringify(data.get(`tuition_v2_months/${month}/invoices/${id}`))]));
  const snap=(path:string)=>({id:path.split("/").pop()!,exists:data.has(path),data:()=>data.get(path)});
  function collection(path:string):unknown{return {doc:(id:string)=>({path:`${path}/${id}`,get:async()=>snap(`${path}/${id}`),collection:(name:string)=>collection(`${path}/${id}/${name}`)}),
    get:async()=>({docs:[...data.keys()].filter(k=>k.startsWith(`${path}/`)&&k.split("/").length===path.split("/").length+1).map(snap)})};}
  function batch(){const b={set(ref:{path:string},value:Record<string,unknown>){writes.push(ref.path);data.set(ref.path,{...data.get(ref.path),...value});return b;},
    update(ref:{path:string},value:Record<string,unknown>){return b.set(ref,value);},delete(ref:{path:string}){writes.push(ref.path);data.delete(ref.path);return b;},async commit(){}};return b;}
  const db={collection,batch} as unknown as Firestore;
  await recalculateInvoices(db,month,{preserveFinalizedInvoices:true});
  for(const [id,original] of finalizedBefore){assert(JSON.stringify(data.get(`tuition_v2_months/${month}/invoices/${id}`))===original,`${id} invoice preserved byte-for-byte`);assert(!writes.includes(`tuition_v2_months/${month}/invoices/${id}`),`${id} invoice has no writes`);}
  const legacy=data.get(`tuition_v2_months/${month}/invoices/legacy`)!;
  assert(legacy.amount===240&&legacy.billableSessionCount===4,"Legacy student keeps the same monthly tuition and count");
  const draft=data.get(`tuition_v2_months/${month}/invoices/draft`)!;
  assert(draft.amount===0&&draft.billableSessionCount===0,"Unsent draft phantom courses are cleared before the start date");
  assert(draft.afterFeeNote==="Keep note","Staff note is retained");
  assert(!isFinalizedTuitionInvoice(undefined),"Missing invoice is not finalized");
  console.log("invoice-protection tests passed");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
