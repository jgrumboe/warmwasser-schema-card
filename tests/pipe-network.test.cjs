const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const registry = new Map();
const context = { HTMLElement: class {}, customElements: { get: (name) => registry.get(name), define: (name, ctor) => registry.set(name, ctor) }, window: {}, console: { info() {} } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../warmwasser-schema-card.js'), 'utf8'), context);
const Card = registry.get('warmwasser-schema-card');

function network({ tank = 'getrennt', valve = 'vorlauf', returns = 'gemeinsam', target = 'Warmwasser' } = {}) {
  const card = new Card();
  card.setConfig({ speicher: { typ: tank }, wp: { betrieb: 'binary_sensor.wp', ventil: 'sensor.valve', ventil_position: valve, ruecklauf_anbindung: returns }, fm: { pumpe: 'binary_sensor.fm' } });
  card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' }, 'sensor.valve': { state: target } } };
  card._render();
  return card._pipeNetwork;
}
const edge = (n, id) => n.pipes.find((p) => p.id === id);

test('separate storage connects the fresh-water return to the hot-water tank', () => {
  const n = network();
  assert.equal(edge(n, 'fm_return').from, 'fm.return');
  assert.equal(edge(n, 'fm_return').to, 'ww.fm_return');
  assert.equal(n.ports.get('ww.fm_return').x, 206);
  assert.ok(n.ports.get('ww.fm_return').y < n.ports.get('buffer.wp_return').y);
  assert.equal(edge(n, 'fm_return').active, true);
});

test('common and separate returns have distinct connections to the heat pump', () => {
  const common = network();
  assert.equal(edge(common, 'ww_return').to, 'return.junction');
  assert.equal(edge(common, 'buffer_return').to, 'return.junction');
  assert.equal(edge(common, 'combined_return').to, 'wp.return');
  const separate = network({ returns: 'getrennt' });
  assert.equal(edge(separate, 'ww_return').to, 'wp.return');
  assert.equal(edge(separate, 'buffer_return').to, 'wp.buffer_return');
  assert.equal(edge(separate, 'combined_return'), undefined);
});

test('valve placement changes which side of the circuit is switched', () => {
  const supply = network({ target: 'Puffer' });
  assert.equal(edge(supply, 'ww_supply').to, 'valve.top');
  assert.equal(edge(supply, 'buffer_supply').to, 'valve.bottom');
  assert.equal(edge(supply, 'ww_supply').active, false);
  assert.equal(edge(supply, 'buffer_supply').active, true);
  const ret = network({ valve: 'ruecklauf' });
  assert.equal(edge(ret, 'ww_return').to, 'valve.top');
  assert.equal(edge(ret, 'buffer_return').to, 'valve.bottom');
  assert.equal(edge(ret, 'wp_return').from, 'valve.side');
});

test('fresh-water pipes follow the module ports and keep rounded return bends', () => {
  const n = network();
  const feed = edge(n, 'fm_supply'), ret = edge(n, 'fm_return');
  n.ports.get('fm.supply').x += 40;
  n.ports.get('fm.return').x += 40;
  const pathFor = (p) => p.route(n.ports.get(p.from), n.ports.get(p.to));
  assert.equal(pathFor(feed), 'M206 46H376');
  assert.match(pathFor(ret), /^M376 90H323Q315 90 315 98/);
  assert.match(pathFor(ret), /Q315 [\d.]+ 307 [\d.]+H206$/);
});

test('saved offsets move the heat pump and module connections without changing their topology', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt' }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf', typ: 'sole' }, fm: { pumpe: 'binary_sensor.fm' }, layout: { version: 1, wp: { x: 40 }, fm: { x: 60 } } });
  card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' } } };
  const svg = card._render();
  const n = card._pipeNetwork;
  assert.equal(n.ports.get('wp.supply').x, 366);
  assert.equal(n.ports.get('fm.supply').x, 396);
  assert.match(svg, /data-component="wp" transform="translate\(40 0\)"/);
  assert.match(svg, /data-component="fm" transform="translate\(60 0\)"/);
  assert.equal(edge(n, 'combined_return').to, 'wp.return');
  assert.match(edge(n, 'combined_return').route(n.ports.get('return.junction'), n.ports.get('wp.return')), /H366$/);
});

test('unknown layout versions leave the original positions unchanged', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt' }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, layout: { version: 2, wp: { x: 80 }, fm: { x: 80 } } });
  card._hass = { language: 'de', states: {} };
  card._render();
  assert.equal(card._pipeNetwork.ports.get('wp.supply').x, 326);
  assert.equal(card._pipeNetwork.ports.get('fm.supply').x, 336);
});

test('storage offsets keep the heat pump, fresh water and heating circuit attached', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, speicher: { x: -40 } } });
  card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
  const svg = card._render();
  assert.equal(card._pipeNetwork.ports.get('buffer.wp_return').x, 166);
  assert.equal(card._pipeNetwork.ports.get('ww.fm_supply').x, 166);
  assert.match(svg, /data-component="speicher" transform="translate\(-40 0\)"/);
  for (const id of ['hk_supply', 'hk_return']) {
    const p = edge(card._pipeNetwork, id), a = card._pipeNetwork.ports.get(p.from), b = card._pipeNetwork.ports.get(p.to);
    const d = p.route(a, b);
    assert.ok(d.startsWith(`M${a.x} ${a.y}`));
    assert.ok(d.endsWith(`H${b.x}`));
  }
});

test('valve offsets move all three valve ports and their routes together', () => {
  for (const offset of [-15, 15]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, ventil: { y: offset } } });
    card._hass = { language: 'de', states: {} };
    card._render();
    const n = card._pipeNetwork, y = 254.75 + offset;
    assert.equal(n.ports.get('valve.top').y, y - 14);
    assert.equal(n.ports.get('valve.bottom').y, y + 14);
    assert.equal(n.ports.get('valve.side').y, y);
    assert.ok(edge(n, 'wp_supply').route(n.ports.get('valve.side'), n.ports.get('wp.supply')).startsWith(`M277 ${y}`));
  }
});

test('heating circuit offsets move the outlet while keeping the distribution pipes connected', () => {
  for (const x of [-60, 60]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, heizkreise: [{ name: 'HK', pumpe: 'binary_sensor.hk', typ: 'heizkoerper' }], layout: { version: 1, heizkreis: { x } } });
    card._hass = { language: 'de', states: { 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render();
    const n = card._pipeNetwork;
    assert.equal(n.ports.get('hc.supply').x, 130 + x);
    assert.equal(n.ports.get('hc.return').x, 130 + x);
    assert.ok(svg.includes(`transform="translate(${x} 0)"`));
    assert.equal(card._routingError, false);
  }
});

test('all modelled pipe paths terminate at their named ports across layout limits', () => {
  const endpoint = d => {
    let x, y;
    for (const [, cmd, numbers] of d.matchAll(/([MHVQA])([^MHVQA]+)/g)) {
      const n = [...numbers.matchAll(/-?\d+(?:\.\d+)?/g)].map(v => Number(v[0]));
      if (cmd === 'H') x = n[0]; else if (cmd === 'V') y = n[0];
      else { x = n[n.length - 2]; y = n[n.length - 1]; }
    }
    return [x, y];
  };
  for (const tank of [-120, 0]) for (const fm of [0, 120]) for (const wp of [0, 120]) for (const valve of [-15, 15]) for (const returns of ['gemeinsam', 'getrennt']) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf', ruecklauf_anbindung: returns }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, speicher: { x: tank }, fm: { x: fm }, wp: { x: wp }, ventil: { y: valve } } });
    card._hass = { language: 'de', states: {} };
    card._render();
    const n = card._pipeNetwork;
    for (const pipe of n.pipes) {
      const from = n.ports.get(pipe.from), to = n.ports.get(pipe.to), d = pipe.route(from, to);
      assert.ok(d.startsWith(`M${from.x} ${from.y}`), `${pipe.id}: start ${d}`);
      assert.deepEqual(endpoint(d), [to.x, to.y], `${pipe.id}: end ${d}`);
    }
  }
});

test('configured offsets survive a JSON round-trip without losing other settings', () => {
  const original = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf', another_setting: 'keep' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x: 50 }, future_option: { enabled: true } }, extra_setting: 'keep' };
  const card = new Card(); card.setConfig(JSON.parse(JSON.stringify(original)));
  card._hass = { language: 'de', states: {} };
  card._render();
  assert.equal(card._pipeNetwork.ports.get('wp.supply').x, 376);
  assert.equal(card._cfg.wp.another_setting, 'keep');
  assert.equal(card._cfg.layout.future_option.enabled, true);
  assert.equal(card._cfg.extra_setting, 'keep');
});

test('saving layout through the editor preserves unknown settings and explicit false values', () => {
  const Editor = registry.get('warmwasser-schema-card-editor');
  const editor = new Editor();
  editor._config = { type: 'custom:warmwasser-schema-card', extra: { disabled: false }, wp: { custom: false }, layout: { version: 1, wp: { x: 50, custom: false } } };
  editor._undo = []; editor._redo = [];
  editor._previewConfig = () => {}; editor._layoutControls = () => {};
  context.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  let saved; editor.dispatchEvent = event => { saved = event.detail.config; };
  editor._layoutSet({ version: 1, wp: { x: 55, custom: false } });
  assert.equal(saved.extra.disabled, false);
  assert.equal(saved.wp.custom, false);
  assert.equal(saved.layout.wp.custom, false);
  assert.equal(saved.layout.wp.x, 55);
  assert.equal(editor._undo[0].wp.x, 50);
});

vm.runInNewContext('this.layoutTest = { layoutAllowed, layoutChanged, layoutCurrent, layoutReset, editableJunctions }', context);
const layoutTools = context.layoutTest;

test('editor restricts movements to supported configurations and preserves unknown layout settings', () => {
  const cfg = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { ventil_position: 'vorlauf', betrieb: 'binary_sensor.wp' }, fm: { anzeigen: true }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x: 25, custom: false }, future: { value: false } } };
  assert.equal(layoutTools.layoutAllowed(cfg, 'wp'), true);
  assert.equal(layoutTools.layoutAllowed(cfg, 'ventil'), true);
  assert.equal(layoutTools.layoutAllowed({ ...cfg, weiche: true }, 'ventil'), true);
  assert.equal(layoutTools.layoutAllowed({ ...cfg, speicher: { ...cfg.speicher, heizkreis_separat: false }, weiche: true, solar: { pumpe: 'binary_sensor.solar' } }, 'ventil'), false);
  assert.equal(layoutTools.layoutAllowed({ ...cfg, layout: { version: 2 } }, 'wp'), false);
  const changed = layoutTools.layoutChanged(cfg, 'wp', 123);
  assert.equal(changed.wp.x, 125);
  assert.equal(changed.wp.custom, false);
  const reset = layoutTools.layoutReset(changed);
  assert.equal(reset.wp.custom, false);
  assert.equal(reset.wp.x, undefined);
  assert.equal(reset.future.value, false);
  assert.equal(layoutTools.layoutCurrent({ ...cfg, layout: changed }, 'wp'), 125);
});

