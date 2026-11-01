const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("src/lib/setupStatus.js", "utf8");
async function moduleUnderTest() {
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}
function fixture() {
  return {
    settings: [{key:"brand_name",value:"Test business"},{key:"reference_timezone",value:"Europe/Paris"},{key:"app_base_url",value:"https://booking.example.test"}],
    types: [{id:"type",active:true,duration:30}],
    rules: [{day_of_week:1,active:true,start_time:"09:00",end_time:"17:00"}],
    pages: [{id:"page",status:"published",published_slug:"/",published_json:JSON.stringify({active:true,language_mode:"auto",booking_type_ids:["type"],headline_en:"Book",headline_fr:"Réserver",primary_cta_en:"Confirm",primary_cta_fr:"Confirmer"})}],
  };
}
test("an empty clone starts at identity and cannot be marked ready", async () => {
  const {setupStatus} = await moduleUnderTest();
  const status = setupStatus({});
  assert.equal(status.ready,false);
  assert.equal(status.next,0);
  assert.equal(status.completed,0);
});
test("readiness comes from published usable configuration, not a completion flag", async () => {
  const {setupStatus} = await moduleUnderTest();
  const data=fixture();
  assert.equal(setupStatus(data).ready,true);
  data.pages[0].status="draft";
  assert.equal(setupStatus(data).steps[3],false);
  data.pages[0].status="published";
  data.pages[0].published_json="{bad json";
  assert.equal(setupStatus(data).steps[3],false);
});
test("hidden, inactive and unscheduled types cannot make a page ready", async () => {
  const {setupStatus} = await moduleUnderTest();
  const data=fixture();
  data.rules[0].booking_type_id="another-type";
  assert.equal(setupStatus(data).ready,false);
  data.rules[0].booking_type_id="type";
  const snapshot=JSON.parse(data.pages[0].published_json);
  snapshot.type_overrides=[{booking_type_id:"type",visible:false}];
  data.pages[0].published_json=JSON.stringify(snapshot);
  assert.equal(setupStatus(data).steps[3],false);
  data.types[0].active=false;
  assert.equal(setupStatus(data).steps[1],false);
});
test("invalid dates, times and duplicate homepages remain incomplete", async () => {
  const {setupStatus,validPublicUrl,validTimezone} = await moduleUnderTest();
  assert.equal(validPublicUrl("javascript:alert(1)"),false);
  assert.equal(validPublicUrl("http://localhost:5173"),true);
  assert.equal(validPublicUrl("http://127.0.0.1:3001"),true);
  assert.equal(validPublicUrl("http://example.test"),false);
  assert.equal(validPublicUrl("https://user:password@example.test"),false);
  assert.equal(validPublicUrl("https://example.test/path"),false);
  assert.equal(validTimezone("invalid-zone"),false);
  const data=fixture();
  data.rules[0].start_time="25:00"; data.rules[0].end_time="26:00";
  assert.equal(setupStatus(data).steps[2],false);
  data.rules[0].start_time="09:00"; data.rules[0].end_time="17:00";
  data.pages.push({...data.pages[0],id:"duplicate"});
  assert.equal(setupStatus(data).steps[3],false);
});
