# Warmwasser Schema Card

[🇬🇧 English](README.md) · 🇩🇪 Deutsch

Animiertes Anlagenschema für Home Assistant: Speicher, Frischwassermodul mit Zirkulation, Wärmepumpe, Heizstäbe, Solarthermie, Zusatzwärme (Kaminofen, Holzvergaser, Pellets, Gas, Öl, Fernwärme, BHKW), hydraulische Weiche und bis zu sechs gemischte Heizkreise.

![Screenshot](images/screenshot.png)

- **Alles optional:** Jedes Gerät und jeder Einzelwert erscheint nur, wenn dafür eine Entität angegeben ist
- **Grafischer Editor:** Alles im Dashboard-Editor einstellbar, kein YAML nötig
- **Deutsch und Englisch:** Richtet sich nach der Sprache von Home Assistant, oder fest mit `sprache: de` / `sprache: en`
- **Im Browser gezeichnet:** Kein Template-Rendering auf dem Server, sofort sichtbar nach dem Laden
- Speichertemperatur als Farbverlauf aus beliebig vielen Fühlern
- Strömungsanimation in allen Rohren, abhängig von Pumpen, Mischerstellung, Umschaltventil und Zapfung
- Mischer-Simulation: Anteil Puffer- und Rücklaufwasser über Farbe und Fließgeschwindigkeit
- Klickbar: Pumpenmodus der Zusatzwärme, Zirkulationspumpe ein/aus, Detaildialog für alle Werte
- Funktioniert mit hellem und dunklem Theme

## Installation

### Über HACS

1. HACS → ⋮ → **Benutzerdefinierte Repositories**
2. URL dieses Repositories eintragen, Typ **Dashboard**
3. „Warmwasser Schema Card“ installieren und den Browser neu laden

### Manuell

1. `warmwasser-schema-card.js` nach `/config/www/` kopieren
2. Einstellungen → Dashboards → ⋮ → **Ressourcen** → Ressource hinzufügen
   - URL: `/local/warmwasser-schema-card.js`
   - Typ: **JavaScript-Modul**
3. Browser neu laden (Strg+F5)

## Konfiguration

Karte über **Karte hinzufügen → Warmwasser Schema Card** einfügen und im grafischen Editor einrichten, oder per YAML.

Minimal:

```yaml
type: custom:warmwasser-schema-card
fuehler:
  - { name: Oben, entity: sensor.speicher_oben }
  - { name: Unten, entity: sensor.speicher_unten }
```

Ein vollständiges, kommentiertes Beispiel liegt in [`examples/beispiel.yaml`](examples/beispiel.yaml).

### Allgemein

| Option | Standard | Beschreibung |
|---|---|---|
| `titel` | je nach Sprache | Überschrift |
| `sprache` | `auto` | `auto`, `de`, `en` |
| `hersteller` | `HOVAL` | Schriftzug auf FM und WP |
| `name_wp`, `name_fm` | `WP`, `FM` | Beschriftung der Geräte |
| `fuehler` | – | Speicherfühler von oben nach unten: `{ name, entity, hoehe }` (Höhe 0–100 %) oder `[Name, Entität, Höhe]` |
| `t_min`, `t_max` | `40`, `55` | Farbskala Speicher (°C) |
| `hs_stufen` | `7` | Leistungsstufen der Heizstäbe |
| `aussen` | – | Außentemperatur (Kopfzeile) |
| `pv` | – | PV-Leistung in W (Kopfzeile) |
| `zirkulationspumpe` | – | Zirkulationspumpe, Klick schaltet um |
| `farben` | – | `aktiv`, `warm`, `kalt`, `led`, `solar`, `quelle`, `tw_kalt`, `tw_warm`, `geraet_hell`, `geraet_dunkel` |

### `speicher`

| Option | Standard | Beschreibung |
|---|---|---|
| `typ` | `trennblech` | `trennblech` (2 Kammern mit Blech, hydraulisch offen), `schicht` (1 Kammer), `kombi` (Tank-in-Tank), `hygiene` (Wellrohr), `getrennt` (Warmwasser- und Pufferspeicher) |
| `volumen` | – | Volumen in Litern (bei `getrennt`: Puffer) |
| `volumen_ww` | – | Nur bei `getrennt`: Volumen Warmwasserspeicher |
| `trennung` | `50` | Höhe von Blech, Trennung bzw. innerem Boiler in % (35–70) |
| `heizkreis_separat` | `false` | Bei `typ: getrennt` Heizkreis-Vor- und Rücklauf separat am Puffer darstellen. Bei Solarthermie, Zusatzwärme oder hydraulischer Weiche mit Wärmepumpe ist dies mit gespeichertem Layout oder gemeinsamem Vorlauf verfügbar. |

