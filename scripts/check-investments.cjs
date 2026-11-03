// Read-only publication check. The default accepts the explicit awaiting-sources state.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const M = require('../rozpocet/investments-model.js');
const root = path.resolve(__dirname, '..');
try {
  const snapshot = JSON.parse(fs.readFileSync(path.join(root,'assets/rozpocet/2026-investments.json')));
  const amendments = JSON.parse(fs.readFileSync(path.join(root,'assets/rozpocet/2026.json')));
  const result = M.prepare(snapshot,amendments);
  if (!result.ready) {
    const awaiting = result.reason === 'missing_opening' && snapshot.status === 'awaiting_sources' && snapshot.opening === null && snapshot.population === null && snapshot.reconciliation === null;
    console.log('Investment comparison withheld: '+result.reason);
    process.exitCode = awaiting && !process.argv.includes('--require-ready') ? 0 : 1;
  } else {
    for (const source of result.sources) {
      const bytes = fs.readFileSync(path.join(root,source.copy));
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error('Archived source hash mismatch: '+source.copy);
    }
    console.log('Investment comparison reconciled through '+result.latest_date+'; archived sources verified.');
  }
} catch (error) {
  console.error('Investment comparison check failed: '+error.message);
  process.exitCode = 1;
}