test('layout undo and redo restore the prior saved offsets', () => {
  const Editor = registry.get('warmwasser-schema-card-editor'), editor = new Editor();
  editor._config = { type: 'custom:warmwasser-schema-card' };
  editor._undo = []; editor._redo = [];
  editor._previewConfig = () => {}; editor._layoutControls = () => {};
  editor.dispatchEvent = () => {};
  editor._layoutSet({ version: 1, wp: { x: 20 } });
  editor._layoutSet({ version: 1, wp: { x: 40 } });
  editor._layoutUndo(); assert.equal(editor._config.layout.wp.x, 20);
  editor._layoutUndo(); assert.equal(editor._config.layout, undefined);
  editor._layoutRedo(); assert.equal(editor._config.layout.wp.x, 20);
  editor._layoutRedo(); assert.equal(editor._config.layout.wp.x, 40);
  editor._layoutUndo(); editor._layoutSet({ version: 1, wp: { x: 10 } });
  assert.equal(editor._redo.length, 0);
});

test('fresh-water module can move vertically without detaching either pipe', () => {
  for (const separation of [35, 50, 70]) for (const dy of [-20, -10, 0, 5, 10]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', trennung: separation }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, layout: { version: 1, fm: { x: 40, y: dy } } });
    card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(n.ports.get('fm.supply').y, 46 + dy);
    assert.equal(n.ports.get('fm.return').y, 90 + dy);
    for (const id of ['fm_supply', 'fm_return']) {
      const p = edge(n, id), from = n.ports.get(p.from), to = n.ports.get(p.to), d = p.route(from, to);
      assert.ok(d.startsWith(`M${from.x} ${from.y}`));
      assert.ok(d.endsWith(`H${to.x}`));
      assert.ok(svg.includes(`d="${d}" class="w3"`));
    }
    assert.ok(svg.includes(`data-component="fm" transform="translate(40 ${dy})"`));
    assert.ok(svg.includes(`viewBox="0 ${-30 + Math.min(0, dy)} `));
  }
});

test('reset removes both fresh-water offsets while preserving unrelated data', () => {
  const config = { layout: { version: 1, fm: { x: 30, y: -10, custom: false }, future: 5 } };
  const moved = layoutTools.layoutChanged(config, 'fm', 12, 'y');
  assert.equal(moved.fm.y, 10);
  assert.equal(moved.fm.x, 30);
  const reset = layoutTools.layoutReset(moved);
  assert.equal(reset.fm.x, undefined);
  assert.equal(reset.fm.y, undefined);
  assert.equal(reset.fm.custom, false);
  assert.equal(reset.future, 5);
});

test('heat pump and source move together with their supply and return ports', () => {
  for (const y of [-20, 0, 5, 20, 80]) for (const x of [0, 120]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x, y } } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(n.ports.get('wp.supply').y, 170 + y);
    assert.equal(n.ports.get('wp.return').y, 308.5 + y);
    assert.ok(svg.includes(`data-component="wp" transform="translate(${x} ${y})"`));
    if (x || y) assert.ok(svg.includes(`<g transform="translate(${x} ${y})"><path d="M400 372V540`));
    const p = edge(n, 'combined_return'), a = n.ports.get(p.from), b = n.ports.get(p.to), path = p.route(a, b);
    assert.ok(path.startsWith(`M${a.x} ${a.y}`));
    assert.ok(path.endsWith(`H${b.x}`));
    assert.ok(svg.includes(`d="${path}" class="w3"`));
  }
});

test('moving the valve to the right moves all three ports and keeps its connected paths', () => {
  for (const x of [0, 5, 10]) for (const y of [-15, 0, 15]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, ventil: { x, y } } });
    card._hass = { language: 'de', states: {} }; const svg = card._render(), n = card._pipeNetwork;
    assert.equal(n.ports.get('valve.top').x, 262 + x);
    assert.equal(n.ports.get('valve.bottom').x, 262 + x);
    assert.equal(n.ports.get('valve.side').x, 277 + x);
    assert.ok(svg.includes(`data-component="ventil" transform="translate(${x} 0)"`));
    for (const id of ['ww_supply', 'buffer_supply']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d.endsWith(`H${262 + x}`) || d.endsWith(`V${n.ports.get(p.to).y}`));
    }
  }
});

test('heat-pump vertical offset also moves separate returns', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt' }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf', ruecklauf_anbindung: 'getrennt' }, layout: { version: 1, wp: { x: 20, y: 20 } } });
  card._hass = { language: 'de', states: {} }; const svg = card._render();
  assert.equal(card._pipeNetwork.ports.get('wp.supply').y, 190);
  assert.ok(svg.includes('data-component="wp" transform="translate(20 20)"'));
  assert.equal(card._routingError, false);
});

test('legend is kept beside the heat pump when both upper components move close together', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt' }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf', typ: 'sole' }, fm: { pumpe: 'binary_sensor.fm' }, fuehler: [{ name: 'WW', entity: 'sensor.ww', hoehe: 20 }], layout: { version: 1, wp: { y: -20 }, fm: { y: 10 } } });
  card._hass = { language: 'de', states: { 'sensor.ww': { state: '45' } } };
  const svg = card._render();
  const [, minX, minY, width] = svg.match(/viewBox="([\d.-]+) ([\d.-]+) ([\d.-]+) [\d.-]+"/).map(Number);
  const [, x, y] = svg.match(/<text x="([\d.-]+)" y="([\d.-]+)" font-size="8" class="wc ws" font-weight="600" letter-spacing=".8">SPEICHER/).map(Number);
  assert.ok(x - 23 >= minX && x + 23 <= minX + width && y >= minY);
  assert.ok(x > 450, 'legend clears the upper components');
});

test('reset removes the additional heat pump and valve offsets', () => {
  const result = layoutTools.layoutReset({ version: 1, wp: { x: 40, y: -10, other: false }, ventil: { x: 10, y: 15, other: false } });
  assert.equal(result.wp.x, undefined); assert.equal(result.wp.y, undefined); assert.equal(result.wp.other, false);
  assert.equal(result.ventil.x, undefined); assert.equal(result.ventil.y, undefined); assert.equal(result.ventil.other, false);
});

test('separate tanks move independently and keep their own pipe and sensor connections', () => {
  for (const upper of [-60, 0, 20]) for (const lower of [-60, 0]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], fuehler: [{ name: 'WW', entity: 'sensor.ww', hoehe: 20 }, { name: 'Puffer', entity: 'sensor.puffer', hoehe: 85 }], layout: { version: 1, speicher: { x: -20 }, warmwasser: { x: upper }, puffer: { x: lower } } });
    card._hass = { language: 'de', states: { 'sensor.ww': { state: '48' }, 'sensor.puffer': { state: '38' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(n.ports.get('ww.fm_supply').x, 186 + upper);
    assert.equal(n.ports.get('ww.wp_return').x, 186 + upper);
    assert.equal(n.ports.get('buffer.wp_supply').x, 186 + lower);
    assert.equal(n.ports.get('buffer.wp_return').x, 186 + lower);
    assert.ok(svg.includes(`data-component="warmwasser" transform="translate(${upper} 0)"`));
    assert.ok(svg.includes(`data-component="puffer" transform="translate(${lower} 0)"`));
    const hk = edge(n, 'hk_supply'), start = n.ports.get(hk.from), end = n.ports.get(hk.to);
    assert.equal(start.x, (130 > 182 + lower ? 186 : 50) + lower);
    assert.ok(hk.route(start, end).endsWith(`H${end.x}`));
    assert.match(svg, new RegExp(`data-component="warmwasser" transform="translate\\(${upper} 0\\)"><g data-more="sensor\\.ww"`));
    assert.match(svg, new RegExp(`data-component="puffer" transform="translate\\(${lower} 0\\)"><g data-more="sensor\\.puffer"`));
  }
});

test('individual tank offsets reset without removing unrelated settings', () => {
  const result = layoutTools.layoutReset({ version: 1, warmwasser: { x: 20, note: 'keep' }, puffer: { x: -60 } });
  assert.equal(result.warmwasser.x, undefined);
  assert.equal(result.warmwasser.note, 'keep');
  assert.equal(result.puffer, undefined);
});

test('individual tank movement is offered only for the supported plumbing layout', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  assert.equal(layoutTools.layoutAllowed(config, 'warmwasser'), true);
  assert.equal(layoutTools.layoutAllowed(config, 'puffer'), true);
  assert.equal(layoutTools.layoutAllowed({ ...config, solar: { pumpe: 'binary_sensor.solar' } }, 'puffer'), true);
  assert.equal(layoutTools.layoutChanged(config, 'warmwasser', 100).warmwasser.x, 100);
  assert.equal(layoutTools.layoutChanged(config, 'puffer', 100).puffer.x, 100);
});

vm.runInNewContext('this.autoPipeTest = autoPipe', context);
test('automatic pipe routing avoids a device and keeps horizontal port entries', () => {
  const start = { x: 0, y: 50 }, end = { x: 200, y: 50 }, obstacle = { x: 80, y: 20, width: 40, height: 60 };
  const route = context.autoPipeTest(start, end, [obstacle]);
  assert.ok(route);
  assert.deepEqual([route.points[0].x, route.points[0].y], [start.x, start.y]);
  assert.deepEqual([route.points.at(-1).x, route.points.at(-1).y], [end.x, end.y]);
  assert.equal(route.points[0].y, route.points[1].y);
  assert.equal(route.points.at(-2).y, route.points.at(-1).y);
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i];
    assert.ok(a.x === b.x || a.y === b.y);
    const intersects = a.y === b.y ? a.y > 12 && a.y < 88 && Math.min(a.x, b.x) < 128 && Math.max(a.x, b.x) > 72 : a.x > 72 && a.x < 128 && Math.min(a.y, b.y) < 88 && Math.max(a.y, b.y) > 12;
    assert.equal(intersects, false);
  }
  assert.ok(route.path.includes('Q'));
});

test('automatic pipe routing returns no path when an endpoint is inside an obstacle', () => {
  const route = context.autoPipeTest({ x: 100, y: 50 }, { x: 200, y: 50 }, [{ x: 80, y: 20, width: 40, height: 60 }]);
  assert.equal(route, null);
});

test('automatic routing can leave and reach horizontally aligned vertical ports', () => {
  const route = context.autoPipeTest({ x: 0, y: 0 }, { x: 0, y: 100 });
  assert.ok(route);
  assert.equal(route.points[0].y, route.points[1].y);
  assert.equal(route.points.at(-2).y, route.points.at(-1).y);
  assert.deepEqual([route.points.at(-1).x, route.points.at(-1).y], [0, 100]);
});

vm.runInNewContext('this.pipePathTest = pipePath', context);
test('crossing pipes receive a bridge while an explicit junction remains connected', () => {
  const points = [{ x: 0, y: 50 }, { x: 100, y: 50 }];
  const existing = [{ a: { x: 50, y: 0 }, b: { x: 50, y: 100 } }];
  assert.equal(context.pipePathTest(points, [], existing), 'M0 50H46A4 4 0 0 1 54 50H100');
  assert.equal(context.pipePathTest(points, [], existing, [{ x: 50, y: 50 }]), 'M0 50H100');
});

test('unsafe crossing at a corner is rejected rather than drawn as a junction', () => {
  const points = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }];
  const existing = [{ a: { x: 46, y: -10 }, b: { x: 46, y: 10 } }];
  assert.equal(context.pipePathTest(points, [4], existing), null);
});

