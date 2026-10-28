const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const registry = new Map();
const context = { HTMLElement: class {}, customElements: { get: (name) => registry.get(name), define: (name, ctor) => registry.set(name, ctor) }, window: {}, console: { info() {} } };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../warmwasser-schema-card.js'), 'utf8'), context);
const Card = registry.get('warmwasser-schema-card');
const render = (typ, trennung = 50) => {
  const card = new Card();
  card.setConfig({ speicher: { typ, trennung }, fm: { pumpe: 'binary_sensor.fm' } });
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

test('a shared tank keeps its original bottom return', () => {
  for (const typ of ['schicht', 'trennblech']) {
    assert.ok(render(typ).includes('M452 90H458Q466 90 466 98V382Q466 390 458 390H145Q137 390 137 382V376'));
  }
});
