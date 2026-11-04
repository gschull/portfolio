import test from "node:test";
import assert from "node:assert/strict";
import {campaign,setup} from "../analytics.mjs";

test("campaign parameters reject duplicates and personal-looking values",()=>{
  assert.deepEqual(campaign("?utm_source=facebook&utm_medium=social&utm_content=person%40example.com&utm_campaign=x&utm_campaign=y"),{utm_source:"facebook",utm_medium:"social"});
});
test("analytics waits for consent, emits only allowed events, and strips URL details",()=>{
  const nodes = Object.fromEntries(["#analytics-consent","#analytics-accept","#analytics-decline","#analytics-settings","#lead-form"].map(k=>[k,{hidden:true,handlers:{},addEventListener(n,f){this.handlers[n]=f;}}]));
  const scripts=[], handlers={};
  const doc={referrer:"https://example.com/private?email=secret",cookie:"",querySelector:s=>nodes[s],addEventListener:(n,f)=>handlers[n]=f,createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}};
  const values={}; const win={location:{origin:"https://site.test",pathname:"/portfolio/",search:"?utm_source=linkedin&email=secret",hostname:"site.test",reload(){}},localStorage:{getItem:k=>values[k],setItem:(k,v)=>values[k]=v},addEventListener:(n,f)=>handlers[n]=f};
  setup(win,doc); assert.equal(scripts.length,0); assert.equal(nodes["#analytics-consent"].hidden,false);
  nodes["#lead-form"].handlers.focusin();
  handlers["portfolio-analytics"]({detail:"generate_lead"}); assert.equal(win.dataLayer,undefined);
  nodes["#analytics-accept"].handlers.click(); assert.equal(scripts.length,1);
  nodes["#lead-form"].handlers.focusin(); nodes["#lead-form"].handlers.focusin();
  handlers["portfolio-analytics"]({detail:"generate_lead"}); handlers["portfolio-analytics"]({detail:"arbitrary private text"});
  const calls=win.dataLayer.map(x=>Array.from(x));
  assert.equal(calls.filter(x=>x[1]==="form_start").length,1);
  assert.equal(calls.filter(x=>x[1]==="generate_lead").length,1);
  assert.ok(!JSON.stringify(calls).includes("secret")); assert.ok(!JSON.stringify(calls).includes("arbitrary private text"));
  assert.equal(calls.find(x=>x[1]==="page_view")[2].page_referrer,"https://example.com/");
  nodes["#analytics-decline"].handlers.click(); handlers["portfolio-analytics"]({detail:"generate_lead"});
  assert.equal(win.dataLayer.map(x=>Array.from(x)).filter(x=>x[1]==="generate_lead").length,1);
});