test('crossings inside a rounded corner and collinear overlaps are not silently drawn', () => {
  const points = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }];
  assert.equal(context.pipePathTest(points, [4], [{ a: { x: 48, y: -10 }, b: { x: 48, y: 10 } }]), null);
  assert.equal(context.pipePathTest([{ x: 0, y: 0 }, { x: 100, y: 0 }], [], [{ a: { x: 30, y: 0 }, b: { x: 60, y: 0 } }]), null);
});

test('automatic routing honours vertical and horizontal port axes', () => {
  const route = context.autoPipeTest({ x: 0, y: 0 }, { x: 100, y: 80 }, [], [], [], 'v', 'h');
  assert.ok(route);
  assert.equal(route.points[0].x, route.points[1].x);
  assert.equal(route.points.at(-2).y, route.points.at(-1).y);
});

test('automatic routing uses a bridge when a non-junction crossing is unavoidable', () => {
  const existing = [{ a: { x: 50, y: -1000 }, b: { x: 50, y: 1000 } }];
  const route = context.autoPipeTest({ x: 0, y: 0 }, { x: 100, y: 0 }, [], existing);
  assert.ok(route);
  assert.match(route.path, /A4 4 0 0 1 54 0/);
  const joined = context.autoPipeTest({ x: 0, y: 0 }, { x: 100, y: 0 }, [], existing, [{ x: 50, y: 0 }]);
  assert.ok(joined);
  assert.equal(joined.path.includes('A'), false);
});

vm.runInNewContext('this.routePortsTest = routePorts', context);
test('port routing leaves devices in their specified directions', () => {
  const route = context.routePortsTest({ x: 10, y: 20, dx: 1, dy: 0 }, { x: 100, y: 80, dx: 0, dy: -1 }, []);
  assert.ok(route);
  assert.deepEqual([route.points[0].x, route.points[0].y], [10, 20]);
  assert.equal(route.points[1].y, 20);
  assert.deepEqual([route.points.at(-1).x, route.points.at(-1).y], [100, 80]);
  assert.equal(route.points.at(-2).x, 100);
});

test('port leads cannot pass through another device', () => {
  const from = { x: 0, y: 0, dx: 1, dy: 0, owner: 'start' };
  const to = { x: 100, y: 50, dx: -1, dy: 0, owner: 'end' };
  const obstacles = [{ id: 'other', x: 4, y: -5, width: 10, height: 10 }];
  assert.equal(context.routePortsTest(from, to, obstacles), null);
});

test('an unroutable layout is not saved and does not erase undo history', () => {
  const Editor = registry.get('warmwasser-schema-card-editor'), editor = new Editor();
  editor._config = { layout: { version: 1, wp: { x: 20 } } };
  editor._undo = [{ version: 1, wp: { x: 50 } }]; editor._redo = [];
  editor._hass = { language: 'de' }; editor._preview = {}; editor._layoutStatus = {};
  editor._previewConfig = config => { editor._preview._routingError = config?.layout?.wp?.x === 50; };
  editor._layoutControls = () => {}; editor.dispatchEvent = () => {};
  editor._layoutUndo();
  assert.equal(editor._config.layout.wp.x, 20);
  assert.equal(editor._undo.length, 1);
  assert.equal(editor._redo.length, 0);
  assert.match(editor._layoutStatus.textContent, /Kein freier Rohrweg/);
});

test('existing editor positions retain a safe fresh-water supply route', () => {
  for (const split of [35, 50, 70]) for (const tank of [-120, 0]) for (const upper of [-60, 0, 20]) for (const fmX of [0, 120]) for (const fmY of [-20, 0, 10]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', trennung: split, heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, speicher: { x: tank }, warmwasser: { x: upper }, fm: { x: fmX, y: fmY } } });
    card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' } } };
    const svg = card._render();
    assert.equal(card._routingError, false, `split=${split} tank=${tank} upper=${upper} fm=${fmX},${fmY}`);
    assert.equal(svg.includes('Kein freier Rohrweg gefunden'), false);
  }
});

test('routing can choose an alternative when a crossing would be too close to a turn', () => {
  const existing = [{ a: { x: 50, y: -10 }, b: { x: 50, y: 35 } }, { a: { x: 42, y: 20 }, b: { x: 72, y: 20 } }];
  const route = context.autoPipeTest({ x: 0, y: 0 }, { x: 100, y: 50 }, [], existing);
  assert.ok(route);
  assert.deepEqual([route.points[0].x, route.points[0].y], [0, 0]);
  assert.deepEqual([route.points.at(-1).x, route.points.at(-1).y], [100, 50]);
});

test('directional leads can leave their own device but not enter it again', () => {
  const boxes = [{ id: 'left', x: -100, y: 0, width: 100, height: 100 }, { id: 'right', x: 200, y: 0, width: 100, height: 100 }];
  const route = context.routePortsTest({ x: 0, y: 50, dx: 1, dy: 0, owner: 'left' }, { x: 200, y: 50, dx: -1, dy: 0, owner: 'right' }, boxes);
  assert.ok(route);
  assert.equal(route.points[0].x, 0);
  assert.equal(route.points.at(-1).x, 200);
  assert.equal(context.routePortsTest({ x: 0, y: 50, dx: 1, dy: 1 }, { x: 200, y: 50, dx: -1, dy: 0 }, boxes), null);
});

test('automatic fresh-water return bridges the charging pipe on the visible top layer', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, fm: { x: 20, y: -10 } } });
  card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' } } };
  const svg = card._render(), n = card._pipeNetwork;
  const ret = edge(n, 'fm_return'), charge = edge(n, 'ww_supply');
  const returnPath = ret.route(n.ports.get(ret.from), n.ports.get(ret.to));
  const chargePath = charge.route(n.ports.get(charge.from), n.ports.get(charge.to));
  const bridge = returnPath.match(/A([\d.]+) \1 0 0 1/);
  assert.ok(bridge && Number(bridge[1]) >= 3);
  assert.equal(chargePath.includes('250 153'), false);
  assert.ok(svg.indexOf(`d="${returnPath}" class="w0"`) > svg.indexOf(`d="${chargePath}" class="w0"`));
  assert.equal(card._routingError, false);
});

test('heat-pump and valve routing remains valid across existing editor limits', () => {
  for (const wpX of [0, 120]) for (const wpY of [-20, 80]) for (const valveX of [0, 10]) for (const valveY of [-15, 15]) for (const fmX of [0, 120]) for (const fmY of [-20, 10]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x: wpX, y: wpY }, ventil: { x: valveX, y: valveY }, fm: { x: fmX, y: fmY } } });
    card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.wp': { state: 'on' } } };
    card._render();
    assert.equal(card._routingError, false, `wp=${wpX},${wpY}; valve=${valveX},${valveY}; fm=${fmX},${fmY}`);
  }
});

test('reused geometry still updates pipe activity when sensor state changes', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, fm: { x: 20, y: -10 } } });
  card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.wp': { state: 'off' } } };
  const active = card._render(), p = edge(card._pipeNetwork, 'fm_return'), d = p.route(card._pipeNetwork.ports.get(p.from), card._pipeNetwork.ports.get(p.to));
  assert.ok(active.includes(`d="${d}" class="w3"`));
  card._hass.states['binary_sensor.fm'].state = 'off';
  const inactive = card._render();
  assert.ok(inactive.includes(`d="${d}" class="w1"`));
  assert.equal(inactive.includes(`d="${d}" class="w3"`), false);
});

test('a pump position that leaves no safe clearance to the heating manifold is rejected', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x: 0, y: 100 }, ventil: { y: -15 }, fm: { y: -20 } } });
  card._hass = { language: 'de', states: {} };
  const svg = card._render();
  assert.equal(card._routingError, true);
  assert.ok(svg.includes('Kein freier Rohrweg gefunden'));
});

test('the supported system accepts two-dimensional positions well beyond the old limits', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], fuehler: [{ name: 'WW', entity: 'sensor.ww', hoehe: 20 }, { name: 'Puffer', entity: 'sensor.puffer', hoehe: 85 }], layout: { version: 1, warmwasser: { x: -200, y: -100 }, puffer: { x: -200, y: 100 }, wp: { x: 200, y: -100 }, ventil: { x: 100, y: 0 }, heizkreis: { x: 100, y: 100 }, fm: { x: 100, y: -100 } } });
  card._hass = { language: 'de', states: { 'sensor.ww': { state: '48' }, 'sensor.puffer': { state: '38' }, 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
  const svg = card._render(), n = card._pipeNetwork;
  assert.equal(card._routingError, false);
  assert.equal(n.ports.get('ww.wp_supply').x, 6);
  assert.equal(n.ports.get('ww.wp_supply').y, -30);
  assert.equal(n.ports.get('buffer.wp_return').x, 6);
  assert.ok(n.ports.get('buffer.wp_return').y < n.ports.get('buffer.hk_return').y);
  assert.equal(n.ports.get('wp.supply').x, 526);
  assert.equal(n.ports.get('wp.supply').y, 70);
  assert.equal(n.ports.get('hc.supply').x, 230);
  assert.equal(n.ports.get('hc.supply').y, 520);
  assert.ok(svg.includes('data-component="warmwasser" transform="translate(-200 -100)"'));
  assert.ok(svg.includes('data-component="puffer" transform="translate(-200 100)"'));
  assert.ok(svg.includes('data-component="wp" transform="translate(200 -100)"'));
  assert.ok(svg.includes('data-component="fm" transform="translate(100 -100)"'));
});

test('overlapping equipment produces a routing error instead of a saved false diagram', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { y: -60 } } });
  card._hass = { language: 'de', states: {} };
  assert.ok(card._render().includes('Kein freier Rohrweg gefunden'));
  assert.equal(card._routingError, true);
});

test('each component can be repositioned in two dimensions beyond the old limits', () => {
  const positions = { warmwasser: { x: -200, y: -100 }, puffer: { x: -200, y: 100 }, wp: { x: 200, y: -100 }, ventil: { x: 300, y: -200 }, heizkreis: { x: -200, y: 200 }, fm: { x: 200, y: -100 }, speicher: { x: -200, y: -100 } };
  for (const [id, pos] of Object.entries(positions)) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, [id]: pos } });
    card._hass = { language: 'de', states: {} };
    card._render();
    assert.equal(card._routingError, false, `component=${id}`);
  }
});

