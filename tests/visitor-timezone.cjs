const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
async function mod() {
 return import("data:text/javascript;base64," + Buffer.from(fs.readFileSync("src/lib/visitorTimezone.js","utf8")).toString("base64"));
}
const slot = start_at => ({start_at,end_at:new Date(Date.parse(start_at)+1800000).toISOString()});
test("a guest west of UTC sees an after-midnight slot on the previous day",async()=>{
 const {visitorDays}=await mod();
 const original=slot("2030-01-02T00:30:00Z");
 const days=visitorDays([{date:"2030-01-02",slots:[original]}],"America/Los_Angeles","en");
 const day=days.find(d=>d.slots.length);
 assert.equal(day.date,"2030-01-01");
 assert.match(day.slots[0].label,/16:30/);
 assert.equal(day.slots[0].start_at,original.start_at);
});
test("a guest east of UTC sees late slots on the following day",async()=>{
 const {visitorDays}=await mod();
 const days=visitorDays([{date:"2030-01-01",slots:[slot("2030-01-01T23:30:00Z")]}],"Asia/Tokyo","fr");
 const day=days.find(d=>d.slots.length);
 assert.equal(day.date,"2030-01-02");
 assert.match(day.slots[0].label,/08:30/);
});
test("DST repeated wall-clock times have distinct offsets and UTC identities",async()=>{
 const {visitorDays}=await mod();
 const days=visitorDays([{date:"2026-10-25",slots:[slot("2026-10-25T00:30:00Z"),slot("2026-10-25T01:30:00Z")]}],"Europe/Paris","en");
 const slots=days.find(d=>d.slots.length).slots;
 assert.match(slots[0].label,/02:30/); assert.match(slots[1].label,/02:30/);
 assert.equal(slots[0].label,slots[1].label);
 assert.notEqual(slots[0].offset,slots[1].offset);
 assert.notEqual(slots[0].start_at,slots[1].start_at);
});
test("invalid zone is rejected and UTC plus the active alias are selectable",async()=>{
 const {validZone,timezoneChoices}=await mod();
 assert.equal(validZone("not/a-zone"),false);
 assert.equal(validZone("UTC"),true);
 const zones=timezoneChoices("US/Eastern");
 assert(zones.includes("UTC")); assert(zones.includes("US/Eastern"));
});