### `wp` – Wärmepumpe

| Option | Beschreibung |
|---|---|
| `typ` | `luft`, `sole` (Erdsonde), `wasser` (Brunnen) |
| `leistung`, `schwelle` | Elektrische Leistung (W), ab Schwelle läuft sie (Standard 100) |
| `betrieb` | Alternativ: Entität, die bei Betrieb `on` ist |
| `vorlauf`, `ruecklauf` | Temperaturen |
| `waerme`, `wmz`, `cop` | Wärmeleistung, Wärmemengenzähler (kWh), COP |
| `ventil` | Umschaltventil: `on`/`off`, 0–100 oder Text mit z. B. „Warmwasser“ bzw. „Heizung“. Ohne Angabe werden beide Zonen als geladen gezeigt. |
| `ventil_position` | `ruecklauf` (Standard, bisherige Darstellung) oder `vorlauf`: Einbauort des Umschaltventils in der Schemazeichnung. |
| `ruecklauf_anbindung` | Nur bei `ventil_position: vorlauf`: `gemeinsam` (Standard) oder `getrennt` für die Rückläufe der Speicher zur Wärmepumpe. |
| `vorlauf_anbindung` | Bei Ventil im Rücklauf: `getrennt` (Standard) oder `gemeinsam` für einen gemeinsamen Wärmepumpenvorlauf mit Abzweig. `gemeinsam` benötigt eine unterstützte Anlagenkombination; bei getrennten Speichern mit Heizkreis sind separate Heizkreisanschlüsse erforderlich. |
| `kuehlen` | Kühlbetrieb – die Farben der Heizkreise werden getauscht |
| `sperre`, `abtauen`, `sg_ready` | EVU-Sperre, Abtauen, SG-Ready |
| `quelle_ein`, `quelle_aus`, `quelle_pumpe` | Quellentemperaturen und Quellenpumpe |

`wp_leistung` / `wp_schwelle` auf oberster Ebene funktionieren weiterhin.

### `heizstab_oben`, `heizstab_unten`

`name`, `stufe`, `temp`, `leistung`.

### `kamin` (oder `zusatzwaerme`)

| Option | Standard | Beschreibung |
|---|---|---|
| `typ` | `kamin` | `kamin`, `holzvergaser`, `pellet`, `gas`, `oel`, `fernwaerme`, `bhkw` |
| `temp`, `trend` | – | Kesseltemperatur, Trend (`steigend`/`fallend`) |
| `brenner` | – | Brenner/Betrieb (`on`) statt Temperatur-Schwellen |
| `pumpe`, `modus` | – | Pumpe zum Puffer, Pumpenmodus als `input_select` (Klick schaltet weiter) |
| `warm`, `feuer` | `30`, `35` | Ab hier Glut bzw. Flammen (°C) |
| `abgas`, `zuluft` | – | Abgastemperatur, Zuluftklappe |
| `leistung`, `leistung_el`, `wmz` | – | Wärmeleistung, elektrische Leistung (BHKW), Wärmemengenzähler |

### Weitere Geräte

| Block | Optionen |
|---|---|
| `solar` | `kollektor`, `pumpe`, `leistung`, `wmz`, `name` |
| `fm` | `temp`, `durchfluss` (l/min – Leitungen fließen beim Zapfen), `pumpe`; `fm: true` zeigt es ohne Sensoren |
| `trinkwasser` | `temp` (Kaltwasser), `zaehler` (Wasserzähler), `enthaertung` |
| `weiche` | `temp`; `weiche: true` zeigt sie ohne Sensor |
| `legionellen` | `letzte` (Zeitstempel, Datum oder Tage), `aktiv`, `tage` (Warnung ab, Standard 7) |
| `energie` | Liste aus `{ name, entity, icon, farbe }` – Balken unter dem Schema |

### `heizkreise` (1–6)

| Option | Beschreibung |
|---|---|
| `name` | Beschriftung |
| `pumpe` | `on` oder Wert > 0 = läuft |
| `mischer` | −100 = nur Rücklauf, 0 = halb/halb, 100 = nur Puffer |
| `vorlauf`, `vorlauf_soll`, `raum`, `wmz` | Vorlauf, Vorlauf-Soll, Raumtemperatur, Wärmemengenzähler |
| `typ` | `fussboden` oder `heizkoerper` |

### Anlagenbild anordnen

Im Karteneditor kann unter **Anlagenbild anordnen** eine Komponente ausgewählt und mit den Pfeilen oder durch Ziehen bewegt werden. Der Editor speichert die Position im optionalen `layout`-Abschnitt der Kartenkonfiguration. Rückgängig und Wiederholen gelten während der aktuellen Editor-Sitzung; **Zurücksetzen** entfernt die einstellbaren Positionen.