test('separate heating circuit return animates towards the buffer in original and moved layouts', () => {
  for (const moved of [false, true]) {
    const card = new Card();
    const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
    if (moved) config.layout = { version: 1, wp: { x: 20 } };
    card.setConfig(config);
    card._hass = { language: 'de', states: { 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render();
    if (moved) {
      const p = edge(card._pipeNetwork, 'hk_return');
      assert.equal(p.from, 'buffer.hk_return');
      assert.equal(p.to, 'hc.return');
      assert.equal(p.reverse, true);
      const d = p.route(card._pipeNetwork.ports.get(p.from), card._pipeNetwork.ports.get(p.to));
      assert.ok(svg.includes(`d="${d}" class="w3" style="animation-direction:reverse"`));
    } else {
      assert.match(svg, /d="M70 340H68A8 8 0 0 1 52 340H40V440Q40 448 48 448H130" class="w3" style="animation-direction:reverse"/);
    }
    card._hass.states['binary_sensor.hk'].state = 'off';
    assert.equal(card._render().includes('animation-direction:reverse'), false);
  }
});

test('module flow and supply-side heat pump charging use the intended directions', () => {
  for (const moved of [false, true]) for (const target of ['Puffer', 'Warmwasser']) {
    const card = new Card();
    const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil: 'sensor.ventil', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
    if (moved) config.layout = { version: 1, wp: { x: 20 } };
    card.setConfig(config);
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' }, 'sensor.ventil': { state: target } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false);
    for (const id of ['fm_supply', 'fm_return', 'wp_supply', target === 'Puffer' ? 'buffer_supply' : 'ww_supply']) {
      const p = edge(n, id);
      const reverse = !id.startsWith('fm_');
      assert.equal(p.reverse, reverse, id);
      assert.equal(p.active, true, id);
      const d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      const style = reverse ? ' style="animation-direction:reverse"' : '';
      assert.ok(svg.includes(`d="${d}" class="w3"${style}/>`), id);
    }
    assert.equal(edge(n, target === 'Puffer' ? 'ww_supply' : 'buffer_supply').active, false);
  }
});

test('heating manifold connections face the buffer on either side', () => {
  for (const [offset, side] of [[-300, 'right'], [60, 'left']]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, heizkreis: { x: offset } } });
    card._hass = { language: 'de', states: { 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false);
    const supply = n.ports.get('hc.supply'), ret = n.ports.get('hc.return');
    assert.equal(supply.x, (side === 'right' ? 300 : 130) + offset);
    assert.equal(ret.x, (side === 'right' ? 317 : 130) + offset);
    assert.equal(supply.dx, side === 'right' ? 1 : -1);
    assert.equal(ret.dx, side === 'right' ? 1 : -1);
    assert.ok(svg.includes(`M${side === 'right' ? 300 : 130} 420H154`));
    assert.ok(svg.includes(`M186 448H${side === 'right' ? 317 : 130}`));
  }
});

test('module and hot-water tank ports change sides together', () => {
  for (const [x, y, left] of [[-400, -100, true], [40, 0, false]]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, fm: { x, y } } });
    card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false);
    for (const [a, b] of [['ww.fm_supply', 'fm.supply'], ['ww.fm_return', 'fm.return']]) {
      assert.equal(n.ports.get(a).x, left ? 70 : 206);
      assert.equal(n.ports.get(a).dx, left ? -1 : 1);
      assert.equal(n.ports.get(b).x, (left ? 454 : 336) + x);
      assert.equal(n.ports.get(b).dx, left ? 1 : -1);
      const pipe = n.pipes.find(p => p.from === a || p.to === a);
      const d = pipe.route(n.ports.get(pipe.from), n.ports.get(pipe.to));
      assert.ok(d && svg.includes(`d="${d}" class="w3"`));
    }
    assert.ok(svg.includes(left ? 'x="448" y="40"' : 'x="332" y="40"'));
  }
});

test('heat-pump connections and common-return junction face the diverter valve', () => {
  for (const [layout, right] of [[{ wp: { x: -600, y: -100 } }, true], [{ ventil: { x: 300, y: -200 } }, true], [{ wp: { x: 100 } }, false]]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil: 'sensor.ventil', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, ...layout } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'sensor.ventil': { state: 'Warmwasser' } } };
    const svg = card._render(), n = card._pipeNetwork, dx = layout.wp?.x || 0;
    assert.equal(card._routingError, false);
    for (const id of ['wp.supply', 'wp.return']) {
      assert.equal(n.ports.get(id).x, (right ? 454 : 326) + dx);
      assert.equal(n.ports.get(id).dx, right ? 1 : -1);
    }
    assert.equal(n.ports.get('return.junction').x, (right ? 470 : 310) + dx);
    assert.equal(n.ports.get('return.to_wp').dx, right ? -1 : 1);
    assert.ok(svg.includes(`x="${right ? 448 : 322}" y="164"`));
    for (const id of ['ww_return', 'buffer_return', 'combined_return', 'wp_supply']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), id);
    }
  }
});

test('valve and tank connections face their linked devices without sharing buffer ports', () => {
  for (const hkRight of [false, true]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil: 'sensor.ventil', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x: -600, y: -100 }, ventil: { x: -300 }, ...(hkRight ? { heizkreis: { x: 200 } } : {}) } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.hk': { state: 'on' }, 'sensor.ventil': { state: 'Puffer' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false);
    assert.equal(n.ports.get('valve.side').x, -53);
    assert.equal(n.ports.get('valve.side').dx, -1);
    assert.ok(svg.includes('transform="translate(524 0) scale(-1 1)"'));
    for (const id of ['ww.wp_supply', 'ww.wp_return', 'buffer.wp_supply', 'buffer.wp_return']) {
      assert.equal(n.ports.get(id).x, 70, id);
      assert.equal(n.ports.get(id).dx, -1, id);
    }
    for (const kind of ['supply', 'return']) {
      const wp = n.ports.get(`buffer.wp_${kind}`), hk = n.ports.get(`buffer.hk_${kind}`);
      assert.equal(hk.x, hkRight ? 206 : 70);
      assert.ok(wp.x !== hk.x || Math.abs(wp.y - hk.y) >= 20);
    }
    for (const id of ['ww_supply', 'ww_return', 'buffer_supply', 'buffer_return', 'wp_supply', 'hk_supply', 'hk_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), id);
    }
  }
});

test('moving the heating circuit right of the standard installation connects to the right of the buffer', () => {
  for (const [x, y] of [[400, 0], [300, 200]]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil: 'sensor.ventil', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk', typ: 'heizkoerper' }], layout: { version: 1, heizkreis: { x, y } } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.hk': { state: 'on' }, 'sensor.ventil': { state: 'Warmwasser' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, `${x},${y}`);
    for (const kind of ['supply', 'return']) {
      const port = n.ports.get(`buffer.hk_${kind}`), pipe = edge(n, `hk_${kind}`);
      assert.equal(port.x, 206);
      assert.equal(port.dx, 1);
      assert.notEqual(port.y, n.ports.get(`buffer.wp_${kind}`).y);
      const d = pipe.route(n.ports.get(pipe.from), n.ports.get(pipe.to));
      assert.ok(d && svg.includes(`d="${d}" class="w3"`));
    }
  }
});

test('shared-side buffer ports stay on the tank and place WP above the heating circuit', () => {
  for (const layout of [{ wp: { x: -600, y: -100 }, ventil: { x: -300 } }, { heizkreis: { x: 400 } }]) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, ...layout } });
    card._hass = { language: 'de', states: { 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false);
    const wps = n.ports.get('buffer.wp_supply'), hks = n.ports.get('buffer.hk_supply');
    const wpr = n.ports.get('buffer.wp_return'), hkr = n.ports.get('buffer.hk_return');
    assert.equal(wps.x, hks.x); assert.equal(wpr.x, hkr.x);
    assert.ok(wps.y >= 40 + 310 * 0.5 + 32);
    assert.ok(hks.y - wps.y >= 16);
    assert.ok(hkr.y - wpr.y >= 16);
    assert.ok(hks.y < wpr.y);
    const x = wps.dx < 0 ? 62 : 198;
    for (const p of [wps, hks, wpr, hkr]) assert.ok(svg.includes(`x="${x}" y="${p.y - 6}" width="14" height="12"`));
  }
});

test('the common return junction can move without disconnecting its three pipes', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  assert.equal(layoutTools.layoutAllowed(config, 'ruecklauf_abzweig'), true);
  assert.equal(layoutTools.layoutAllowed({ ...config, wp: { ...config.wp, ruecklauf_anbindung: 'getrennt' } }, 'ruecklauf_abzweig'), false);
  const changed = layoutTools.layoutChanged(config, 'ruecklauf_abzweig', -19, 'x');
  assert.equal(changed.ruecklauf_abzweig.x, -20);
  assert.equal(layoutTools.layoutReset(changed), null);
  for (const [x, y] of [[-20, 0], [0, 20], [-40, 40]]) {
    const card = new Card();
    card.setConfig({ ...config, layout: { version: 1, ruecklauf_abzweig: { x, y } } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork, junction = n.ports.get('return.junction');
    assert.equal(card._routingError, false, `${x},${y}`);
    assert.equal(junction.x, 310 + x); assert.equal(junction.y, 308.5 + y);
    assert.ok(svg.includes(`data-component="ruecklauf_abzweig"><circle cx="${junction.x}" cy="${junction.y}"`));
    for (const id of ['ww_return', 'buffer_return', 'combined_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), id);
      assert.ok(id === 'combined_return' ? d.startsWith(`M${junction.x} ${junction.y}`) : d.endsWith(`V${junction.y}`));
    }
  }
});

test('editable return junctions come from the active topology, not from pipe crossings', () => {
  const base = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  for (const [config, count] of [
    [base, 1],
    [{ ...base, wp: { ...base.wp, ruecklauf_anbindung: 'getrennt' } }, 0],
    [{ ...base, wp: { ...base.wp, ventil_position: 'ruecklauf' } }, 0],
    [{ ...base, wp: undefined }, 0],
    [{ ...base, solar: { pumpe: 'binary_sensor.solar' } }, 1],
  ]) {
    const card = new Card(); card.setConfig(config); card._hass = { language: 'de', states: {} }; card._render();
    const items = layoutTools.editableJunctions(card._pipeNetwork, config);
    assert.equal(items.length, count);
    if (count) {
      assert.equal(items[0].id, 'return.junction');
      assert.equal(items[0].layoutKey, 'ruecklauf_abzweig');
      assert.equal(card._pipeNetwork.pipes.filter(p => p.from === items[0].id || p.to === items[0].id).length, 3);
      const incomplete = { junctions: card._pipeNetwork.junctions, pipes: card._pipeNetwork.pipes.filter(p => p.id !== 'buffer_return') };
      assert.equal(layoutTools.editableJunctions(incomplete, config).length, 0);
    }
  }
});

test('separate heat-pump returns follow free movement without inventing a junction', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf', ruecklauf_anbindung: 'getrennt' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  for (const [component, position] of Object.entries({ warmwasser: { x: -200, y: -100 }, puffer: { x: -200, y: 100 }, wp: { x: 200, y: -100 }, heizkreis: { x: -200, y: 200 }, fm: { x: 200, y: -100 } })) {
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [component]: position } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, component);
    assert.equal(edge(n, 'ww_return').to, 'wp.return');
    assert.equal(edge(n, 'buffer_return').to, 'wp.buffer_return');
    assert.equal(n.junctions.size, 0);
    for (const id of ['ww_return', 'buffer_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), id);
    }
    if (component === 'wp') {
      assert.equal(n.ports.get('wp.buffer_return').x, 526);
      assert.equal(n.ports.get('wp.buffer_return').y - n.ports.get('wp.return').y, 18);
      assert.equal(n.ports.get('wp.return').y, 208.5);
    }
  }
  assert.equal(layoutTools.layoutAllowed(config, 'ruecklauf_abzweig'), false);
});

test('several heating circuits and their shared manifold can move together', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ name: 'Oben', pumpe: 'binary_sensor.hk1' }, { name: 'Unten', pumpe: 'binary_sensor.hk2', mischer: 'sensor.mischer' }, { name: 'Bad', pumpe: 'binary_sensor.hk3' }] };
  assert.equal(layoutTools.layoutAllowed(config, 'heizkreis'), true);
  for (const [x, y] of [[-250, 100], [100, 200]]) {
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, heizkreis: { x, y } } });
    card._hass = { language: 'de', states: { 'binary_sensor.hk1': { state: 'on' }, 'binary_sensor.hk2': { state: 'on' }, 'binary_sensor.hk3': { state: 'on' }, 'sensor.mischer': { state: '0' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false);
    assert.ok(svg.includes(`transform="translate(${x} ${y})"`));
    for (const name of ['Oben', 'Unten', 'Bad']) assert.ok(svg.includes(name));
    assert.equal((svg.match(/data-component="heizkreis"/g) || []).length, 4);
    assert.ok(svg.includes(`<g transform="translate(${x} ${y})"><g data-component="heizkreis">`));
    for (const id of ['hk_supply', 'hk_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w3"`), id);
    }
  }
});

