// Explicit regeneration only: pass a baseline source file extracted with git show.
// Example: git show 5637cc24a1832652a91a18c24b76e3f71610cb46:warmwasser-schema-card.js > /tmp/warmwasser-baseline.js
//          node tests/helpers/generate-legacy-fixtures.cjs /tmp/warmwasser-baseline.js
const fs = require('node:fs');
const path = require('node:path');
const { cardClass, scenarios, render, hash, readSource } = require('./legacy-render.cjs');
if (process.argv.length !== 3) throw new Error('Pass the explicitly extracted baseline source file');
const baseline = readSource(process.argv[2]);
const baselineHash = 'b9d23f368617f4d0d858a43f28a2c80825517c948742a45cbe468c87bc11bfe1';
if (hash(baseline) !== baselineHash) {
  throw new Error(`Baseline SHA256 mismatch: expected ${baselineHash}, received ${hash(baseline)}. Extract the exact 5637cc24 source with git show.`);
}
const Card = cardClass(baseline);
const fixtures = Object.fromEntries(scenarios().map(s => [s.name, hash(render(Card, s))]));
fs.writeFileSync(path.join(__dirname, '../fixtures/legacy-render-sha256.json'), JSON.stringify(fixtures, null, 2) + '\n');
