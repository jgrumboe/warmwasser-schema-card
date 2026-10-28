const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const registry = new Map();
const context = { HTMLElement: class {}, customElements: { get: (name) => registry.get(name), define: (name, ctor) => registry.set(name, ctor) }, window: {}, console: { info() {} } };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../warmwasser-schema-card.js'), 'utf8'), context);
const Card = registry.get('warmwasser-schema-card');
const render = (typ, trennung = 50, withModule = true) => {
  const card = new Card();
  card.setConfig({ speicher: { typ, trennung }, fm: withModule ? { pumpe: 'binary_sensor.fm' } : undefined, wp: { betrieb: 'binary_sensor.wp' } });
  card._hass = { states: { 'binary_sensor.fm': { state: 'on' } }, language: 'de' };
  return card._render();
};

test('separate tanks return the fresh-water module to the hot-water tank', () => {
  for (const split of [35, 50, 70]) {
    const svg = render('getrennt', split);
    const returnY = 40 + 310 * split / 100 - 32 - 14;
    assert.ok(svg.includes(`M452 90H458Q466 90 466 98V120H315V${returnY}H206`));
    assert.ok(!svg.includes('H145Q137 390 137 382V376'));
  }
});

test('hot-water charging pipe jumps over the fresh-water return only at a crossing', () => {
  assert.ok(render('getrennt', 50).includes('H323A8 8 0 0 1 307 128'));
  for (const svg of [render('getrennt', 35), render('getrennt', 50, false), render('schicht')]) {
    assert.ok(!svg.includes('H323A8 8 0 0 1 307 128'));
    assert.ok(svg.includes('H308Q300 128 300 120'));
  }
});

test('a shared tank keeps its original bottom return', () => {
  for (const typ of ['schicht', 'trennblech']) {
    assert.ok(render(typ).includes('M452 90H458Q466 90 466 98V382Q466 390 458 390H145Q137 390 137 382V376'));
  }
});
