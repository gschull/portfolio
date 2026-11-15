/* Public form. Never includes API secrets; local email fallback remains visible. */
const SAFE_TAG=/^[a-z0-9][a-z0-9._-]{0,63}$/i;
export function campaignFromSearch(search){
 const params=new URLSearchParams(search||"");
 const out={};
 for(const key of ["utm_source","utm_medium","utm_campaign","utm_content"]){
  const values=params.getAll(key);
  if(values.length===1 && SAFE_TAG.test(values[0]))out[key]=values[0];
 }
 return out;
}
export function configured(cfg) {
 if(!cfg||typeof cfg.turnstileSiteKey!=="string"||! /^[a-z0-9_-]{10,256}$/i.test(cfg.turnstileSiteKey))return false;
 try {
  const url=new URL(cfg.apiBaseUrl);
  return url.protocol==="https:" && !url.username && !url.password &&
   url.origin===url.href.replace(/\/$/,"") && !!url.hostname && !url.search;
 }catch{return false;}
}
export function payload(fields,search,token,requestId){
 const values=Object.fromEntries(["name","email","organization","service","message","website"].map(k=>[k,String(fields.get(k)||"")]));
 return {...values,consent:fields.get("consent")!==null,turnstileToken:token,requestId,
  ...campaignFromSearch(search)};
}
export function createRequestIdTracker(makeId){
 let id="";
 return {get(){return id||(id=makeId());},reset(){id="";}};
}
export function lockInquiryFields(form){
 const controls=Array.from(form.querySelectorAll("input, select, textarea"));
 const wasDisabled=controls.map(control=>control.disabled);
 controls.forEach(control=>{control.disabled=true;});
 return ()=>controls.forEach((control,index)=>{control.disabled=wasDisabled[index];});
}
export async function loadTurnstile(win,doc,timeoutMs=12000) {
 if(win.turnstile)return win.turnstile;
 await new Promise((resolve,reject)=>{
  const script=doc.createElement("script");
  const timer=setTimeout(()=>{script.remove();reject(new Error("Turnstile timed out"));},timeoutMs);
  const finish=callback=>()=>{clearTimeout(timer);callback();};
  script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async=true;script.onload=finish(resolve);script.onerror=finish(()=>reject(new Error("Turnstile unavailable")));doc.head.appendChild(script);
 });
 if(!win.turnstile)throw new Error("Turnstile unavailable");
 return win.turnstile;
}
async function initialize(){
 const shell=document.querySelector("#project-inquiry");
 const form=document.querySelector("#lead-form");
 if(!shell||!form)return;
 let config;
 try {
  const res=await fetch("./data/lead-config.json",{cache:"no-store"});
  if(!res.ok)return;
  config=await res.json();
 }catch{return}
 if(!configured(config))return; // leave reliable email CTA visible
 const status=document.querySelector("#lead-status");
 const submit=document.querySelector("#lead-send");
 let widgetId=null;
 let challengeToken="";
 let verificationFailed=false;
 let turnstile;
 const requestIds=createRequestIdTracker(()=>crypto.randomUUID());
 // A retry of unchanged details must use the same ID if the first response was lost.
 form.addEventListener("input",()=>requestIds.reset());
 form.addEventListener("change",()=>requestIds.reset());
 shell.hidden=false; // Turnstile must render into a measurable visible element.
 const assessmentCta=document.querySelector("#assessment-cta");
 const diagnosticCta=document.querySelector("#diagnostic-cta");
 for(const link of [assessmentCta,diagnosticCta]){ if(link)link.href="#project-inquiry"; }

 try{
  turnstile=await loadTurnstile(window,document);
  widgetId=turnstile.render("#lead-turnstile",{
   sitekey:config.turnstileSiteKey,action:"lead_inquiry",
   callback:token=>{challengeToken=token;verificationFailed=false;if(status.dataset.state==="verification-error"){status.textContent="";status.dataset.state="";}},
   "expired-callback":()=>{challengeToken="";},
   "error-callback":()=>{challengeToken="";verificationFailed=true;status.dataset.state="verification-error";status.textContent="Verification unavailable. Please use the email link below.";}
  });
 }catch{
  shell.hidden=true;
  if(assessmentCta)assessmentCta.href="mailto:glschull@gmail.com?subject=Project%20assessment%20inquiry";
  if(diagnosticCta)diagnosticCta.href="mailto:glschull@gmail.com?subject=SQL%20and%20Automation%20Diagnostic";
  return;
 }
 form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!form.reportValidity())return;
  if(!challengeToken){status.dataset.state=verificationFailed?"verification-error":"error";status.textContent=verificationFailed?"Verification unavailable. Please use the email link below.":"Complete the anti-spam verification first.";return;}
  window.dispatchEvent(new CustomEvent("portfolio-analytics",{detail:"inquiry_attempt"}));
  submit.disabled=true;
  status.textContent="Submitting your request...";
  status.dataset.state="";
  let unlock=()=>{};
  try{
   const fields=new FormData(form);
   const data=payload(fields,window.location.search,challengeToken,requestIds.get());
   unlock=lockInquiryFields(form);
   const resp=await fetch(config.apiBaseUrl+"/api/inquiries",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(data),signal:AbortSignal.timeout(15000)
   });
   const result=await resp.json().catch(()=>({}));
   if(!resp.ok||!result.ok)throw new Error(result.error||"Request could not be submitted");
   form.reset();requestIds.reset();
   status.dataset.state="success";
   status.textContent="Inquiry received. I will reply to the email address provided.";
   window.dispatchEvent(new CustomEvent("portfolio-analytics",{detail:"generate_lead"}));
  }catch(err){
   status.dataset.state="error";
   status.textContent=(err.message||"Submission failed")+". Please try again or use the email link.";
   window.dispatchEvent(new CustomEvent("portfolio-analytics",{detail:"inquiry_error"}));
  }finally{
   unlock();submit.disabled=false;challengeToken="";
   if(turnstile&&widgetId!==null)turnstile.reset(widgetId);
  }
 });
}
if(typeof window!=="undefined"&&typeof document!=="undefined")initialize();
