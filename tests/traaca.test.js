const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {parseTraacaEvents}=require('../scripts/refresh-events');
test('2027 headings do not inherit December 2026',()=>{
 const events=parseTraacaEvents(fs.readFileSync('raw/traaca-calendar.html','utf8'));
 const chili=events.find(e=>/chili/i.test(e.title));
 assert.ok(events.every(e=>e.endDate>=e.startDate));
 assert.ok(chili);assert.equal(chili.startDate.slice(0,10),'2027-10-02');
 assert.equal(events.filter(e=>/chili/i.test(e.title)&&e.startDate.startsWith('2026')).length,0);
 assert.ok(events.some(e=>e.startDate.startsWith('2026-12-13')));
 assert.ok(events.some(e=>e.startDate.startsWith('2027-01-09')));
});
test('unknown years are not inferred',()=>{
 assert.equal(parseTraacaEvents('<p><b>DECEMBER</b></p><li><b>3 - Chili Cookoff</b></li>').length,0);
});