Bei getrenntem Warmwasser- und Pufferspeicher und separatem Heizkreisanschluss können die Speicher, Wärmepumpe, Ventil, Frischwassermodul und der Heizkreisverteiler zweidimensional verschoben werden, bei einem Wärmepumpenventil im Vorlauf oder Rücklauf. Gemeinsame und getrennte Wärmepumpenrückläufe bei Ventil im Vorlauf werden unterstützt. Bei Ventil im Rücklauf lässt sich optional ein gemeinsamer Vorlauf mit verschiebbarem Abzweig darstellen. Mehrere Heizkreise bewegen sich mit ihrem Verteiler gemeinsam; der Verteiler selbst lässt sich ebenfalls anklicken. Wird er oberhalb des Puffers angeordnet, zeigen die Heizkreise nach oben. Bei gemeinsamem Rücklauf kann der Abzweig verschoben werden. Eine Sole- oder Wasserquelle folgt der Wärmepumpe und kann zusätzlich separat verschoben werden.

Auch Anlagen mit getrennten Speichern ohne dargestellten Heizkreis oder mit separaten Heizkreisanschlüssen werden mit und ohne Wärmepumpe unterstützt. Ohne Wärmepumpe und weitere Wärmequelle kann der Heizkreis auch ohne separate Anschlüsse bewegt werden. Schicht-, Trennblech-, Kombi- und Hygienespeicher lassen sich mit Wärmepumpe, Solarthermie und Zusatzwärme bewegen; bei vorhandenem Heizkreis auch mit hydraulischer Weiche. Die Trinkwasseranschlüsse bleiben dabei am Speicher. Andere Anlagenvarianten bieten weiterhin nur begrenzte Bewegungsmöglichkeiten.

Solarthermie und Zusatzwärme lassen sich bei getrennten Speichern gemeinsam anordnen, mit oder ohne Wärmepumpe. Eine hydraulische Weiche benötigt einen dargestellten Heizkreis. Bei Wärmepumpe und Heizkreis müssen separate Heizkreisanschlüsse eingestellt sein.

Die Rohrwege werden automatisch mit gerundeten Ecken und Sprüngen an Kreuzungen berechnet. Die Anschlüsse von Wärmepumpe, Umschaltventil, Speichern, Heizkreisverteiler und Frischwassermodul wechseln bei Bedarf auf die zugewandte Seite. Belegen zwei Anschlüsse dieselbe Stelle am Puffer, wird der Heizkreisanschluss etwas in der Höhe versetzt. Überlappende Bauteile und Positionen, für die kein geeigneter Weg gefunden wird, werden nicht gespeichert. Die Suche findet noch nicht für jede mögliche Anordnung einen Weg; in diesem Fall hilft eine andere Position. Ohne `layout` bleibt das bisherige Schema erhalten.

Eine hydraulische Weiche lässt sich bei vorhandenem Heizkreis gemeinsam mit Speichern, Heizkreisverteiler und vorhandenen Wärmequellen verschieben. Ihre vier Leitungen bleiben getrennt.


### Positionen in YAML

Beim Speichern der Karte übernimmt Home Assistant die vom Editor gemeldete
Konfiguration. Die Positionen stehen im optionalen Abschnitt `layout`, zum
Beispiel:

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

`x` und `y` sind Verschiebungen in der Zeichenfläche: positive Werte gehen nach
rechts beziehungsweise unten. Weggelassene Werte entsprechen `0`. `speicher`
verschiebt beide Speicher; `warmwasser` und `puffer` gelten zusätzlich zu
`speicher`. `quelle`, `ruecklauf_abzweig` und `vorlauf_abzweig` gelten zusätzlich zur Position der
Wärmepumpe. Weitere Positionsschlüssel sind `wp`, `ventil`, `heizkreis`,
`fm`, `kamin` und `solar`. Die Rohrwege und Anschlussseiten werden aus Positionen und aktueller
Anlagenkonfiguration berechnet und nicht als starre SVG-Pfade gespeichert.

Ohne `layout` wird die Standardanordnung angezeigt. Unbekannte Layoutversionen
werden nicht angewendet. Bei Änderungen an Geräten, Anlagenvariante oder
Rohrführung kann eine gespeicherte Anordnung anders aussehen, teilweise nicht
unterstützt werden oder keinen freien Rohrweg mehr haben; die gespeicherten
Werte werden dabei nicht automatisch gelöscht. Nach solchen Änderungen die
Anordnung im Editor prüfen. Bei zukünftigen Änderungen der Bedeutung von
`version: 1` ist eine eigene Migration nötig.

## Lizenz

MIT – siehe [LICENSE](LICENSE).
