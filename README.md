# Warmwasser Schema Card

An animated hydraulic diagram for Home Assistant: storage tank, fresh water module with circulation, heat pump, immersion heaters, solar thermal, an additional heat source (stove, wood boiler, pellets, gas, oil, district heating, CHP), hydraulic separator and up to six mixed heating circuits.

> ℹ️ **Made in Austria 🇦🇹** – this card was developed in German. The card itself is fully translated and displays everything in English (it follows your Home Assistant language). Only the **configuration keys** are German, e.g. `fuehler` (sensors), `speicher` (tank), `heizkreise` (heating circuits). The easiest way is the **visual editor** – all fields there are labelled in English. The tables below explain every key.

<table>
  <tr>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/mariofritzer/warmwasser-schema-card/main/screenshot.png" width="260"><br>
      <b>Light theme</b><br>
      <sub>Brine heat pump, diverter valve, stove, hydraulic separator</sub>
    </td>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/mariofritzer/warmwasser-schema-card/main/screenshot-dark.png" width="260"><br>
      <b>Dark theme</b><br>
      <sub>Same system in dark mode</sub>
    </td>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/mariofritzer/warmwasser-schema-card/main/example-en.png" width="260"><br>
      <b>Cooling mode</b><br>
      <sub>Water heat pump, district heating, 5 circuits</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/mariofritzer/warmwasser-schema-card/main/ex-minimal.png" width="260"><br>
      <b>Minimal</b><br>
      <sub>Stratified buffer tank with one floor heating circuit</sub>
    </td>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/mariofritzer/warmwasser-schema-card/main/ex-kombi-pellet-solar.png" width="260"><br>
      <b>Combi tank</b><br>
      <sub>Tank-in-tank, pellet boiler, solar thermal</sub>
    </td>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/mariofritzer/warmwasser-schema-card/main/ex-hygiene-gas.png" width="260"><br>
      <b>Hygienic tank</b><br>
      <sub>Stainless coil, gas boiler, legionella status</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/mariofritzer/warmwasser-schema-card/main/ex-getrennt-bhkw.png" width="260"><br>
      <b>Separate tanks</b><br>
      <sub>Hot water + buffer, CHP, heat pump</sub>
    </td>
    <td align="center" width="33%">
      <img src="https://raw.githubusercontent.com/mariofritzer/warmwasser-schema-card/main/ex-energie-dark.png" width="260"><br>
      <b>Daily energy</b><br>
      <sub>Heat pump details, heater, energy bars</sub>
    </td>
  </tr>
</table>

- **Everything is optional:** every device and every single value only appears when you configure an entity for it
- **Visual editor:** set everything up in the dashboard editor – no YAML required
- **German and English:** follows your Home Assistant language, or set `sprache: de` / `sprache: en`
- **Rendered in the browser:** no server-side template rendering, visible immediately after loading
- Tank temperature as a colour gradient from any number of sensors
- Flow animation in every pipe, driven by pumps, mixer position, diverter valve and tapping
- Mixer simulation: share of buffer and return water shown through colour and flow speed
- Clickable: pump mode of the additional heat source, circulation pump on/off, more-info dialog for every value
- Works with light and dark themes

## Installation

### HACS

1. HACS → ⋮ → **Custom repositories**
2. Add this repository's URL, category **Dashboard**
3. Install “Warmwasser Schema Card” and reload the browser

### Manual

1. Copy `warmwasser-schema-card.js` to `/config/www/`
2. Settings → Dashboards → ⋮ → **Resources** → Add resource
   - URL: `/local/warmwasser-schema-card.js`
   - Type: **JavaScript module**
3. Reload the browser (Ctrl+F5)

## Configuration

Add the card via **Add card → Warmwasser Schema Card** and configure it in the visual editor, or use YAML.
The configuration keys are German; the table below gives the English meaning.

Minimal:

```yaml
type: custom:warmwasser-schema-card
fuehler:
  - { name: Top, entity: sensor.tank_top }
  - { name: Bottom, entity: sensor.tank_bottom }
```

