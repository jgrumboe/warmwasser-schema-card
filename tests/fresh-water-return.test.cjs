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
    const radius = Math.min(8, Math.max(0, (returnY - 98) / 2));
    assert.ok(svg.includes(`M336 90H323Q315 90 315 98V${returnY - radius}Q315 ${returnY} ${315 - radius} ${returnY}H206`));
    assert.ok(svg.includes('<rect x="332" y="84" width="10" height="12"'));
    assert.ok(!svg.includes('<rect x="448" y="84" width="10" height="12"'));
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

test('supply valve renders combined or separate returns without changing the default', () => {
  const make = (position, returns, valve) => {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt' }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil: 'sensor.valve', ventil_position: position, ruecklauf_anbindung: returns }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'off' }, 'binary_sensor.hk': { state: 'on' }, 'sensor.valve': { state: valve } } };
    return card._render();
  };
  const combined = make('vorlauf', 'gemeinsam', 'Warmwasser');
  const separate = make('vorlauf', 'getrennt', 'Puffer');
  const legacy = make(undefined, undefined, 'Puffer');
  assert.ok(combined.includes('M310 308.5H326'));
  assert.ok(!combined.includes('M206 340H312Q320'));
  assert.ok(separate.includes('M206 340H312Q320'));
  assert.ok(!separate.includes('M310 308.5H326'));
  assert.ok(legacy.includes('M277 282.5H326'));
  assert.ok(combined.includes('M400 372V540Q400 552'));
  assert.ok(!combined.includes('M400 372V381A9 9'));
  assert.ok(combined.includes('H305A5 5 0 0 1 315 254.75'));
  assert.ok(combined.includes('H318V178Q318 170 326 170'));
  const animated = (svg, path) => svg.includes(`d="${path}" class="w3"`);
  const bufferPath = 'M206 227H216V260.75Q216 268.75 224 268.75H262';
  assert.equal(animated(make('vorlauf', 'gemeinsam', 'Puffer'), bufferPath), true);
  assert.equal(animated(combined, bufferPath), false);
  assert.equal(animated(make('vorlauf', 'gemeinsam', 'unknown'), bufferPath), true);
});

test('separate heating circuit connects to left side of buffer and removes old lower bridges', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] });
  card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
  const svg = card._render();
  assert.ok(svg.includes('M70 227H60V412Q60 420 68 420H130'));
  assert.ok(svg.includes('M70 340H68A8 8 0 0 1 52 340H40V440Q40 448 48 448H130'));
  assert.ok(!svg.includes('295 399'));
  assert.ok(svg.includes('d="M70 227H60V412Q60 420 68 420H130" class="w3"'));
});
