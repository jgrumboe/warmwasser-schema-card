const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { cardClass, scenarios, render, hash, readSource } = require('./helpers/legacy-render.cjs');
const expected = require('./fixtures/legacy-render-sha256.json');
const Card = cardClass(readSource(path.join(__dirname, '../warmwasser-schema-card.js')));
const cases = scenarios();
test('legacy render fixture covers every scenario exactly once', () => {
  assert.deepEqual(cases.map(c => c.name).sort(), Object.keys(expected).sort());
});
for (const scenario of cases) {
  test(`legacy render: ${scenario.name}`, () => {
    const output = render(Card, scenario);
    const actual = hash(output);
    if (actual !== expected[scenario.name]) {
      assert.fail(`Complete _render output changed for ${scenario.name}\nExpected SHA256: ${expected[scenario.name]}\nActual SHA256: ${actual}\nActual output:\n${output}`);
    }
  });
}

test('minimal configuration matches the card stub', () => {
  const stub = JSON.parse(JSON.stringify(Card.getStubConfig()));
  assert.deepEqual(stub, scenarios().find(s => s.name === 'minimal-stub-config').config);
});

test('full system exposes detail and control targets', () => {
  const html = render(Card, scenarios().find(s => s.name === 'full-system-getrennt'));
  for (const target of ['sensor.power', 'sensor.valve', 'sensor.energy', 'sensor.top', 'sensor.bottom', 'sensor.mixer', 'sensor.mode']) {
    assert.ok(html.includes(`data-more="${target}"`), `missing detail target ${target}`);
  }
  assert.ok(html.includes('data-act="zirk"'));
  assert.ok(html.includes('data-act="modus"'));
});

test('migrated component scenarios preserve their detail and control targets', () => {
  const targets = {
    'water/getrennt/both': ['data-act="zirk"', 'data-more="sensor.temp"', 'data-more="sensor.energy"'],
    'source-combination/gas/getrennt/on': ['data-act="modus"', 'data-more="sensor.pump"', 'data-more="sensor.valve"'],
    'wp-source/sole/wp-false/source-true': ['data-more="sensor.top"', 'data-more="sensor.bottom"'],
    'heaters/step': ['data-more="sensor.mixer"', 'data-more="sensor.power"', 'data-more="sensor.top"', 'data-more="sensor.bottom"'],
  };
  for (const [name, attributes] of Object.entries(targets)) {
    const html = render(Card, cases.find(s => s.name === name));
    for (const attribute of attributes) assert.ok(html.includes(attribute), `${name}: missing ${attribute}`);
  }
});
