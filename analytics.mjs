// Google Analytics is loaded only after an affirmative choice. Never send form fields.
const ID = "G-BX6KZWWSPL";
const KEY = "portfolio-analytics-choice";
const ALLOWED = new Set(["assessment_click", "diagnostic_click", "email_click", "form_start", "inquiry_attempt", "generate_lead", "inquiry_error"]);
// Only campaign values from the reviewed launch manifest are sent to Google.
const CAMPAIGNS = {
  utm_source:new Set(["facebook","gmb","instagram","linkedin","pinterest","tiktok","youtube"]),
  utm_medium:new Set(["social"]),
  utm_campaign:new Set(["aviator-brand-launch","launch-20261031","nov26-consulting-launch"]),
  utm_content:new Set(["automation","business-automation","integration","integrations","launch-facebook","launch-gmb","launch-linkedin","reporting","sql"])
};

export function campaign(search) {
  const p = new URLSearchParams(search); const result = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    const values = p.getAll(key);
    if (values.length === 1 && CAMPAIGNS[key].has(values[0])) result[key] = values[0];
  }
  return result;
}

export function setup(win, doc) {
  const banner = doc.querySelector("#analytics-consent");
  if (!banner) return;
  let active = false, started = false;
  const cleanLocation = win.location.origin + win.location.pathname;
  // Limit referrer to its origin; URLs and query strings can contain personal data.
  let referrer = "";
  try { const u = new URL(doc.referrer); if (u.protocol === "https:" || u.protocol === "http:") referrer = u.origin + "/"; } catch {}
  const attribution = campaign(win.location.search);
  let choice = "";
  try { choice = win.localStorage.getItem(KEY) || ""; } catch {}
  function emit(name) {
    if (active && ALLOWED.has(name)) win.gtag("event", name, {page_location:cleanLocation, page_referrer:referrer});
  }
  function activate() {
    if (active) return;
    active = true;
    win.dataLayer = win.dataLayer || [];
    win.gtag = function(){ win.dataLayer.push(arguments); };
    win.gtag("js", new Date());
    win.gtag("config", ID, {send_page_view:false, page_location:cleanLocation, page_referrer:referrer,
      allow_google_signals:false, allow_ad_personalization_signals:false,
      campaign_source:attribution.utm_source, campaign_medium:attribution.utm_medium,
      campaign_name:attribution.utm_campaign, campaign_content:attribution.utm_content});
    win.gtag("event", "page_view", {page_location:cleanLocation, page_referrer:referrer});
    const script = doc.createElement("script"); script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
    doc.head.appendChild(script);
  }
  function save(value) { try { win.localStorage.setItem(KEY,value); } catch {} }
  doc.querySelector("#analytics-accept").addEventListener("click",()=>{save("allow");banner.hidden=true;activate();});
  doc.querySelector("#analytics-decline").addEventListener("click",()=>{
    save("decline"); banner.hidden=true;
    // Expire this site's Google Analytics cookies at both common path scopes.
    for (const name of doc.cookie.split(";").map(c=>c.trim().split("=")[0]).filter(n=>/^_ga(?:_|$)/.test(n))) {
      for (const path of ["/", "/portfolio/"]) for (const domain of ["", "; domain="+win.location.hostname])
        doc.cookie = name+"=; Max-Age=0; path="+path+domain+"; SameSite=Lax";
    }
    if (active) { active=false; win["ga-disable-"+ID]=true; win.location.reload(); }
  });
  doc.querySelector("#analytics-settings").addEventListener("click",()=>{banner.hidden=false;});
  if (choice === "allow") activate(); else if (choice !== "decline") banner.hidden=false;
  doc.addEventListener("click",e=>{
    const link=e.target.closest?.("a"); if(!link) return;
    if(link.id === "assessment-cta") emit("assessment_click");
    if(link.id === "diagnostic-cta") emit("diagnostic_click");
    if((link.getAttribute("href")||"").startsWith("mailto:")) emit("email_click");
  });
  doc.querySelector("#lead-form")?.addEventListener("focusin",()=>{if(active&&!started){started=true;emit("form_start");}});
  win.addEventListener("portfolio-analytics",e=>emit(e.detail));
}
if (typeof window !== "undefined" && typeof document !== "undefined") setup(window,document);
