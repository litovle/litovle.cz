const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const M = require('../rozpocet/model.js');
const row = (amount, category = 'capital') => ({amount_minor: amount, category, codes: {}, description: 'Zdrojový popis'});
const entry = (date, rows, id = '1/2026/ZM') => ({id, rz_id: id, document_id: 'RO/1/2026', approval_date: date, notes: [], rows, href: '/rozpoctova-opatreni/RO-1-2026/#rz-1-2026-zm'});
const data = {entries: [entry('2026-09-01', [row(50000)]), entry('2026-10-01', [row(100000000), row(-1000)]), entry('2026-10-01', [row(5000, 'operating'), row(99999, 'internal_transfer'), row(80000, 'unresolved')], '2/2026/RM')]};

test('October jump leaves September unchanged and preserves signed amounts', () => {
  assert.equal(M.series(data, 'capital', 9).net, 50000);
  assert.equal(M.series(data, 'capital', 10).net, 100049000);
  assert.equal(M.series(data, 'capital', 10).steps.at(-1).change, 99999000);
  assert.equal(M.series(data, 'all', 10).net, 100054000);
});
test('same-day changes aggregate, and transfers and reductions can cancel out', () => {
  const d = {entries: [entry('2026-01-03', [row(-10000), row(10000)]), entry('2026-01-03', [row(200), row(-400)], '2')]};
  assert.deepEqual(M.series(d, 'capital', 1).steps, [{date:'2026-01-03',change:-200,value:-200}]);
  assert.equal(M.visibleEntries(d, {month:1,mode:'capital'}).length, 2);
});
test('filters and accent-insensitive search leave the underlying chart unchanged', () => {
  const d = {entries: [entry('2026-09-01', [{...row(1),description:'Oprava chodníku v Savíně'}]), ...data.entries]};
  assert.equal(M.visibleEntries(d, {month:10,mode:'capital',query:'savine'}).length, 1);
  assert.equal(M.visibleEntries(d, {month:10,mode:'capital',date:'2026-10-01'}).length, 2);
  assert.equal(M.visibleEntries(d, {month:9,mode:'capital',onlyMonth:true}).length, 2);
  assert.equal(M.series(d,'capital',10).net,100049001);
});
test('URL round trip validates category and month, preserving search', () => {
  const state = {month:9,mode:'all',query:'Savín & Nová Ves'};
  assert.deepEqual(M.fromUrl(M.toUrl(state),10),{...state,place:'all',date:'',onlyMonth:false});
  assert.equal(M.fromUrl('?month=12&mode=bad',10).month,10);
  assert.equal(M.fromUrl('?month=-1',10).month,10);
  assert.equal(M.fromUrl('?month=1.2',10).mode,'capital');
});
test('local-part filtering uses only ORJ and isolates rows of mixed amendments', () => {
  const coded=(amount,code,description)=>({...row(amount),codes:code===undefined?{}:{ORJ:code},description});
  const mixed=entry('2026-10-01',[
    coded(10000,'311','Savín - přímo přiřazená investice'),
    coded(-2500,'311','Savín - snížení'),
    coded(90000,'303','Nová Ves - další řádek téže RZ'),
    coded(80000,undefined,'Savín v popisu bez kódu'),
    coded(70000,'999','Společná infrastruktura'),
  ]);
  const d={entries:[mixed]};
  const state={month:10,mode:'capital',place:'311'};
  const selected=M.visibleEntries(d,state);
  assert.equal(selected.length,1);
  assert.equal(selected[0].rows.length,2);
  assert.deepEqual(M.totals(mixed,'capital','311'),{increase:10000,reduction:-2500,net:7500});
  assert.equal(M.series(d,'capital',10,'311').net,7500);
  assert.equal(M.series(d,'capital',10,'unassigned').net,150000);
  assert.equal(mixed.rows.length,5,'source entry remains intact');
  const csv=M.csv(selected,'capital','311');
  assert.match(csv,/"75\.00"/);
  assert.match(csv,/Savín/);
  assert.doesNotMatch(csv,/Nová Ves|bez kódu|Společná infrastruktura/);
  assert.equal(M.locality(coded(1,' 311 ','test')),'311');
  assert.equal(M.fromUrl('?place=311',10).place,'311');
  assert.equal(M.fromUrl('?place=unassigned',10).place,'unassigned');
  assert.equal(M.fromUrl('?place=constructor',10).place,'all');
  assert.equal(M.fromUrl('?place=999',10).place,'all');
  assert.equal(new URLSearchParams(M.toUrl({...state,query:'vodovod'})).get('place'),'311');
  assert.equal(M.visibleEntries(d,{...state,place:'306'}).length,0);
});
test('all locality groups reconcile to the complete municipal amounts', () => {
  const d=JSON.parse(fs.readFileSync('assets/rozpocet/2026.json'));
  for(const mode of ['capital','all']){
    const groups=[...Object.keys(M.localParts),'unassigned'];
    assert.equal(groups.reduce((n,place)=>n+M.series(d,mode,10,place).net,0),M.series(d,mode,10).net);
    const state={month:10,mode,place:'311'};
    const visible=M.visibleEntries(d,state);
    assert.ok(visible.length>0);
    assert.ok(visible.every(e=>e.rows.every(r=>r.codes.ORJ==='311')));
    assert.equal(visible.reduce((n,e)=>n+M.totals(e,mode).net,0),M.series(d,mode,10,'311').net);
  }
});
test('CSV uses the same totals, quotes descriptions, and protects spreadsheet cells', () => {
  const e = entry('2026-01-01',[{...row(-12345),description:'=SUM(1;2) "quoted"\nsecond line'}]);
  const text = M.csv([e],'capital');
  assert.ok(text.startsWith('\uFEFF'));
  assert.match(text,/"-123\.45"/);
  assert.match(text,/"'=SUM\(1;2\) ""quoted""/);
  assert.match(text,/https:\/\/litovle.cz\/rozpoctova-opatreni/);
});
test('published dataset reconciles rows, documents, categories and RZ source anchors', () => {
  const d=JSON.parse(fs.readFileSync('assets/rozpocet/2026.json'));
  const review=JSON.parse(fs.readFileSync('assets/rozpocet/2026-review.json'));
  assert.equal(d.coverage.documents,17);
  assert.equal(new Set(d.documents.map(doc=>doc.id)).size,17);
  assert.equal(d.coverage.source_rows,review.rows.length);
  assert.equal(Object.values(d.coverage.dispositions).reduce((a,b)=>a+b,0),review.rows.length);
  assert.equal(d.coverage.unresolved_absolute_minor,review.rows.filter(r=>r.category==='unresolved').reduce((a,r)=>a+Math.abs(r.amount_minor),0));
  for(const e of d.entries){
    assert.ok(e.approval_date.startsWith('2026-'));
    for(const r of e.rows)assert.ok(Number.isSafeInteger(r.amount_minor));
    const anchor=e.href.split('#')[1];
    const source=fs.readFileSync('.'+e.href.split('#')[0]+'index.html','utf8');
    if(anchor)assert.ok(source.includes('id="'+anchor+'"'),e.href);
  }
  for(const mode of ['capital','all']){
    assert.equal(M.series(d,mode,12).net,d.entries.reduce((n,e)=>n+M.totals(e,mode).net,0));
  }
});
test('approved whole budget matches its archived source and reconciles sectors and funds', () => {
  const approved=JSON.parse(fs.readFileSync('assets/rozpocet/2026-approved.json'));
  const digest=crypto.createHash('sha256').update(fs.readFileSync('.'+approved.source_copy)).digest('hex');
  assert.equal(digest,approved.source_sha256);
  assert.equal(approved.scopes.combined.income_minor,44411357400);
  assert.equal(approved.scopes.combined.expenditure_minor,70581356300);
  assert.equal(approved.scopes.combined.financing_minor,26169998900);
  assert.equal(approved.expenditure_sectors.reduce((sum,s)=>sum+s.amount_minor,0),approved.scopes.main.expenditure_minor);
  for(const key of ['income_minor','expenditure_minor','financing_minor']) {
    assert.equal(approved.scopes.main[key]+approved.scopes.funds[key],approved.scopes.combined[key]);
  }
  for(const scope of Object.values(approved.scopes)) assert.equal(scope.income_minor+scope.financing_minor,scope.expenditure_minor);
  assert.ok(fs.existsSync('.'+approved.resolution_href+'index.html'));
});
test('whole budget includes original amounts and all verified amendments through the chosen date', () => {
  const approved=JSON.parse(fs.readFileSync('assets/rozpocet/2026-approved.json'));
  const d=JSON.parse(fs.readFileSync('assets/rozpocet/2026.json'));
  const october=M.budgetOverview(approved,d,10);
  assert.equal(october.date,'2026-10-01');
  assert.equal(october.documentCount,17);
  assert.deepEqual(october.current,{income_minor:51190721727,expenditure_minor:84367931745,financing_minor:33177210018});
  const january=M.budgetOverview(approved,d,1);
  assert.equal(january.documentCount,2,'includes the balanced pre-January amendment');
  assert.equal(january.current.expenditure_minor,approved.scopes.combined.expenditure_minor+57674200);
  assert.equal(october.current.income_minor+october.current.financing_minor,october.current.expenditure_minor);
  const sourceRows=JSON.parse(fs.readFileSync('assets/rozpocet/2026-review.json')).rows;
  for(const doc of d.documents){
    const rows=sourceRows.filter(r=>r.document_id===doc.id);
    assert.equal(doc.budget_changes.row_count,rows.length);
    const expenses=rows.filter(r=>/^[56]/.test(r.codes.POL)).reduce((sum,r)=>sum+r.amount_minor,0);
    assert.equal(doc.budget_changes.expenditure_minor,expenses);
  }
});
test('whole budget suppresses reconstructed totals when verification or row coverage fails', () => {
  const approved=JSON.parse(fs.readFileSync('assets/rozpocet/2026-approved.json'));
  const original=JSON.parse(fs.readFileSync('assets/rozpocet/2026.json'));
  for(const mutate of [
    d=>{d.documents[1].budget_changes.verified=false;},
    d=>{d.documents[1].budget_changes.income_minor+=100;},
    d=>{delete d.documents[1].budget_changes;},
    d=>{d.coverage.source_rows+=1;},
  ]){
    const d=structuredClone(original);mutate(d);
    const result=M.budgetOverview(approved,d,10);
    assert.equal(result.current,null);
    assert.equal(result.initial.expenditure_minor,70581356300);
  }
  assert.equal(M.budgetOverview({...approved,year:2025},original,10),null);
});
