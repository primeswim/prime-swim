import { allowPnsCron } from "./pns-cron-auth";
import { runPnsSync, type PnsSyncStatus } from "./pns-sync";
import type { PnsScanResult } from "./service";
function assert(value: unknown, message: string) {if(!value) throw new Error(message);}
const empty: PnsScanResult = {count:1,created:0,updated:0,unchanged:1,skipped:0,createdMeets:[],updatedMeets:[]};
async function run() {
  assert(allowPnsCron(new Request("https://example.test",{headers:{authorization:"Bearer test-secret"}}),"test-secret"), "Scheduled bearer authentication works");
  assert(!allowPnsCron(new Request("https://example.test",{headers:{"x-vercel-cron":"1"}}),"test-secret"), "An unverified cron header cannot trigger scans or emails");
  assert(!allowPnsCron(new Request("https://example.test"),undefined), "Unconfigured cron does not silently bypass authentication");
  let status: PnsSyncStatus = {}, sent=0, fail=false, scanFail=false;
  let stats = {...empty};
  const keys: string[] = [];
  const deps = {
    scan:async()=>{if(scanFail) throw new Error("PNS unavailable"); return stats;},
    readStatus:async()=>status,
    saveStatus:async(patch:Partial<PnsSyncStatus>)=>{status={...status,...patch};},
    sendAlert:async(_:PnsScanResult,key:string)=>{keys.push(key);if(fail) throw new Error("Mail unavailable");sent++;},
    now:()=>"2026-10-29T15:00:00Z",
  };
  await runPnsSync(deps);
  assert(sent===0 && status.notificationStatus==="quiet", "No changes stays quiet");
  stats = {...empty, created:1,createdMeets:[{id:"new-meet",name:"New meet",diffs:[],revision:"v1"}]};
  fail=true;
  const failed = await runPnsSync(deps);
  assert(failed.notification==="failed" && status.pendingAlerts?.length===1, "Delivery failure preserves new draft for retry");
  assert(!!status.lastSucceededAt && !!status.notificationError, "Scan success and mail failure are tracked separately");
  const retryKey = keys[keys.length-1];
  fail=false;stats={...empty};
  await runPnsSync(deps);
  assert(sent===1 && status.pendingAlerts?.length===0, "Next unchanged scan retries the failed new-draft alert");
  assert(keys[keys.length-1]===retryKey, "Retry uses the same mail idempotency key");
  stats = {...empty,updated:1,updatedMeets:[{id:"changed",name:"Published meet",diffs:["announcement PDF changed"],revision:"v2"}]};
  await runPnsSync(deps);await runPnsSync(deps);
  assert(Number(sent)===2, "Pending update does not email repeatedly on unchanged scans");
  stats.updatedMeets[0].revision="v3";
  await runPnsSync(deps);
  assert(Number(sent)===3, "A second real PDF revision sends a new alert even with identical diff labels");
  scanFail=true;
  try {await runPnsSync(deps);throw new Error("Expected scan failure");}catch(e){assert((e as Error).message==="PNS unavailable","Original failure propagates");}
  assert(status.lastError==="PNS unavailable" && !!status.lastFailedAt, "Scan error is visible to admins");
  console.log("pns-sync tests passed");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
