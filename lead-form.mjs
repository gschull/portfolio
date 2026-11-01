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
async function loadTurnstile() {
 if(window.turnstile)return window.turnstile;
 await new Promise((resolve,reject)=>{
  const script=document.createElement("script");
  script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async=true;script.onload=resolve;script.onerror=reject;document.head.appendChild(script);
 });
 if(!window.turnstile)throw new Error("Turnstile unavailable");
 return window.turnstile;
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
 let turnstile;
 shell.hidden=false; // Turnstile must render into a measurable visible element.
 try{
  turnstile=await loadTurnstile();
  widgetId=turnstile.render("#lead-turnstile",{
   sitekey:config.turnstileSiteKey,action:"lead_inquiry",
   callback:token=>{challengeToken=token;},
   "expired-callback":()=>{challengeToken="";},
   "error-callback":()=>{challengeToken="";status.textContent="Verification unavailable. Please use email.";}
  });
 }catch{shell.hidden=true;return}
 form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!form.reportValidity())return;
  if(!challengeToken){status.dataset.state="error";status.textContent="Complete the anti-spam verification first.";return;}
  submit.disabled=true;
  status.textContent="Submitting your request...";
  status.dataset.state="";
  const fields=new FormData(form);
  const data=payload(fields,window.location.search,challengeToken,crypto.randomUUID());
  try{
   const resp=await fetch(config.apiBaseUrl+"/api/inquiries",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(data),signal:AbortSignal.timeout(15000)
   });
   const result=await resp.json().catch(()=>({}));
   if(!resp.ok||!result.ok)throw new Error(result.error||"Request could not be submitted");
   form.reset();
   status.dataset.state="success";
   status.textContent="Inquiry received. I will reply to the email address provided.";
  }catch(err){
   status.dataset.state="error";
   status.textContent=(err.message||"Submission failed")+". Please try again or use the email link.";
  }finally{
   submit.disabled=false;challengeToken="";
   if(turnstile&&widgetId!==null)turnstile.reset(widgetId);
  }
 });
}
if(typeof window!=="undefined"&&typeof document!=="undefined")initialize();