A complete, commented example is in [`beispiel.yaml`](https://github.com/mariofritzer/warmwasser-schema-card/blob/main/beispiel.yaml).

### General

| Key | Default | Meaning |
|---|---|---|
| `titel` | depends on language | Title |
| `sprache` | `auto` | `auto`, `de`, `en` |
| `hersteller` | `HOVAL` | Label on FWM and heat pump |
| `name_wp`, `name_fm` | `WP`, `FM` | Device names |
| `fuehler` | – | Tank sensors top → bottom: `{ name, entity, hoehe }` (height 0–100 %) or `[name, entity, height]` |
| `t_min`, `t_max` | `40`, `55` | Colour scale of the tank (°C) |
| `hs_stufen` | `7` | Steps of the immersion heaters |
| `aussen` | – | Outdoor temperature (header) |
| `pv` | – | PV power in W (header) |
| `zirkulationspumpe` | – | Circulation pump, click toggles it |
| `farben` | – | `aktiv`, `warm`, `kalt`, `led`, `solar`, `quelle`, `tw_kalt`, `tw_warm`, `geraet_hell`, `geraet_dunkel` |

### `speicher` – storage tank

| Key | Default | Meaning |
|---|---|---|
| `typ` | `trennblech` | `trennblech` (2 zones with baffle plate), `schicht` (stratified), `kombi` (tank-in-tank), `hygiene` (stainless coil), `getrennt` (separate hot water + buffer tank) |
| `volumen` | – | Volume in litres (buffer for `getrennt`) |
| `volumen_ww` | – | Hot water tank volume (`getrennt` only) |
| `trennung` | `50` | Height of baffle / split / inner boiler in % (35–70) |
| `heizkreis_separat` | `false` | With `typ: getrennt`, draw separate heating circuit supply and return connections at the buffer. With solar, additional heat or a hydraulic separator and a heat pump this is available with a saved layout or shared supply. |

### `wp` – heat pump

| Key | Meaning |
|---|---|
| `typ` | `luft` (air), `sole` (brine / ground probe), `wasser` (water / well) |
| `leistung`, `schwelle` | Electrical power (W); running above threshold (default 100) |
| `betrieb` | Alternative: entity that is `on` while running |
| `vorlauf`, `ruecklauf` | Flow / return temperature |
| `waerme`, `wmz`, `cop` | Heat output, heat meter (kWh), COP |
| `ventil` | Diverter valve: `on`/`off`, 0–100, or text containing e.g. “Warmwasser/DHW” or “Heizung/heating”. Without it, both zones are shown as charging. |
| `ventil_position` | `ruecklauf` (return; default, preserves the previous diagram) or `vorlauf` (supply): location of the diverter valve in the diagram. |
| `ruecklauf_anbindung` | With `ventil_position: vorlauf`, `gemeinsam` (combined, default) or `getrennt` (separate tank returns to the heat pump). |
| `vorlauf_anbindung` | With a return-side valve: `getrennt` (default) or `gemeinsam` for a combined heat-pump supply with a junction. The combined option requires a supported configuration; separate tanks with a heating circuit require separate heating-circuit connections. |
| `kuehlen` | Cooling mode – heating circuit colours are swapped |
| `sperre`, `abtauen`, `sg_ready` | Grid lock, defrost, SG Ready |
| `quelle_ein`, `quelle_aus`, `quelle_pumpe` | Source temperatures and source pump |

### `heizstab_oben`, `heizstab_unten` – immersion heaters

`name`, `stufe` (step), `temp`, `leistung` (power).

### `kamin` – additional heat source

| Key | Default | Meaning |
|---|---|---|
| `typ` | `kamin` | `kamin` (stove), `holzvergaser`, `pellet`, `gas`, `oel`, `fernwaerme` (district heating), `bhkw` (CHP) |
| `temp`, `trend` | – | Boiler temperature, trend (`rising`/`falling`, `steigend`/`fallend`) |
| `brenner` | – | Burner / running (`on`) instead of temperature thresholds |
| `pumpe`, `modus` | – | Pump to the buffer, pump mode `input_select` (click cycles it) |
| `warm`, `feuer` | `30`, `35` | Embers / fire from this temperature |
| `abgas`, `zuluft` | – | Flue gas temperature, air damper |
| `leistung`, `leistung_el`, `wmz` | – | Heat output, electrical output (CHP), heat meter |

### Other devices

| Block | Keys |
|---|---|
| `solar` | `kollektor`, `pumpe`, `leistung`, `wmz`, `name` |
| `fm` (fresh water module) | `temp`, `durchfluss` (l/min – pipes flow while tapping), `pumpe`; `fm: true` shows it without sensors |
| `trinkwasser` (drinking water) | `temp` (cold water), `zaehler` (water meter), `enthaertung` (softener) |
| `weiche` (hydraulic separator) | `temp`; `weiche: true` shows it without sensor |
| `legionellen` | `letzte` (timestamp, date or days), `aktiv`, `tage` (warning threshold, default 7) |
| `energie` | List of `{ name, entity, icon, farbe }` – bars below the diagram |

### `heizkreise` – heating circuits (1–6)

| Key | Meaning |
|---|---|
| `name` | Label |
| `pumpe` | `on` or value > 0 = running |
| `mischer` | −100 = return only, 0 = half/half, 100 = buffer only |
| `vorlauf`, `vorlauf_soll`, `raum`, `wmz` | Flow, flow target, room temperature, heat meter |
| `typ` | `fussboden` (floor heating) or `heizkoerper` (radiators) |

### Arrange the diagram

In the card editor, open **Arrange diagram** to select a component and move it using the arrow buttons or by dragging. Positions are stored in the optional `layout` section of the card configuration. Undo and redo apply to the current editor session; **Reset** removes the editable positions.

With separate hot-water and buffer tanks, separate heating-circuit connections and a supply-side or return-side diverter valve, the tanks, heat pump, valve, fresh-water module and heating manifold can be moved in two dimensions. Combined and separate heat-pump returns are supported with a supply-side valve. With a return-side valve, an optional common supply has a movable junction. Multiple heating circuits move together with their manifold, which can also be selected directly. When the manifold is placed above the buffer, the circuits point upwards. A common return junction can be moved. A ground or water heat source follows the heat pump and can also be moved separately.

Separate-tank systems without a displayed heating circuit or with separate heating-circuit connections are supported with or without a heat pump. Without a heat pump or another heat source, the heating circuit can also move without the separate-port setting. Stratified, baffle-plate, combi and hygienic tanks can move with a heat pump, solar thermal and additional heat; a hydraulic separator is also supported when a heating circuit is present. Their drinking-water connections move with the tank. Other system variants retain limited movement.

Solar thermal and additional heat can also be arranged on separate tanks, with or without a heat pump. A hydraulic separator requires a displayed heating circuit. A heat pump and heating circuit require separate heating-circuit connections.

A hydraulic separator can be moved in a system with heating circuits together with the tanks, manifold and displayed heat sources. Its four pipes remain distinct.

Pipe routes are calculated automatically with rounded corners and bridges at crossings. The heat pump, diverter valve, tanks, heating manifold and fresh-water module switch their connections to the facing side when needed. If two buffer connections occupy the same point, the heating-circuit port is shifted vertically. Overlapping components and positions without a suitable route are not saved. The search cannot yet find a route for every possible arrangement; try another position if necessary. Without `layout`, the original diagram is retained.


### Positions in YAML

When the card is saved, Home Assistant receives the editor's configuration.
Positions are stored in the optional `layout` section, for example:

```yaml
layout:
  version: 1
  wp:
    x: 200
    y: -100
  quelle:
    x: 200
    y: 100
  ruecklauf_abzweig:
    x: -20
    y: 0
```

`x` and `y` are offsets in diagram coordinates: positive values move right and
down. Missing values mean `0`. `speicher` moves both tanks; `warmwasser` and
`puffer` are additional offsets relative to `speicher`. `quelle`, `ruecklauf_abzweig` and `vorlauf_abzweig` are additional offsets relative
to the heat pump. Other position keys are `wp`, `ventil`, `heizkreis`, `fm`,
`kamin` and `solar`. Routes and connection
sides are calculated from positions and the current system configuration, not
stored as fixed SVG paths.

Without `layout`, the default arrangement is shown. Unknown layout versions
are not applied. Changes to equipment, system topology or routing can alter a
saved arrangement, make part of it unsupported, or leave no clear pipe route;
the stored values are not automatically deleted. Check the arrangement in the
editor after such changes. Future changes to the meaning of `version: 1` require
an explicit migration.

## License

MIT – see [LICENSE](https://github.com/mariofritzer/warmwasser-schema-card/blob/main/LICENSE).

🇩🇪 Questions in German are welcome too – Fragen gerne auch auf Deutsch.
