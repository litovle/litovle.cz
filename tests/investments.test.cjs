const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../rozpocet/investments-model.js');
const fixture = require('./fixtures/investments.cjs');
const prepare = f => M.prepare(f.snapshot, f.amendments);

test('public investment comparison stays gated until official totals and populations exist', () => {
  const snapshot = JSON.parse(fs.readFileSync('assets/rozpocet/2026-investments.json'));
  const amendments = JSON.parse(fs.readFileSync('assets/rozpocet/2026.json'));
  assert.deepEqual(M.prepare(snapshot, amendments),{ready:false,reason:'missing_opening'});
});
test('opening allocations plus signed changes reconcile across places and categories', () => {
  const f=fixture(), p=prepare(f);
  assert.equal(p.ready,true);
  const september=M.overview(p,9,'301'),october=M.overview(p,10,'301');
  assert.equal(september.scopedTotal,70000);
  assert.equal(october.scopedTotal,1070000);
  assert.equal(october.total,2300000);
  assert.equal(october.unassigned,210000);
  assert.equal(october.places.reduce((n,p)=>n+p.total,0)+october.unassigned,october.total);
  assert.equal(october.categories.reduce((n,c)=>n+c.value,0),october.scopedTotal);
  assert.equal(october.places.find(p=>p.id==='301').per_person_minor,10700);
  assert.equal(october.allocations[0].amount_minor,1070000);
  assert.equal(october.allocations[0].sources.length,4);
  assert.deepEqual(october.timeline.map(e=>e.value),[90000,70000,1070000]);
  const all=M.overview(p,10);
  assert.equal(all.categories.reduce((n,c)=>n+c.value,0),all.total);
  assert.ok(all.categories.length>5);
});
test('amendments already present in the opening snapshot are counted exactly once', () => {
  const f=fixture();
  f.snapshot.opening.included_document_ids=['RO/1/2026'];
  f.snapshot.opening.rows[0].amount_minor-=10000;
  f.snapshot.opening.rows[1].amount_minor+=10000;
  f.snapshot.opening.control.by_place['301']-=10000;
  f.snapshot.opening.control.by_place['302']+=10000;
  const p=prepare(f);
  assert.equal(p.ready,true);
  const view=M.overview(p,10,'301');
  assert.equal(view.scopedTotal,1070000);
  assert.equal(view.opening,90000);
  assert.equal(view.timeline.length,2);
});
test('transfers do not inflate citywide investment and mixed-locality rows stay isolated', () => {
  const p=prepare(fixture());
  assert.equal(M.overview(p,9).total,1300000);
  assert.equal(M.overview(p,9,'302').scopedTotal,120000);
  assert.equal(M.overview(p,9,'unassigned').scopedTotal,210000);
  assert.equal(M.overview(p,9,'302').timeline.at(-1).change,10000);
});
test('category grouping uses official ODPA divisions, including investment contributions', () => {
  assert.equal(M.category({codes:{ODPA:' 2219 ',POL:'6351'},description:'Kanalizace'}),'Doprava');
  assert.equal(M.category({codes:{ODPA:'2321'}}),'Voda a kanalizace');
  assert.equal(M.category({codes:{ODPA:'9999'}}),'Ostatní investice');
});
test('missing evidence, incomplete populations and failed controls never become zero figures', () => {
  const cases=[
    f=>{f.snapshot.opening=null;}, f=>{f.snapshot.population=null;}, f=>{f.snapshot.reconciliation=null;},
    f=>{delete f.snapshot.population.by_place['311'];}, f=>{f.snapshot.population.by_place['301']=0;},
    f=>{f.snapshot.population.date='2026-02-01';}, f=>{f.snapshot.opening.complete=false;},
    f=>{f.snapshot.opening.rows[0].verified=false;}, f=>{f.snapshot.opening.rows[0].amount_minor=1.5;},
    f=>{f.snapshot.opening.rows[0].codes.POL='5171';}, f=>{f.snapshot.opening.rows.push(f.snapshot.opening.rows[0]);},
    f=>{f.snapshot.opening.control.by_place['301']++;}, f=>{delete f.snapshot.opening.control.by_place.unassigned;},
    f=>{f.snapshot.reconciliation.total_minor++;}, f=>{f.snapshot.reconciliation.date='2026-09-30';},
    f=>{f.snapshot.reconciliation.by_place['301']++;}, f=>{f.snapshot.scope='gross_expenditure';},
    f=>{f.amendments.coverage.unresolved_rows=1;}, f=>{f.amendments.documents.pop();},
    f=>{f.amendments.documents[1].budget_changes.verified=false;},
    f=>{f.amendments.entries[0].rows.pop();}, f=>{f.amendments.entries[0].rows[0].codes.POL='5171';},
    f=>{f.amendments.entries[0].rows[0].id='pre-1';},
    f=>{f.snapshot.opening.included_document_ids=['RO/3/2026'];},
    f=>{f.snapshot.opening.approved_date='2025-12-12';},
    f=>{f.snapshot.opening.source.url='javascript:alert(1)';}
  ];
  cases.forEach((mutate,index)=>{const f=fixture();mutate(f);assert.equal(prepare(f).ready,false,'case '+index);});
  assert.equal(M.overview({ready:false},10),null);
});
test('a verified empty locality has zero direct allocation without being treated as missing', () => {
  const f=fixture();
  f.snapshot.opening.rows=f.snapshot.opening.rows.filter(r=>r.codes.ORJ!=='311');
  f.snapshot.opening.control.total_minor-=100000;
  f.snapshot.opening.control.by_place['311']=0;
  f.snapshot.reconciliation.total_minor-=100000;
  f.snapshot.reconciliation.by_place['311']=0;
  const p=prepare(f);
  assert.equal(p.ready,true);
  const v=M.overview(p,10,'311');
  assert.equal(v.scopedTotal,0);
  assert.equal(v.places.find(p=>p.id==='311').per_person_minor,0);
  assert.deepEqual(v.allocations,[]);
});
test('negative remaining allocations suppress the affected period rather than drawing misleading bars', () => {
  const f=fixture();
  const p=prepare(f);
  p.changes.push({...p.changes[0],amount_minor:-200000,date:'2026-02-01',approval_date:'2026-02-01'});
  assert.equal(M.overview(p,2,'301'),null);
});