test('separate tanks without a displayed heat pump can be arranged with their connected module and manifold', () => {
  for (const hasHeating of [false, true]) {
    const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, fm: { pumpe: 'binary_sensor.fm' }, ...(hasHeating ? { heizkreise: [{ pumpe: 'binary_sensor.hk' }] } : {}) };
    for (const [component, pos] of Object.entries({ warmwasser: { x: -200, y: -100 }, puffer: { x: -200, y: 100 }, fm: { x: 200, y: -100 }, ...(hasHeating ? { heizkreis: { x: 400, y: 0 } } : {}) })) {
      assert.equal(layoutTools.layoutAllowed(config, component), true, component);
      const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [component]: pos } });
      card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
      const svg = card._render(), n = card._pipeNetwork;
      assert.equal(card._routingError, false, component);
      assert.equal(n.junctions.size, 0);
      for (const id of ['fm_supply', 'fm_return', ...(hasHeating ? ['hk_supply', 'hk_return'] : [])]) {
        const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
        assert.ok(d && svg.includes(`d="${d}" class="w3"`), id);
      }
      assert.equal(layoutTools.layoutAllowed(config, 'ruecklauf_abzweig'), false);
      if (component === 'heizkreis') assert.ok(svg.includes(`<g transform="translate(${pos.x} ${pos.y})"><g data-component="heizkreis">`));
    }
  }
});

test('ground and water heat sources move independently while both source pipes remain connected', () => {
  for (const typ of ['sole', 'wasser']) for (const [x, y] of [[0, 50], [200, 100]]) {
    const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ, betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
    assert.equal(layoutTools.layoutAllowed(config, 'quelle'), true);
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, quelle: { x, y } } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, `${typ},${x},${y}`);
    assert.ok(svg.includes(`data-component="quelle" transform="translate(${x} ${y})"`));
    assert.equal(n.ports.get('source.in').x, 400 + x);
    assert.equal(n.ports.get('source.in').y, 404 + y);
    assert.equal(n.ports.get('source.out').x, 430 + x);
    for (const id of ['source_in', 'source_out']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w3"`), id);
    }
    card._hass.states['binary_sensor.wp'].state = 'off';
    const inactive = card._render();
    for (const id of ['source_in', 'source_out']) {
      const p = edge(card._pipeNetwork, id), d = p.route(card._pipeNetwork.ports.get(p.from), card._pipeNetwork.ports.get(p.to));
      assert.equal(inactive.includes(`d="${d}" class="w3"`), false);
    }
  }
  assert.equal(layoutTools.layoutAllowed({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'luft', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] }, 'quelle'), false);
});

test('saved layout survives a serialized editor round trip and reproduces connected geometry', () => {
  const config = { type: 'custom:warmwasser-schema-card', speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf', future_option: false }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], custom_option: { enabled: false } };
  const layout = { version: 1, wp: { x: 200, y: -100 }, quelle: { x: 200, y: 100 }, ruecklauf_abzweig: { x: -20, y: 0 } };
  const Editor = registry.get('warmwasser-schema-card-editor'), editor = new Editor();
  editor._config = config; editor._undo = []; editor._redo = [];
  editor._previewConfig = () => {}; editor._layoutControls = () => {};
  context.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  let saved; editor.dispatchEvent = event => { saved = event.detail.config; };
  assert.equal(editor._layoutSet(layout), true);
  // Round-trip the event payload through a JSON representation, which is also valid YAML 1.2.
  const restored = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(restored.layout, layout);
  assert.equal(restored.wp.future_option, false);
  assert.equal(restored.custom_option.enabled, false);
  const results = [];
  for (const state of ['on', 'off']) {
    const card = new Card(); card.setConfig(restored);
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state } } };
    card._render();
    assert.equal(card._routingError, false);
    const n = card._pipeNetwork;
    results.push(Object.fromEntries(['wp.supply', 'wp.return', 'source.in', 'source.out', 'return.junction'].map(id => [id, { x: n.ports.get(id).x, y: n.ports.get(id).y }])));
    assert.equal(n.ports.get('source.in').x, 800);
    assert.equal(n.ports.get('source.in').y, 404);
    assert.equal(n.ports.get('return.junction').x, 490);
    assert.equal(n.ports.get('return.junction').y, 208.5);
  }
  assert.deepEqual(results[0], results[1]);
});

test('heating circuits face upwards when their manifold is placed above the buffer', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ name: 'Heizkörper', pumpe: 'binary_sensor.hk', typ: 'heizkoerper' }] };
  for (const [x, y, up] of [[-300, -300, true], [400, -400, true], [-200, 200, false]]) {
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, heizkreis: { x, y } } });
    card._hass = { language: 'de', states: { 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, `${x},${y}`);
    assert.equal(n.ports.get('hc.supply').y, (up ? 448 : 420) + y);
    assert.equal(n.ports.get('hc.return').y, (up ? 420 : 448) + y);
    if (up) {
      assert.ok(svg.includes('class="hk-up" transform="translate(0 868) scale(1 -1)"'));
      const [, minY] = svg.match(/viewBox="[^ ]+ ([^ ]+)/);
      assert.ok(Number(minY) <= 868 - (548 + 26 + 40) + y);
      assert.ok(fs.readFileSync(path.join(__dirname, '../warmwasser-schema-card.js'), 'utf8').includes('.hk-up text{transform-box:fill-box;transform-origin:center;transform:scaleY(-1)}'));
    } else assert.equal(svg.includes('class="hk-up"'), false);
    for (const id of ['hk_supply', 'hk_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w3"`), id);
    }
  }
});

test('return-side diverter keeps supply and return connections when components move', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil: 'sensor.valve', ventil_position: 'ruecklauf' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  const positions = { warmwasser: { x: -200, y: -100 }, puffer: { x: -200, y: 100 }, wp: { x: 200, y: -100 }, ventil: { x: -300, y: 0 }, heizkreis: { x: -300, y: -300 }, fm: { x: 200, y: -100 }, quelle: { x: 200, y: 100 } };
  for (const [id, pos] of Object.entries(positions)) for (const target of ['Puffer', 'Warmwasser']) {
    assert.equal(layoutTools.layoutAllowed(config, id), true, id);
    const saved = JSON.parse(JSON.stringify({ ...config, layout: { version: 1, [id]: pos } }));
    const card = new Card(); card.setConfig(saved);
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'sensor.valve': { state: target }, 'binary_sensor.hk': { state: 'on' }, 'binary_sensor.fm': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, `${id}, ${target}`);
    assert.equal(edge(n, 'ww_return').to, 'valve.top');
    assert.equal(edge(n, 'buffer_return').to, 'valve.bottom');
    assert.equal(edge(n, 'wp_return').from, 'valve.side');
    assert.equal(edge(n, 'wp_return').to, 'wp.return');
    assert.equal(edge(n, 'ww_supply').from, 'wp.supply');
    assert.equal(edge(n, 'buffer_supply').from, 'wp.buffer_supply');
    assert.equal(n.junctions.size, 0);
    assert.equal(edge(n, 'ww_supply').active, target === 'Warmwasser');
    assert.equal(edge(n, 'buffer_supply').active, target === 'Puffer');
    for (const pipeId of ['ww_return', 'buffer_return', 'wp_return', 'ww_supply', 'buffer_supply', 'hk_supply', 'hk_return', 'fm_supply', 'fm_return']) {
      const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${id}, ${target}, ${pipeId}`);
    }
    if (id === 'wp') assert.equal(n.ports.get('wp.buffer_supply').y, 227 - 100);
  }
  assert.equal(layoutTools.layoutAllowed(config, 'ruecklauf_abzweig'), false);
});

test('optional common supply creates a true movable supply junction for a return-side valve', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil: 'sensor.valve', ventil_position: 'ruecklauf', vorlauf_anbindung: 'gemeinsam' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  for (const [x, y] of [[0, 0], [-20, 0], [0, 20], [-40, 40]]) for (const target of ['Puffer', 'Warmwasser']) {
    const card = new Card(); card.setConfig({ ...config, ...(x || y ? { layout: { version: 1, vorlauf_abzweig: { x, y } } } : {}) });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'sensor.valve': { state: target }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork, junction = n.ports.get('supply.junction');
    assert.equal(card._routingError, false, `${x},${y},${target}`);
    assert.equal(junction.x, 310 + x); assert.equal(junction.y, 170 + y);
    assert.equal(n.junctions.get('supply.junction').circuit, 'supply');
    assert.equal(layoutTools.editableJunctions(n, config)[0].layoutKey, 'vorlauf_abzweig');
    assert.equal(layoutTools.layoutAllowed(config, 'vorlauf_abzweig'), true);
    assert.ok(svg.includes(`data-component="vorlauf_abzweig"><circle cx="${junction.x}" cy="${junction.y}"`));
    assert.equal(edge(n, 'wp_supply').to, 'supply.junction');
    assert.equal(edge(n, 'ww_supply').from, 'supply.junction');
    assert.equal(edge(n, 'buffer_supply').from, 'supply.junction');
    assert.equal(edge(n, 'ww_supply').active, target === 'Warmwasser');
    assert.equal(edge(n, 'buffer_supply').active, target === 'Puffer');
    for (const id of ['wp_supply', 'ww_supply', 'buffer_supply', 'ww_return', 'buffer_return', 'wp_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${id}, ${x},${y}`);
    }
  }
  assert.equal(layoutTools.layoutReset({ version: 1, vorlauf_abzweig: { x: 20, y: -10 } }), null);
  const unsupported = { ...config, speicher: { typ: 'invalid' }, heizkreise: [] };
  assert.throws(() => new Card().setConfig(unsupported), /Gemeinsamer Vorlauf benötigt/);
});

test('single stratified and baffle-plate tanks without other devices keep fresh-water module connections', () => {
  for (const typ of ['schicht', 'trennblech']) {
    const config = { speicher: { typ }, fm: { pumpe: 'binary_sensor.fm' } };
    for (const [id, pos] of [['fm', { x: 200, y: -100 }], ['fm', { x: -400, y: -100 }], ['speicher', { x: -200, y: -100 }], ['speicher', { x: 200, y: 100 }]]) {
      assert.equal(layoutTools.layoutAllowed(config, id), true);
      const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
      card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' } } };
      const svg = card._render(), n = card._pipeNetwork;
      assert.equal(card._routingError, false, `${typ}, ${id}, ${pos.x}`);
      assert.equal(n.ports.get('ww.fm_return').owner, 'tank');
      assert.equal(n.ports.get('ww.fm_return').y, 376 + (id === 'speicher' ? pos.y : 0));
      for (const pipeId of ['fm_supply', 'fm_return']) {
        const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
        assert.ok(d && svg.includes(`d="${d}" class="w3"`), pipeId);
      }
      assert.equal(layoutTools.layoutAllowed(config, 'warmwasser'), false);
    }
    const original = new Card(); original.setConfig(config); original._hass = { language: 'de', states: {} }; original._render();
    assert.equal(original._pipeNetwork.ports.get('fm.return').x, 452);
    const fmReturn = edge(original._pipeNetwork, 'fm_return');
    assert.ok(fmReturn.route(original._pipeNetwork.ports.get(fmReturn.from), original._pipeNetwork.ports.get(fmReturn.to)).startsWith('M452 90H458'));
  }
});

