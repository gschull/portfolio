import test from "node:test";
import assert from "node:assert/strict";
import {campaignFromSearch,configured,payload,createRequestIdTracker,lockInquiryFields,loadTurnstile} from "../lead-form.mjs";
test("a stalled verification script times out so the form can fall back to email",async()=>{
 let removed=false;
 const script={remove(){removed=true;}};
 const doc={createElement:()=>script,head:{appendChild(){}}};
 await assert.rejects(loadTurnstile({},doc,5),/timed out/);
 assert.equal(removed,true);
});
test("portfolio campaign tags are validated and have no duplicate parameters",()=>{
 assert.deepEqual(campaignFromSearch("?utm_source=linkedin&utm_campaign=aviator-brand-launch"),{utm_source:"linkedin",utm_campaign:"aviator-brand-launch"});
 assert.deepEqual(campaignFromSearch("?utm_source=first&utm_source=second"),{});
 assert.deepEqual(campaignFromSearch("?utm_source=first%0Aevil"),{});
});
test("form remains unavailable without a real HTTPS backend and public site key",()=>{
 assert.equal(configured({apiBaseUrl:"",turnstileSiteKey:""}),false);
 assert.equal(configured({apiBaseUrl:"http://insecure.test",turnstileSiteKey:"0123456789abc"}),false);
 assert.equal(configured({apiBaseUrl:"https://worker.example.workers.dev",turnstileSiteKey:"0123456789abc"}),true);
 assert.equal(configured({apiBaseUrl:"javascript:alert(1)",turnstileSiteKey:"0123456789abc"}),false);
});
test("payload includes exactly form fields and source metadata",()=>{
 const fields=new URLSearchParams({name:"Example Client",email:"client@example.org",organization:"Example Ltd",service:"sql-reporting",message:"Please repair and reconcile the report logic.",consent:"on",website:""});
 const result=payload(fields,"?utm_source=facebook&utm_campaign=pilot","verified-turnstile","uuid-test");
 assert.equal(result.consent,true);
 assert.equal(result.utm_source,"facebook");
 assert.equal(result.message,"Please repair and reconcile the report logic.");
 assert.equal(result.turnstileToken,"verified-turnstile");
});
test("retries reuse a request ID until inquiry details change or submission succeeds",()=>{
 let next=0;
 const tracker=createRequestIdTracker(()=>`request-${++next}`);
 assert.equal(tracker.get(),"request-1");
 assert.equal(tracker.get(),"request-1");
 tracker.reset();
 assert.equal(tracker.get(),"request-2");
 assert.equal(tracker.get(),"request-2");
});
test("inquiry fields stay unchanged while a request is in flight and recover their prior state",()=>{
 const fields=[{disabled:false},{disabled:true},{disabled:false}];
 const unlock=lockInquiryFields({querySelectorAll:()=>fields});
 assert.deepEqual(fields.map(field=>field.disabled),[true,true,true]);
 unlock();
 assert.deepEqual(fields.map(field=>field.disabled),[false,true,false]);
});
