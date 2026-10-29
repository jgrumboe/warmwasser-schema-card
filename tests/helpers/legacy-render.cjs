// Shared deterministic scenarios for rendered-output characterization and model tests.
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const FixedDate = class extends Date {
  constructor(...args) { super(...(args.length ? args : ['2025-03-15T12:00:00Z'])); }
  static now() { return Date.parse('2025-03-15T12:00:00Z'); }
};
function cardClass(source) {
  const registry = new Map();
  vm.runInNewContext(source, { HTMLElement: class {}, customElements: { get: n => registry.get(n), define: (n, c) => registry.set(n, c) }, window: {}, console: { info() {} }, Date: FixedDate });
  return registry.get('warmwasser-schema-card');
}
const entity = name => `sensor.${name}`;
const state = (value, unit) => ({ state: String(value), attributes: unit ? { unit_of_measurement: unit } : {} });
const states = {
  'sensor.top': state(53.2), 'sensor.bottom': state(32.7), 'sensor.power': state(1650, 'W'),
  'sensor.operation': state('on'), 'sensor.valve': state('warmwasser'), 'sensor.lock': state('off'),
  'sensor.defrost': state('off'), 'sensor.cool': state('off'), 'sensor.pump': state('on'),
  'sensor.flow': state(4.2), 'sensor.temp': state(46.3), 'sensor.mixer': state(35),
  'sensor.target': state(42), 'sensor.room': state(21.5), 'sensor.energy': state(12.3, 'kWh'),
  'sensor.trend': state('steigend'), 'sensor.mode': state('auto'), 'sensor.legionella': state('2025-03-12T12:00:00Z'),
  'sensor.unavailable': state('unavailable'), 'sensor.off': state('off'),
};
function base() {
  return { fuehler: [{ name: 'Oben & heiß', entity: entity('top'), hoehe: 15 }, ['Unten', entity('bottom'), 85]],
    legionellen: { letzte: entity('legionella') }, energie: [{ name: 'Strom', entity: entity('energy') }] };
}
function scenarios() {
  const out = [];
  const add = (name, config, overrides = {}, language = 'de') => out.push({ name, config, states: { ...states, ...overrides }, language });
  const types = ['trennblech', 'schicht', 'kombi', 'hygiene', 'getrennt'];
  const wpStates = [null, 'on', 'off', 'unavailable'];
  const valves = ['warmwasser', 'heizung', '0.35', 'missing'];
  for (const typ of types) for (const split of [35, 50, 70]) for (let i = 0; i < 20; i++) {
    const count = i % 7, wpState = wpStates[i % 4], valve = valves[Math.floor(i / 4) % 4];
    const config = { ...base(), speicher: { typ, trennung: split, volumen: 800, volumen_ww: 250 },
      heizkreise: Array.from({ length: count }, (_, n) => ({ name: `Kreis ${n + 1}`, pumpe: entity(n % 2 ? 'off' : 'pump'), ...(n % 2 === 0 ? { mischer: entity('mixer') } : {}), vorlauf: entity('temp'), vorlauf_soll: entity('target'), raum: entity('room'), wmz: entity('energy') })),
      ...(i % 3 === 0 ? { weiche: true } : i % 3 === 1 ? { weiche: { temp: entity('temp') } } : {}),
      ...(i % 4 === 0 ? { fm: true } : i % 4 === 1 ? { fm: { pumpe: entity('pump'), durchfluss: entity('flow'), temp: entity('temp') } } : {}),
      ...(i % 5 === 0 ? { zirkulationspumpe: entity('pump') } : {}),
      ...(wpState === null ? {} : { wp: { typ: ['luft', 'sole', 'wasser'][i % 3], betrieb: entity('operation'), leistung: entity('power'), ...(valve === 'missing' ? {} : { ventil: entity('valve') }), sperre: entity('lock'), abtauen: entity('defrost'), kuehlen: entity('cool') } }),
    };
    add(`${typ}/split-${split}/case-${String(i).padStart(2, '0')}`, config, { 'sensor.operation': state(wpState), 'sensor.valve': state(valve), 'sensor.lock': state(i === 17 ? 'on' : 'off'), 'sensor.defrost': state(i === 13 ? 'on' : 'off'), 'sensor.cool': state(i === 9 ? 'on' : 'off') }, i % 2 ? 'en' : 'de');
  }
  for (const typ of ['kamin', 'holzvergaser', 'pellet', 'gas', 'oel', 'fernwaerme', 'bhkw']) {
    add(`zusatz-${typ}`, { ...base(), zusatzwaerme: { typ, temp: entity('temp'), trend: entity('trend'), pumpe: entity('pump'), modus: entity('mode') }, solar: { pumpe: entity('pump'), leistung: entity('power'), kollektor: entity('temp'), wmz: entity('energy') } });
  }
  // Combinations exercise shared hydraulic paths and the legacy entity-to-output boundary.
  for (const typ of ['getrennt', 'schicht', 'hygiene']) {
    add(`full-system-${typ}`, { ...base(), speicher: { typ, trennung: 50 },
      wp: { typ: 'sole', betrieb: entity('operation'), leistung: entity('power'), ventil: entity('valve'),
        quelle_pumpe: entity('pump'), quelle_ein: entity('temp'), quelle_aus: entity('bottom'),
        vorlauf: entity('top'), ruecklauf: entity('bottom'), cop: entity('mixer'), wmz: entity('energy'),
        waerme: entity('power'), sg_ready: entity('mode'), sperre: entity('lock'), abtauen: entity('defrost'), kuehlen: entity('cool') },
      fm: { pumpe: entity('pump'), durchfluss: entity('flow'), temp: entity('temp') },
      solar: { pumpe: entity('pump'), kollektor: entity('top'), leistung: entity('power'), wmz: entity('energy') },
      zusatzwaerme: { typ: 'holzvergaser', temp: entity('temp'), pumpe: entity('pump'), modus: entity('mode'), trend: entity('trend') },
      weiche: { temp: entity('temp') }, heizkreise: [{ pumpe: entity('pump'), mischer: entity('mixer'), vorlauf: entity('temp'), raum: entity('room') }],
      heizstab_oben: { stufe: entity('mixer'), leistung: entity('power'), temp: entity('top') },
      heizstab_unten: { leistung: entity('power'), temp: entity('bottom') }, zirkulationspumpe: entity('pump') });
  }
  // Purposeful, independent edge cases for the remaining component migration.
  for (const source of ['kamin', 'holzvergaser', 'pellet', 'gas', 'oel', 'fernwaerme', 'bhkw']) {
    for (const tank of ['getrennt', 'schicht']) for (const active of [false, true]) {
      add(`source-combination/${source}/${tank}/${active ? 'on' : 'off'}`, {
        ...base(), speicher: { typ: tank }, wp: { betrieb: entity('operation'), ventil: entity('valve') },
        zusatzwaerme: { typ: source, temp: entity('temp'), pumpe: entity('pump'), brenner: entity('pump'), modus: entity('mode') },
        solar: { pumpe: entity('pump'), kollektor: entity('top') }, weiche: true,
        heizkreise: [{ pumpe: entity('pump'), mischer: entity('mixer') }], fm: true
      }, { 'sensor.pump': state(active ? 'on' : 'off'), 'sensor.operation': state(active ? 'off' : 'on') });
    }
  }
  for (let count = 0; count <= 6; count++) for (const weiche of [false, true]) for (const mix of [-100, 0, 100, 'unknown']) {
    add(`circuits/${count}/weiche-${weiche}/mix-${mix}`, { speicher: { typ: 'getrennt' }, weiche,
      wp: { betrieb: entity('operation') }, heizkreise: Array.from({ length: count }, (_, n) => ({
        name: `HK ${n + 1}`, pumpe: entity(n % 2 ? 'off' : 'pump'), mischer: entity('mixer'), vorlauf: entity('temp') }))
    }, { 'sensor.mixer': state(mix) });
  }
  for (const mode of ['pump-on', 'pump-off', 'fallback-on', 'fallback-off', 'no-pump-or-power']) {
    const solar = { kollektor: entity('top'), wmz: entity('energy') };
    if (mode.startsWith('pump')) { solar.pumpe = entity('pump'); solar.leistung = entity('power'); }
    if (mode.startsWith('fallback')) solar.leistung = entity('power');
    add(`solar/${mode}`, { speicher: { typ: 'schicht' }, solar, wp: { betrieb: entity('operation') } }, {
      'sensor.pump': state(mode === 'pump-on' ? 'on' : 'off'), 'sensor.power': state(mode === 'fallback-off' ? 0 : 1650)
    });
  }
  for (const tank of types) for (const mode of ['none', 'fm', 'draw', 'circulation', 'pump-off-draw', 'pump-on-no-draw', 'both']) {
    const fm = { temp: entity('temp'), durchfluss: entity('flow') };
    if (mode.startsWith('pump') || mode === 'both') fm.pumpe = entity('pump');
    add(`water/${tank}/${mode}`, { speicher: { typ: tank }, trinkwasser: { temp: entity('temp'), zaehler: entity('energy'), enthaertung: entity('operation') },
      ...(mode === 'none' ? {} : { fm: mode === 'fm' ? true : fm }),
      ...(mode === 'circulation' || mode === 'both' ? { zirkulationspumpe: entity('operation') } : {})
    }, { 'sensor.flow': state(['draw', 'pump-off-draw', 'both'].includes(mode) ? 4.2 : 0), 'sensor.pump': state(mode === 'pump-off-draw' ? 'off' : 'on') });
  }
  for (const typ of ['sole', 'wasser', 'luft']) for (const wpOn of [false, true]) for (const pumpOn of [false, true]) {
    add(`wp-source/${typ}/wp-${wpOn}/source-${pumpOn}`, { wp: { typ, betrieb: entity('operation'), quelle_pumpe: entity('pump'), quelle_ein: entity('top'), quelle_aus: entity('bottom'), vorlauf: entity('temp'), ruecklauf: entity('bottom') } },
      { 'sensor.operation': state(wpOn ? 'on' : 'off'), 'sensor.pump': state(pumpOn ? 'on' : 'off') });
  }
  for (const mode of ['zero', 'step', 'power', 'step-zero-power', 'unavailable']) {
    add(`heaters/${mode}`, { speicher: { typ: 'trennblech' }, fuehler: [['Top', entity('top'), 0], ['Bottom', entity('bottom'), 100]],
      heizstab_oben: { ...(mode === 'power' ? {} : { stufe: entity('mixer') }), leistung: entity('power'), temp: entity('top') },
      heizstab_unten: { leistung: entity('power'), temp: entity('bottom') }
    }, { 'sensor.mixer': state(mode === 'step' ? 3 : mode === 'unavailable' ? 'unavailable' : 0),
      'sensor.power': state(['power', 'step', 'step-zero-power'].includes(mode) ? 1650 : mode === 'unavailable' ? 'unavailable' : 0) });
  }
  add('split-35-fm-wp-upper-heater', { ...base(), speicher: { typ: 'getrennt', trennung: 35 },
    fm: { pumpe: entity('pump'), temp: entity('temp'), durchfluss: entity('flow') },
    wp: { betrieb: entity('operation'), leistung: entity('power'), ventil: entity('valve') },
    heizstab_oben: { stufe: entity('mixer'), leistung: entity('power'), temp: entity('top') } });
  add('minimal-stub-config', { speicher: { typ: 'trennblech' }, fuehler: [] });
  add('wp-minimal-operation', { wp: { betrieb: entity('operation') } });
  add('heizstaebe-off-unavailable', { heizstab_oben: { stufe: entity('off'), leistung: entity('off'), temp: entity('unavailable') },
    heizstab_unten: { stufe: entity('unavailable'), leistung: entity('unavailable'), temp: entity('bottom') } });
  add('zirkulation-alone', { zirkulationspumpe: entity('pump') });
  add('legacy-aliases', { trennung: false, volumen: 500, wp_leistung: entity('power'), wp_schwelle: 300, kamin: { temp: entity('temp'), pumpe: entity('pump') }, fuehler: [['Alt', entity('top'), 20]], pv: entity('power'), aussen: entity('temp') });
  add('wp-missing-valve', { wp: { leistung: entity('power'), typ: 'sole' } });
  add('all-unavailable', { fuehler: [['?', entity('unavailable'), 50]], wp: { betrieb: entity('unavailable'), ventil: entity('unavailable') }, fm: { pumpe: entity('unavailable') }, heizkreise: [{ pumpe: entity('unavailable'), mischer: entity('unavailable') }] }, {}, 'en');
  return out;
}
function render(Card, scenario) {
  const card = new Card();
  card.setConfig(scenario.config);
  card._hass = { states: scenario.states, language: scenario.language };
  return card._render();
}
const hash = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
module.exports = { cardClass, scenarios, render, hash, readSource: p => fs.readFileSync(p, 'utf8') };