test('standalone combi and hygienic tanks carry their drinking-water connections when moved', () => {
  for (const typ of ['kombi', 'hygiene']) {
    const config = { speicher: { typ }, zirkulationspumpe: 'switch.zirk', fm: { temp: 'sensor.fm' } };
    assert.equal(layoutTools.layoutAllowed(config, 'speicher'), true);
    assert.equal(layoutTools.layoutAllowed(config, 'fm'), false);
    for (const pos of [{ x: -200, y: -100 }, { x: 200, y: 100 }]) {
      const card = new Card();
      card.setConfig({ ...config, layout: { version: 1, speicher: pos } });
      card._hass = { language: 'de', states: { 'switch.zirk': { state: 'on' } } };
      const svg = card._render();
      const translation = `transform="translate(${pos.x} ${pos.y})"`;
      assert.ok(svg.includes(`data-component="speicher" ${translation}`));
      assert.ok(svg.includes(`<g ${translation}><path d="M164 -6H110"`));
      assert.ok(svg.includes('M110 -26V18'));
      assert.equal(card._routingError, false);
      const viewBox = svg.match(/viewBox="([^\"]+)"/)[1].split(' ').map(Number);
      assert.ok(viewBox[1] <= pos.y - 26, 'drinking-water pipes remain in view');
      assert.ok(viewBox[0] <= pos.x + 72, 'tank remains in view');
    }
    assert.equal(layoutTools.layoutAllowed({ ...config, wp: { betrieb: 'binary_sensor.wp' } }, 'speicher'), true);
  }
});

test('auxiliary heat and solar in a separate-tank system without WP follow independent moves', () => {
  const devices = { kamin: { typ: 'pellet', pumpe: 'binary_sensor.k' }, solar: { pumpe: 'binary_sensor.s' } };
  const config = { speicher: { typ: 'getrennt' }, fm: { pumpe: 'binary_sensor.fm' }, ...devices };
  for (const [id, pos] of [['kamin', { x: -200, y: 0 }], ['solar', { x: -200, y: -100 }], ['speicher', { x: -100, y: 80 }], ['fm', { x: 50, y: -50 }]]) {
    assert.equal(layoutTools.layoutAllowed(config, id), true, id);
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
    card._hass = { language: 'de', states: { 'binary_sensor.k': { state: 'on' }, 'binary_sensor.s': { state: 'on' }, 'binary_sensor.fm': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, id);
    for (const pipeId of ['aux_supply', 'aux_return', 'solar_supply', 'solar_return', 'fm_supply', 'fm_return']) {
      const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w3"`), `${id}, ${pipeId}`);
    }
    assert.equal(n.ports.get('aux.supply').x, -58 + (id === 'kamin' ? pos.x : 0));
    assert.equal(n.ports.get('solar.supply').x, -188 + (id === 'solar' ? pos.x : 0));
    assert.equal(n.ports.get('buffer.solar_supply').y, 374 + (id === 'speicher' ? pos.y : 0));
    if (id === 'kamin' || id === 'solar') assert.ok(svg.includes(`data-component="${id}" transform="translate(${pos.x} ${pos.y})"`));
  }
  assert.equal(layoutTools.layoutAllowed({ ...config, wp: { betrieb: 'binary_sensor.wp' } }, 'kamin'), true);
  assert.equal(layoutTools.layoutAllowed({ ...config, heizkreise: [{ pumpe: 'binary_sensor.hk' }] }, 'solar'), false);
});

test('a hydraulic separator preserves four independent connections when moved', () => {
  const config = { speicher: { typ: 'getrennt' }, weiche: { anzeigen: true }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  assert.equal(layoutTools.layoutAllowed(config, 'weiche'), true);
  for (const pos of [{ x: 5, y: 0 }, { x: -5, y: 0 }, { x: 0, y: -5 }, { x: 0, y: 5 }, { x: 100, y: -100 }, { x: 180, y: 0 }, { x: -40, y: -100 }]) {
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, weiche: pos } });
    card._hass = { language: 'de', states: { 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, JSON.stringify(pos));
    assert.ok(svg.includes(`data-component="weiche" transform="translate(${pos.x} ${pos.y})"`));
    const connections = [
      ['weiche_primary_supply', 'buffer.weiche_supply', 'weiche.primary_supply'],
      ['weiche_secondary_supply', 'weiche.secondary_supply', 'hc.weiche_supply'],
      ['weiche_secondary_return', 'hc.weiche_return', 'weiche.secondary_return'],
      ['weiche_primary_return', 'weiche.primary_return', 'buffer.weiche_return'],
    ];
    for (const [id, from, to] of connections) {
      const p = edge(n, id);
      assert.equal(p.from, from); assert.equal(p.to, to); assert.equal(p.active, true);
      const d = p.route(n.ports.get(from), n.ports.get(to));
      assert.ok(d && svg.includes(`d="${d}" class="w3"`), id);
    }
    assert.equal(n.ports.get('weiche.primary_supply').x, 322 + pos.x);
    assert.equal(n.ports.get('weiche.primary_return').y, 462 + pos.y);
  }
  assert.equal(layoutTools.layoutAllowed({ ...config, wp: { betrieb: 'binary_sensor.wp' } }, 'weiche'), false);
  const saved = layoutTools.layoutChanged({ ...config, layout: { version: 1, weiche: { y: -100, note: 'keep' } } }, 'weiche', 101, 'x');
  assert.equal(saved.weiche.x, 100); assert.equal(saved.weiche.y, -100); assert.equal(saved.weiche.note, 'keep');
  const restored = new Card(); restored.setConfig({ ...config, layout: JSON.parse(JSON.stringify(saved)) });
  restored._hass = { language: 'de', states: {} }; restored._render();
  assert.equal(restored._pipeNetwork.ports.get('weiche.primary_supply').x, 422);
  const overlap = new Card(); overlap.setConfig({ ...config, layout: { version: 1, weiche: { x: -200, y: -200 } } });
  overlap._hass = { language: 'de', states: {} }; overlap._render();
  assert.equal(overlap._routingError, true);
  const original = new Card(); original.setConfig(config); original._hass = { language: 'de', states: {} };
  assert.ok(original._render().includes('data-component="weiche"'));
  assert.equal(original._pipeNetwork.pipes.some(p => p.id.startsWith('weiche_')), false);
  assert.equal(layoutTools.layoutReset({ version: 1, weiche: { x: 20, y: 10 } }), null);
});

test('unsupported combinations retain saved layout and explain when positions cannot be displayed', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x: 80, y: 30 }, puffer: { x: -40 } } };
  const card = new Card();
  card.setConfig({ ...config, speicher: { ...config.speicher, heizkreis_separat: false }, weiche: true, kamin: { pumpe: 'binary_sensor.kamin' } });
  card._hass = { language: 'de', states: {} };
  assert.match(card._render(), /Die gespeicherte Anordnung kann mit dieser Anlagenkonfiguration noch nicht vollständig dargestellt werden/);
  assert.equal(card._cfg.layout.wp.x, 80);
  card._hass = null; card.setConfig(config); card._hass = { language: 'de', states: {} };
  assert.doesNotMatch(card._render(), /Die gespeicherte Anordnung kann mit dieser Anlagenkonfiguration/);
  assert.match(card._render(), /data-component="wp" transform="translate\(80 30\)"/);
});

test('solar thermal and heat pump preserve separate circuit connections and saved positions', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil: 'sensor.valve', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, solar: { pumpe: 'binary_sensor.solar' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  assert.equal(layoutTools.layoutAllowed(config, 'solar'), true);
  for (const layout of [{ wp: { x: 80 } }, { solar: { x: -100, y: -50 } }, { heizkreis: { x: -20, y: 0 } }]) {
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, ...layout } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'sensor.valve': { state: 'Puffer' }, 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.hk': { state: 'on' }, 'binary_sensor.solar': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, JSON.stringify(layout));
    assert.doesNotMatch(svg, /Die gespeicherte Anordnung kann/);
    for (const id of ['solar_supply', 'solar_return', 'hk_supply', 'hk_return', 'ww_supply', 'buffer_supply', 'combined_return', 'fm_supply', 'fm_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${JSON.stringify(layout)} ${id}`);
    }
  }
});

test('solar thermal coexists with the return-side valve and an optional supply junction', () => {
  for (const supply of ['getrennt', 'gemeinsam']) {
    const card = new Card();
    card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'ruecklauf', vorlauf_anbindung: supply }, solar: { pumpe: 'binary_sensor.solar' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x: 80 } } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.solar': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, supply);
    for (const id of ['solar_supply', 'solar_return', 'ww_return', 'buffer_return', 'wp_return', 'ww_supply', 'buffer_supply', 'hk_supply', 'hk_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${supply} ${id}`);
    }
    assert.equal(n.junctions.has('supply.junction'), supply === 'gemeinsam');
  }
});

test('solar with an explicitly shared heat-pump supply also connects the heating circuit without saved layout', () => {
  const card = new Card();
  card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'ruecklauf', vorlauf_anbindung: 'gemeinsam' }, solar: { pumpe: 'binary_sensor.solar' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] });
  card._hass = { language: 'de', states: {} }; card._render();
  assert.equal(card._routingError, false);
  assert.ok(edge(card._pipeNetwork, 'hk_supply'));
  assert.ok(edge(card._pipeNetwork, 'solar_supply'));
});

test('adding solar retains a previously arranged ground-source system', () => {
  const layout = { version: 1, wp: { x: -410, y: -10 }, puffer: { x: 215, y: 5 }, fm: { x: 190, y: 15 }, heizkreis: { x: 395, y: -190 }, ventil: { x: -130, y: -95 }, warmwasser: { x: 215, y: -45 }, ruecklauf_abzweig: { x: 20 } };
  const card = new Card(); card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: true, solar: { pumpe: 'binary_sensor.solar' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout });
  card._hass = { language: 'de', states: {} }; const svg = card._render();
  assert.equal(card._routingError, false);
  assert.match(svg, /data-component="wp" transform="translate\(-410 -10\)"/);
  assert.match(svg, /data-component="puffer" transform="translate\(215 5\)"/);
  assert.ok(edge(card._pipeNetwork, 'solar_supply'));
  assert.ok(edge(card._pipeNetwork, 'solar_return'));
});

