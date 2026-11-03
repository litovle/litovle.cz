// Synthetic accounting fixtures. Never exported into the public assets directory.
module.exports = function fixture() {
  const B = require('../../rozpocet/model.js');
  const M = require('../../rozpocet/investments-model.js');
  const ids = Object.keys(B.localParts);
  const source = {title: 'Synthetic official-source fixture', url: 'https://example.test/budget.pdf',copy:'/assets/rozpocet/synthetic-test.pdf',sha256:'0'.repeat(64)};
  const codes = ['2219','2321','3113','3412','3315','3613','3726','2115','6171','1014','5512'];
  const row = (id, place, amount, odpa = codes[ids.indexOf(place)] || '2219') => ({
    id, amount_minor: amount, codes: {POL:'6121', ODPA:odpa, ...(place === 'unassigned' ? {} : {ORJ:place})},
    category:'capital', verified:true, description:'Synthetic allocation ' + place, source_page:1
  });
  const rows = ids.map((id, index) => row('opening-' + id, id, 100000));
  rows.push(row('opening-unassigned', 'unassigned', 200000));
  const controls = rows => ({total_minor:rows.reduce((n,r)=>n+r.amount_minor,0), by_place:Object.fromEntries([...ids,'unassigned'].map(id=>[id,rows.filter(r=>B.locality(r)===id).reduce((n,r)=>n+r.amount_minor,0)])), source});
  const specs = [
    ['RO/1/2026','2025-12-11',[row('pre-1','301',-10000),row('pre-2','302',10000)]],
    ['RO/2/2026','2026-01-29',[row('jan-1','301',-20000),row('jan-2','302',10000),row('jan-3','unassigned',10000)]],
    ['RO/3/2026','2026-10-01',[row('oct-1','301',1000000)]]
  ];
  const entries = specs.map(([id,date,rows])=>({id,document_id:id,rz_id:id,approval_date:date,href:'/rozpoctova-opatreni/'+id.replaceAll('/','-')+'/',rows}));
  const snapshot = {schema_version:1,year:2026,scope:M.scope,
    opening:{approved_date:'2025-12-11',complete:true,included_document_ids:[],source,rows,control:controls(rows)},
    population:{date:'2026-01-01',definition:'Synthetic resident population.',source,by_place:Object.fromEntries(ids.map((id,index)=>[id,100+index*10]))},
    reconciliation:{date:'2026-10-01',...controls([...rows,...entries.flatMap(e=>e.rows)])}
  };
  const amendments = {schema_version:1,year:2026,latest_approval_date:'2026-10-01',
    entries:entries.slice(1),earlier_entries:entries.slice(0,1),later_entries:[],
    documents:entries.map(e=>({id:e.document_id,approval_date:e.approval_date,href:e.href,
      budget_changes:{income_minor:0,expenditure_minor:e.rows.reduce((n,r)=>n+r.amount_minor,0),financing_minor:e.rows.reduce((n,r)=>n+r.amount_minor,0),row_count:e.rows.length,verified:true,balanced:true}})),
    coverage:{documents:3,source_rows:6,dispositions:{capital:6},unresolved_rows:0}
  };
  return {snapshot,amendments};
};
