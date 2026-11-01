import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const script=readFileSync(new URL("../lead-form.mjs",import.meta.url),"utf8");
test("assessment is prominent and private form precedes service catalog",()=>{
 assert.match(html,/id="assessment-cta"/);assert.match(html,/id="diagnostic-cta"/);
 assert.ok(html.indexOf('id="project-inquiry"')<html.indexOf('id="services"'));
 assert.match(html,/\$295/);assert.match(html,/Up to two hours of remote investigation/);
});
test("select uses the existing server-supported service code",()=>{
 assert.match(html,/<option value="other">Paid diagnostic \/ something else<\/option>/);
 assert.doesNotMatch(html,/<option value="paid-diagnostic">/);
});
test("fallback remains accessible without configured backend or Turnstile",()=>{
 assert.match(html,/id="assessment-cta" href="mailto:/);
 assert.match(script,/link\.href="#project-inquiry"/);
 assert.match(script,/if\(assessmentCta\)assessmentCta\.href="mailto:/);
});