test('additional heat has independent buffer ports alongside heat pump and heating circuit', () => {
  const base = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: true, kamin: { typ: 'pellet', pumpe: 'binary_sensor.kamin' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  for (const layout of [{ wp: { x: 80 } }, { kamin: { x: -80, y: -20 } }]) {
    const card = new Card(); card.setConfig({ ...base, layout: { version: 1, ...layout } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.kamin': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, JSON.stringify(layout));
    for (const id of ['aux_supply', 'aux_return', 'wp_supply', 'buffer_supply', 'combined_return', 'hk_supply', 'hk_return', 'fm_supply', 'fm_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), id);
    }
    for (const id of ['supply', 'return']) {
      const a = n.ports.get(`buffer.aux_${id}`), b = n.ports.get(`buffer.hk_${id}`);
      assert.ok(a.x !== b.x || Math.abs(a.y - b.y) >= 14, id);
    }
  }
});

test('additional heat and solar route alongside both valve positions and shared supply', () => {
  for (const [valve, supply] of [['vorlauf', 'getrennt'], ['ruecklauf', 'getrennt'], ['ruecklauf', 'gemeinsam']]) {
    const card = new Card(); card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: valve, vorlauf_anbindung: supply }, fm: true, kamin: { typ: 'pellet', pumpe: 'binary_sensor.kamin' }, solar: { pumpe: 'binary_sensor.solar' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x: 80 } } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.kamin': { state: 'on' }, 'binary_sensor.solar': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, `${valve} ${supply}`);
    for (const id of ['aux_supply', 'aux_return', 'solar_supply', 'solar_return', 'hk_supply', 'hk_return', 'fm_supply', 'fm_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), id);
    }
  }
});

test('a shared supply routes additional heat and solar without a saved layout', () => {
  const card = new Card(); card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'ruecklauf', vorlauf_anbindung: 'gemeinsam' }, kamin: { pumpe: 'binary_sensor.kamin' }, solar: { pumpe: 'binary_sensor.solar' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] });
  card._hass = { language: 'de', states: {} }; card._render();
  assert.equal(card._routingError, false);
  for (const id of ['aux_supply', 'aux_return', 'solar_supply', 'solar_return', 'hk_supply', 'hk_return']) assert.ok(edge(card._pipeNetwork, id), id);
});

test('additional heat refuses overlapping buffer ports when there is insufficient space', () => {
  const card = new Card(); card.setConfig({ speicher: { typ: 'getrennt', trennung: 70, heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, kamin: { pumpe: 'binary_sensor.kamin' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, kamin: { x: 800 }, heizkreis: { x: 400 } } });
  card._hass = { language: 'de', states: {} }; const svg = card._render();
  assert.equal(card._routingError, true);
  assert.match(svg, /Kein freier Rohrweg gefunden/);
});

test('additional heat and solar preserve separate heating-circuit layout without a heat pump', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, fm: { pumpe: 'binary_sensor.fm' }, kamin: { typ: 'pellet', pumpe: 'binary_sensor.kamin' }, solar: { pumpe: 'binary_sensor.solar' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  for (const [id, pos] of [['heizkreis', { x: -30, y: 0 }], ['kamin', { x: -200, y: 0 }], ['solar', { x: -80, y: -30 }], ['puffer', { x: 80, y: 0 }]]) {
    assert.equal(layoutTools.layoutAllowed(config, id), true);
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
    card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.kamin': { state: 'on' }, 'binary_sensor.solar': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, id);
    for (const pipeId of ['aux_supply', 'aux_return', 'solar_supply', 'solar_return', 'hk_supply', 'hk_return', 'fm_supply', 'fm_return']) {
      const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w3"`), `${id}: ${pipeId}`);
    }
    const a = n.ports.get('buffer.aux_supply'), h = n.ports.get('buffer.hk_supply');
    assert.ok(a.x !== h.x || Math.abs(a.y - h.y) >= 14);
  }
});

test('a separator with a fresh-water module keeps four distinct pipes as components move', () => {
  const config = { speicher: { typ: 'getrennt' }, weiche: true, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  for (const [id, pos] of [['fm', { x: 80, y: -30 }], ['puffer', { x: -40, y: 0 }], ['warmwasser', { x: 50, y: -30 }], ['heizkreis', { x: 80, y: 0 }], ['heizkreis', { x: 350, y: -450 }], ['weiche', { x: -280, y: 0 }], ['weiche', { x: 100, y: -100 }]]) {
    assert.equal(layoutTools.layoutAllowed(config, id), true, id);
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
    card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, `${id} ${JSON.stringify(pos)}`);
    for (const pipeId of ['fm_supply', 'fm_return', 'weiche_primary_supply', 'weiche_primary_return', 'weiche_secondary_supply', 'weiche_secondary_return']) {
      const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w3"`), `${id} ${pipeId}`);
    }
    const ports = ['weiche.primary_supply', 'weiche.primary_return', 'weiche.secondary_supply', 'weiche.secondary_return'].map(name => n.ports.get(name));
    assert.equal(new Set(ports.map(p => `${p.x},${p.y}`)).size, 4);
    if (id === 'heizkreis' && pos.y < 0) assert.match(svg, /class="hk-up"/);
  }
});

test('a heat pump and hydraulic separator keep separate ports when components move', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, weiche: true, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  for (const [id, pos] of [['wp', { x: 80, y: 0 }], ['puffer', { x: -40, y: 0 }], ['heizkreis', { x: 80, y: 0 }], ['weiche', { x: -280, y: 0 }], ['fm', { x: 80, y: -30 }]]) {
    assert.equal(layoutTools.layoutAllowed(config, id), true, id);
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, id);
    for (const pipeId of ['fm_supply', 'fm_return', 'ww_supply', 'buffer_supply', 'combined_return', 'weiche_primary_supply', 'weiche_primary_return', 'weiche_secondary_supply', 'weiche_secondary_return']) {
      const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${id}: ${pipeId}`);
    }
    for (const type of ['supply', 'return']) {
      const a = n.ports.get(`buffer.weiche_${type}`), b = n.ports.get(`buffer.wp_${type}`);
      assert.ok(a.x !== b.x || Math.abs(a.y - b.y) >= 14, `${id}: ${type}`);
    }
  }
});

test('hydraulic separator supports both valve positions and heat-pump junction options', () => {
  for (const [valve, supply, returns] of [['ruecklauf', 'getrennt', 'gemeinsam'], ['ruecklauf', 'gemeinsam', 'gemeinsam'], ['vorlauf', 'getrennt', 'getrennt']]) {
    const card = new Card(); card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: valve, vorlauf_anbindung: supply, ruecklauf_anbindung: returns }, weiche: true, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x: 80 } } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, `${valve} ${supply} ${returns}`);
    for (const id of ['weiche_primary_supply', 'weiche_primary_return', 'weiche_secondary_supply', 'weiche_secondary_return', 'fm_supply', 'fm_return', 'ww_supply', 'buffer_supply', 'ww_return', 'buffer_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), id);
    }
    assert.equal(n.junctions.has('supply.junction'), supply === 'gemeinsam');
  }
});

test('adding a hydraulic separator preserves an arranged ground-source layout', () => {
  const layout = { version: 1, wp: { x: -410, y: -10 }, puffer: { x: 215, y: 5 }, fm: { x: 190, y: 15 }, heizkreis: { x: 395, y: -190 }, ventil: { x: -130, y: -95 }, warmwasser: { x: 215, y: -45 }, ruecklauf_abzweig: { x: 20 } };
  const card = new Card(); card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, weiche: true, fm: true, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout });
  card._hass = { language: 'de', states: {} }; const svg = card._render();
  assert.equal(card._routingError, false);
  assert.match(svg, /data-component="wp" transform="translate\(-410 -10\)"/);
  assert.match(svg, /data-component="puffer" transform="translate\(215 5\)"/);
  assert.ok(edge(card._pipeNetwork, 'weiche_primary_supply'));
  assert.ok(edge(card._pipeNetwork, 'weiche_secondary_return'));
});

test('heat pump, separator, additional heat, solar and fresh-water module have separate modeled connections', () => {
  const config = { speicher: { typ: 'getrennt', heizkreis_separat: true }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, weiche: true, fm: { pumpe: 'binary_sensor.fm' }, kamin: { pumpe: 'binary_sensor.k' }, solar: { pumpe: 'binary_sensor.s' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  for (const [id, pos] of [['wp', { x: 80, y: 0 }], ['puffer', { x: -40, y: 0 }], ['heizkreis', { x: 80, y: 0 }], ['weiche', { x: -280, y: 0 }], ['fm', { x: 80, y: -30 }], ['solar', { x: -100, y: -50 }], ['kamin', { x: -200, y: 0 }]]) {
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
    card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.k': { state: 'on' }, 'binary_sensor.s': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, id);
    for (const pipeId of ['fm_supply', 'fm_return', 'weiche_primary_supply', 'weiche_primary_return', 'weiche_secondary_supply', 'weiche_secondary_return', 'aux_supply', 'aux_return', 'solar_supply', 'solar_return', 'wp_supply', 'ww_supply', 'buffer_supply']) {
      const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${id}: ${pipeId}`);
    }
    const ports = ['buffer.wp_supply', 'buffer.wp_return', 'buffer.weiche_supply', 'buffer.weiche_return', 'buffer.aux_supply', 'buffer.aux_return'].map(name => n.ports.get(name));
    for (let i = 0; i < ports.length; i++) for (let j = i + 1; j < ports.length; j++) assert.ok(ports[i].x !== ports[j].x || Math.abs(ports[i].y - ports[j].y) >= 14, `${id}: buffer ports`);
  }
});

test('full separator configurations handle heat-pump valve options or no heat pump', () => {
  for (const wp of [null, { betrieb: 'binary_sensor.wp', ventil_position: 'ruecklauf' }, { betrieb: 'binary_sensor.wp', ventil_position: 'ruecklauf', vorlauf_anbindung: 'gemeinsam' }, { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf', ruecklauf_anbindung: 'getrennt' }]) {
    const card = new Card(); card.setConfig({ speicher: { typ: 'getrennt', heizkreis_separat: true }, wp, weiche: true, fm: true, kamin: { pumpe: 'binary_sensor.k' }, solar: { pumpe: 'binary_sensor.s' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, puffer: { x: -40 } } });
    card._hass = { language: 'de', states: {} }; const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, JSON.stringify(wp));
    for (const id of ['weiche_primary_supply', 'weiche_primary_return', 'weiche_secondary_supply', 'weiche_secondary_return', 'aux_supply', 'aux_return', 'solar_supply', 'solar_return', 'fm_supply', 'fm_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), id);
    }
    if (wp) assert.equal(n.junctions.has('supply.junction'), wp.vorlauf_anbindung === 'gemeinsam');
  }
});

test('single-tank types retain movable solar and additional heat connections', () => {
  for (const typ of ['schicht', 'trennblech', 'kombi', 'hygiene']) {
    const config = { speicher: { typ }, ...(['schicht', 'trennblech'].includes(typ) ? { fm: { pumpe: 'binary_sensor.fm' } } : {}), kamin: { pumpe: 'binary_sensor.k' }, solar: { pumpe: 'binary_sensor.s' } };
    for (const [id, pos] of [['speicher', { x: 80, y: 40 }], ['kamin', { x: -200, y: 0 }], ['solar', { x: -100, y: -30 }]]) {
      assert.equal(layoutTools.layoutAllowed(config, id), true, `${typ}: ${id}`);
      const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
      card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.k': { state: 'on' }, 'binary_sensor.s': { state: 'on' } } };
      const svg = card._render(), n = card._pipeNetwork;
      assert.equal(card._routingError, false, `${typ}: ${id}`);
      for (const pipeId of ['aux_supply', 'aux_return', 'solar_supply', 'solar_return', ...(['schicht', 'trennblech'].includes(typ) ? ['fm_supply', 'fm_return'] : [])]) {
        const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
        assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${typ}: ${id}: ${pipeId}`);
      }
      assert.equal(n.ports.get('buffer.aux_supply').owner, 'tank');
      assert.equal(n.ports.get('buffer.solar_supply').owner, 'tank');
    }
  }
});

test('single tanks with heating circuits keep their independent solar and heat connections while moving', () => {
  for (const typ of ['schicht', 'trennblech', 'kombi', 'hygiene']) {
    const config = { speicher: { typ }, ...(['schicht', 'trennblech'].includes(typ) ? { fm: { pumpe: 'binary_sensor.fm' } } : {}), kamin: { pumpe: 'binary_sensor.k' }, solar: { pumpe: 'binary_sensor.s' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
    for (const [id, pos] of [['speicher', { x: 80, y: -80 }], ['kamin', { x: -200, y: 0 }], ['solar', { x: -100, y: -30 }], ['heizkreis', { x: 50, y: 0 }], ['heizkreis', { x: 350, y: -450 }]]) {
      assert.equal(layoutTools.layoutAllowed(config, id), true, `${typ}: ${id}`);
      const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
      card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.k': { state: 'on' }, 'binary_sensor.s': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
      const svg = card._render(), n = card._pipeNetwork;
      assert.equal(card._routingError, false, `${typ}: ${id}`);
      for (const pipeId of ['aux_supply', 'aux_return', 'solar_supply', 'solar_return', 'hk_supply', 'hk_return', ...(['schicht', 'trennblech'].includes(typ) ? ['fm_supply', 'fm_return'] : [])]) {
        const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
        assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${typ}: ${id}: ${pipeId}`);
      }
      assert.equal(n.ports.get('buffer.hk_supply').owner, 'tank');
      if (id === 'heizkreis' && pos.y < 0) assert.match(svg, /class="hk-up"/);
    }
  }
});

test('single tanks can move with heat pump, heating circuit and additional sources', () => {
  for (const typ of ['schicht', 'trennblech', 'kombi', 'hygiene']) {
    const config = { speicher: { typ }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, ...(['schicht', 'trennblech'].includes(typ) ? { fm: { pumpe: 'binary_sensor.fm' } } : {}), kamin: { pumpe: 'binary_sensor.k' }, solar: { pumpe: 'binary_sensor.s' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
    for (const [id, pos] of [['wp', { x: 80, y: 0 }], ['speicher', { x: -30, y: 0 }], ['heizkreis', { x: 50, y: 0 }], ['kamin', { x: -200, y: 0 }], ['solar', { x: -100, y: -30 }]]) {
      assert.equal(layoutTools.layoutAllowed(config, id), true, `${typ}: ${id}`);
      const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
      card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.k': { state: 'on' }, 'binary_sensor.s': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
      const svg = card._render(), n = card._pipeNetwork;
      assert.equal(card._routingError, false, `${typ}: ${id}`);
      for (const pipeId of ['wp_supply', 'ww_supply', 'buffer_supply', 'ww_return', 'buffer_return', 'hk_supply', 'hk_return', 'aux_supply', 'aux_return', 'solar_supply', 'solar_return', ...(['schicht', 'trennblech'].includes(typ) ? ['fm_supply', 'fm_return'] : [])]) {
        const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
        assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${typ}: ${id}: ${pipeId}`);
      }
      for (const name of ['ww.wp_supply', 'ww.wp_return', 'buffer.wp_supply', 'buffer.wp_return', 'buffer.hk_supply', 'buffer.hk_return']) assert.equal(n.ports.get(name).owner, 'tank', `${typ}: ${name}`);
      assert.match(svg, /M400 372V540Q400 552/);
    }
  }
});

test('single tanks support return valves, supply junctions and separate returns', () => {
  for (const typ of ['schicht', 'trennblech', 'kombi', 'hygiene']) for (const [valve, supply, returns] of [['ruecklauf', 'getrennt', 'gemeinsam'], ['ruecklauf', 'gemeinsam', 'gemeinsam'], ['vorlauf', 'getrennt', 'getrennt']]) {
    const card = new Card(); card.setConfig({ speicher: { typ }, wp: { typ: 'sole', betrieb: 'binary_sensor.wp', ventil_position: valve, vorlauf_anbindung: supply, ruecklauf_anbindung: returns }, ...(['schicht', 'trennblech'].includes(typ) ? { fm: { pumpe: 'binary_sensor.fm' } } : {}), kamin: { pumpe: 'binary_sensor.k' }, solar: { pumpe: 'binary_sensor.s' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }], layout: { version: 1, wp: { x: 80 } } });
    card._hass = { language: 'de', states: {} }; const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, `${typ}: ${valve}, ${supply}, ${returns}`);
    for (const id of ['ww_supply', 'buffer_supply', 'ww_return', 'buffer_return', 'hk_supply', 'hk_return', 'aux_supply', 'aux_return', 'solar_supply', 'solar_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${typ}: ${id}`);
    }
    assert.equal(n.junctions.has('supply.junction'), supply === 'gemeinsam');
  }
});

test('single tanks support movable hydraulic separators with heat pump and additional sources', () => {
  for (const typ of ['schicht', 'trennblech', 'kombi', 'hygiene']) {
    const config = { speicher: { typ }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, weiche: true, ...(['schicht', 'trennblech'].includes(typ) ? { fm: { pumpe: 'binary_sensor.fm' } } : {}), kamin: { pumpe: 'binary_sensor.k' }, solar: { pumpe: 'binary_sensor.s' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
    for (const [id, pos] of [['wp', { x: 80, y: 0 }], ['speicher', { x: -30, y: 0 }], ['heizkreis', { x: 50, y: 0 }], ['weiche', { x: -280, y: 0 }], ['kamin', { x: -200, y: 0 }], ['solar', { x: -100, y: -30 }]]) {
      assert.equal(layoutTools.layoutAllowed(config, id), true, `${typ}: ${id}`);
      const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
      card._hass = { language: 'de', states: { 'binary_sensor.wp': { state: 'on' }, 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.k': { state: 'on' }, 'binary_sensor.s': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
      const svg = card._render(), n = card._pipeNetwork;
      assert.equal(card._routingError, false, `${typ}: ${id}`);
      for (const pipeId of ['wp_supply', 'ww_supply', 'buffer_supply', 'ww_return', 'buffer_return', 'weiche_primary_supply', 'weiche_primary_return', 'weiche_secondary_supply', 'weiche_secondary_return', 'aux_supply', 'aux_return', 'solar_supply', 'solar_return', ...(['schicht', 'trennblech'].includes(typ) ? ['fm_supply', 'fm_return'] : [])]) {
        const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
        assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${typ}: ${id}: ${pipeId}`);
      }
      assert.equal(n.ports.get('buffer.weiche_supply').owner, 'tank');
    }
  }
});

test('single tanks with heat pump and no displayed heating circuit retain their connections', () => {
  for (const typ of ['schicht', 'trennblech', 'kombi', 'hygiene']) {
    const config = { speicher: { typ }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, ...(['schicht', 'trennblech'].includes(typ) ? { fm: { pumpe: 'binary_sensor.fm' } } : {}), kamin: { pumpe: 'binary_sensor.k' }, solar: { pumpe: 'binary_sensor.s' } };
    for (const [id, pos] of [['wp', { x: 80, y: 0 }], ['speicher', { x: -30, y: 0 }], ['kamin', { x: -200, y: 0 }], ['solar', { x: -100, y: -30 }]]) {
      assert.equal(layoutTools.layoutAllowed(config, id), true, `${typ}: ${id}`);
      const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } }); card._hass = { language: 'de', states: {} };
      const svg = card._render(), n = card._pipeNetwork;
      assert.equal(card._routingError, false, `${typ}: ${id}`);
      for (const pipeId of ['wp_supply', 'ww_supply', 'buffer_supply', 'ww_return', 'buffer_return', 'aux_supply', 'aux_return', 'solar_supply', 'solar_return']) {
        const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
        assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${typ}: ${id}: ${pipeId}`);
      }
      assert.equal(n.ports.get('buffer.wp_return').owner, 'tank');
    }
  }
});

test('separate tanks with heat pump and no heating circuit keep their connections', () => {
  const config = { speicher: { typ: 'getrennt' }, wp: { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf' }, fm: { pumpe: 'binary_sensor.fm' }, kamin: { pumpe: 'binary_sensor.k' }, solar: { pumpe: 'binary_sensor.s' } };
  for (const [id, pos] of [['wp', { x: 80, y: 0 }], ['puffer', { x: 20, y: -10 }], ['warmwasser', { x: 30, y: -30 }], ['kamin', { x: -200, y: 0 }], ['solar', { x: -100, y: -30 }], ['ventil', { x: 0, y: 10 }]]) {
    assert.equal(layoutTools.layoutAllowed(config, id), true, id);
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } }); card._hass = { language: 'de', states: {} };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, id);
    for (const pipeId of ['wp_supply', 'ww_supply', 'buffer_supply', 'ww_return', 'buffer_return', 'aux_supply', 'aux_return', 'solar_supply', 'solar_return', 'fm_supply', 'fm_return']) {
      const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${id}: ${pipeId}`);
    }
  }
});

test('heat-pump connection variants also work without a displayed heating circuit', () => {
  for (const typ of ['getrennt', 'schicht', 'trennblech', 'kombi', 'hygiene']) for (const wp of [
    { betrieb: 'binary_sensor.wp', ventil_position: 'ruecklauf' },
    { betrieb: 'binary_sensor.wp', ventil_position: 'ruecklauf', vorlauf_anbindung: 'gemeinsam' },
    { betrieb: 'binary_sensor.wp', ventil_position: 'vorlauf', ruecklauf_anbindung: 'getrennt' },
  ]) {
    const card = new Card(); card.setConfig({ speicher: { typ }, wp, layout: { version: 1, wp: { x: 80 } } });
    card._hass = { language: 'de', states: {} };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, `${typ}: ${JSON.stringify(wp)}`);
    for (const id of ['ww_supply', 'buffer_supply', 'ww_return', 'buffer_return']) {
      const p = edge(n, id), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${typ}: ${id}`);
    }
    assert.equal(n.junctions.has('supply.junction'), wp.vorlauf_anbindung === 'gemeinsam');
  }
});

test('separate tanks without a heat pump or other sources can move a heating circuit without the separate-port setting', () => {
  const config = { speicher: { typ: 'getrennt' }, fm: { pumpe: 'binary_sensor.fm' }, heizkreise: [{ pumpe: 'binary_sensor.hk' }] };
  for (const [id, pos] of [['puffer', { x: -30 }], ['heizkreis', { x: 50 }], ['heizkreis', { x: 350, y: -450 }], ['fm', { x: 80, y: -30 }]]) {
    assert.equal(layoutTools.layoutAllowed(config, id), true, id);
    const card = new Card(); card.setConfig({ ...config, layout: { version: 1, [id]: pos } });
    card._hass = { language: 'de', states: { 'binary_sensor.fm': { state: 'on' }, 'binary_sensor.hk': { state: 'on' } } };
    const svg = card._render(), n = card._pipeNetwork;
    assert.equal(card._routingError, false, id);
    for (const pipeId of ['fm_supply', 'fm_return', 'hk_supply', 'hk_return']) {
      const p = edge(n, pipeId), d = p.route(n.ports.get(p.from), n.ports.get(p.to));
      assert.ok(d && svg.includes(`d="${d}" class="w1"`), `${id}: ${pipeId}`);
    }
  }
});
