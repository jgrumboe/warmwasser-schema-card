# Gemeinsame WP/FM-Rohrführung / Shared heat-pump/FWM routing

## Deutsch

### Nächster abgegrenzter Schritt

Dieser PR baut auf [PR #4](https://github.com/mariofritzer/warmwasser-schema-card/pull/4)
bei `2c8a72e5e1971208965d54c77513d3bee191ecf5` auf. #4 und der darunterliegende
[Komponentenmodell-PR #3](https://github.com/mariofritzer/warmwasser-schema-card/pull/3)
sind zu Beginn dieser Arbeit noch offen. Der Vergleich gegen Upstream `main`
enthält daher auch deren Änderungen. Nach dem Merge der Vorgänger wird der
Branch auf den entsprechenden Upstream-Stand umgehängt.

Ziel ist ein gemeinsamer Routing-Durchlauf für die sieben bereits modellierten
äußeren Leitungen einer Anlage mit Wärmepumpe und Frischwassermodul:

| Verbindungs-ID | Dargestellter Abschnitt |
| --- | --- |
| `fm-supply` | Speicher zum FM |
| `fm-return` | FM zum Speicher |
| `wp-upper-supply` | WP zum oberen Speicherbereich |
| `wp-upper-return` | Oberer Speicherbereich zum Umschaltventil |
| `wp-lower-supply` | WP zum unteren Speicherbereich |
| `wp-lower-return` | Unterer Speicherbereich zum Umschaltventil |
| `wp-valve-return` | Umschaltventil zur WP |

### Entscheidungen und Alternativen

Alle sieben Leitungen werden gemeinsam geprüft und kompiliert. Nur die obere
WP-Ladeleitung zusätzlich zum FM zu routen würde die übrigen festen WP-Leitungen
und deren Brücken als Sonderfälle zurücklassen. Ein vollständiger Primärbatch
hat einen klareren Geometrievertrag und erlaubt konsistente Kreuzungsbrücken.

Die Suche muss getrennte Leitungen voneinander freihalten. Eine geometrische
Ausweichregel darf deshalb keine zusätzliche semantische `via`-Referenz oder
hydraulische Verbindung erfinden. Tatsächliche gemeinsame Abzweige behalten
ihre ausdrückliche Modellidentität. WP/FM allein fügt keine äußeren T-Abzweige
hinzu; die bestehenden HK-Abzweige werden erst in einer späteren Stufe angebunden.

Die Installation bleibt eine einzelne JavaScript-Datei ohne Laufzeitabhängigkeiten
und ohne Build. Die Aktivierung bleibt auf interne Geometrieproben beschränkt;
dieser PR führt weder ein öffentliches `layout` noch einen visuellen Editor ein.
Kanonische Karten behalten ihre bisherigen SVG-Pfade und deren Darstellung.

Die Freigabe umfasst zunächst Luft-WP mit FM für `trennblech`, `schicht` und
`getrennt`. Heizkreise, WP-Quellenkreise, Zähler und weitere Zusatzoptionen bleiben
außerhalb dieser Stufe. Die folgenden Grenzen gelten ausschließlich für aktives
internes Routing und schränken normale Kartenkonfigurationen nicht ein.

### Aktivierung, Schutzflächen und Grenzen

Sobald FM, WP, Umschaltventil oder einer der zugehörigen Speicher intern von
`baseOrigin` abweicht, werden alle sieben Leitungen zusammen berechnet. Bei
getrennten Speichern gehören sowohl WW- als auch Pufferspeicher dazu. Eine
Teilanfrage an den Modelladapter wird mit `unsupported` / `incomplete-batch`
abgewiesen; sie könnte Kreuzungen mit einer ausgelassenen Leitung übersehen.

WP-Körper, WP-Stutzen und Umschaltventil erhalten eigene lokale `routingAreas`.
Die vorhandenen Speicher-, FM-, Sensor- und festen Trinkwasser-Schutzflächen
bleiben erhalten. Eigene Port-Escapes sind weiterhin nur auf dem ersten bzw.
letzten geraden Segment erlaubt. Alle sieben Verbindungen durchlaufen gemeinsam
den bestehenden Compiler; dessen endgültiger SVG-Pfad speist sämtliche Rohrlagen
und Strömungsanimationen. Bei aktiver Automatik werden auch die bisherigen festen
WP-Brücken vollständig durch die berechneten Pfade ersetzt.

Brückenzuordnung und SVG-Zeichenreihenfolge verwenden dieselbe Regel: Die
lexikografisch höhere Verbindungs-ID erhält die Brücke und wird als vollständige
Rohrgruppe später gezeichnet. Das gilt für Schatten, Farbe, Glanz und Animation
zusammen. So liegt das Rohr mit der Brücke auch sichtbar im Vordergrund.
Diese Reihenfolge ist eine Darstellungsregel, keine Priorität eines Mediums
oder einer Fließrichtung. Die festen kanonischen Zeichenrezepte bleiben erhalten.

Die bestehende FM-Freigabe und deren Textgrenzen bleiben bestehen. Zusätzlich
gilt für die WP: Typ `luft`, kein `wmz`, `sg_ready`, `quelle_ein` oder
`quelle_aus`; `name_wp` höchstens 5 Zeichen und benutzerdefinierte Texte
`text_wp_an` / `text_wp_aus` höchstens 12 Zeichen. Damit bleiben Zählergeometrie,
unbegrenzte SG-Texte und die außerhalb des Geräts dargestellte Lufttemperatur
außerhalb dieses Schritts. Statusfarben und Animationen dürfen sich mit
Sensorwerten ändern, die berechnete Geometrie bleibt gleich.

Der Renderer prüft bei aktiver Automatik zusätzlich die tatsächlich formatierten
Displaytexte: FM-Temperatur bis 7 Zeichen, FM-Durchfluss einschließlich Einheit
bis 10, WP-Leistung bis 10, COP-Zeile bis 12, gemeinsame VL/RL-Zeile bis 20 und
dynamischer WP-Status bis 14 Zeichen. Die festen übersetzten Standardstatus
bleiben zulässig. Überlange Ausgaben liefern `label-overflow`, ohne Werte zu
kürzen oder neue Wege abhängig vom Messwert zu suchen. Diese Prüfung liegt im
Renderer, da der Geometrieadapter keine Sensorzustände kennt.

Die Suche plant jede Mittellinie weiterhin einzeln; der Compiler prüft sie danach
gemeinsam. Es gibt in diesem PR weder eine Konflikt-Neusuche noch eine Garantie,
jeden geometrisch möglichen Weg zu finden. Nachgewiesene Beispiele im
Entwickler-Harness sind FM-Versätze von `(+30,+15)` für `schicht` / `trennblech`
und `(+60,+15)` für `getrennt`, jeweils bei sonst kanonischen Ursprüngen und
Standardtrennung. `getrennt` mit `(+30,+15)` wird bewusst als `failed` /
`unnamed-contact` zurückgewiesen: zwei unabhängig gefundene Wege berühren oder
überlagern sich ohne gemeinsame Referenz. Es wird weder ein Abzweig erfunden
noch eine Leitung still auf ihren alten Pfad zurückgesetzt.

### Diagramm und reale Anlage

Eine Rohrbrücke kennzeichnet eine geometrische Kreuzung zweier getrennter
Diagrammverbindungen. Sie begründet weder einen hydraulischen Abzweig noch eine
räumliche Montagevorgabe. Die bestehende Zuordnung des FM-Rücklaufs bei getrennten
Speichern aus #2 bleibt erhalten und beschreibt die im Issue besprochene Anlage,
keine allgemeingültige Hydraulikregel. Ventilanschlüsse erhalten keine erfundene
innere Verbindung.

### Spätere Schritte

Echte HK-Abzweige benötigen eine Richtung je inzidenter Verbindung. Anschließend
folgen weitere äußere Kreise und deren Schutzflächen, Zähler mit gesichertem
geradem Einbauabschnitt sowie eigene Regeln für Verteilerrails und Innenpfade.
Eine versionierte Layout-Konfiguration, Speichern/Laden und Editorbedienung
bleiben eigene PRs. Die ViewBox folgt noch der Komponentengeometrie statt der
vollständigen Rohrhülle; bei anderen internen Versätzen ist ein kleiner Beschnitt
am Rand möglich. Auch das ist vor einer öffentlichen Layout-Freigabe zu lösen.
Eine Prüfung in einer echten Home-Assistant-Installation
bleibt zusätzlich zur lokalen Browserprüfung erforderlich.

### Abschlussprüfung

`node --check warmwasser-schema-card.js`, `git diff --check` und
`node --test tests/*.test.cjs` sind erfolgreich: **525 Tests**, darunter alle
459 unveränderten Golden-Szenarien gegen Upstream v3.0.1. Neue Tests prüfen echte
Brücken, dieselben Pfade in allen Rohrlagen, obere/untere WP-Zone, Kühlung,
Standby, Sensorinvarianz, beide getrennten Speicher, WP-/Ventilbewegung und
ausdrückliche Fehler bei Teilbatches, blockierten Ports und Textüberläufen. Für
jede berechnete Kreuzung wird zusätzlich geprüft, dass sämtliche Rohrlagen des
Brückenbesitzers nach der vollständigen gekreuzten Rohrgruppe gezeichnet werden.

Ältere Geometrieproben für Ventil und Pufferspeicher verwenden isolierte
Konfigurationen ohne FM, wenn ihr voller Anlagenaufbau außerhalb der neuen
Routing-Freigabe liegt. Ihre ursprünglichen Endpunktprüfungen und sämtliche
Golden-Werte bleiben erhalten.

Der Browser-Harness unter `tests/helpers/routing-harness.html` zeigt kanonische
und intern verschobene Anlagen mit optionaler Luft-WP. Alle drei freigegebenen
Speicherformen, identische Pfade in Rohrlagen/Animation sowie der sichtbare
`blocked-port`-Fehler wurden lokal geprüft. Der GPT-6-Astra-Review hat keine
offenen blockierenden Befunde im beschriebenen Scope. Ein Vergleich mit dem
Vorgänger bei kanonischer Geometrie ist durch die unveränderten Goldens gesichert;
die Seite im Harness vergleicht kanonische mit verschobener Geometrie derselben
neuen Version, nicht zwei Versionen bei identischer Anordnung.

## English

### Next bounded step

This PR builds on [PR #4](https://github.com/mariofritzer/warmwasser-schema-card/pull/4)
at `2c8a72e5e1971208965d54c77513d3bee191ecf5`. Both #4 and its underlying
[component-model PR #3](https://github.com/mariofritzer/warmwasser-schema-card/pull/3)
remain open at the start of this work. The upstream `main` diff therefore includes
their changes. Rebase onto upstream after the preceding PRs merge.

The target is one shared routing pass for the seven existing external connections
of a heat-pump/FWM installation:

| Connection ID | Diagram section |
| --- | --- |
| `fm-supply` | Tank to FWM |
| `fm-return` | FWM to tank |
| `wp-upper-supply` | Heat pump to upper tank section |
| `wp-upper-return` | Upper tank section to diverter valve |
| `wp-lower-supply` | Heat pump to lower tank section |
| `wp-lower-return` | Lower tank section to diverter valve |
| `wp-valve-return` | Diverter valve to heat pump |

### Decisions and alternatives

All seven connections are checked and compiled together. Routing only the upper
charging pipe alongside the FWM would leave other fixed heat-pump pipes and
bridges as special cases. A complete primary batch provides a clearer geometry
contract and consistent crossing bridges.

The search must keep independent pipes separate. Geometric avoidance rules must
not invent semantic `via` references or hydraulic connections. Real shared
junctions retain their explicit model identity. The heat-pump/FWM combination
adds no external tees; existing heating-circuit junctions follow separately.

Installation remains one JavaScript file without runtime dependencies or a build.
Activation remains restricted to internal geometry probes; this PR adds neither
a public `layout` option nor a visual editor. Canonical cards retain their
existing SVG paths and appearance.

Initial scope covers air-source heat pumps with an FWM and `trennblech`, `schicht`
or `getrennt` tanks. Heating circuits, heat-pump source loops, meters and further
options remain outside this step. The following limits apply only to active
internal routing and do not restrict ordinary card configurations.

### Activation, protection areas and limits

Moving the FWM, heat pump, diverter valve or either associated tank away from its
internal `baseOrigin` triggers routing of all seven connections together. Both
the hot-water and buffer tank count for separate-tank systems. Partial model
adapter requests return `unsupported` / `incomplete-batch`, since they could miss
crossings with an omitted connection.

The heat-pump body, connectors and diverter valve gain explicit local
`routingAreas`. Existing tank, FWM, sensor and fixed domestic-water protection
areas remain in use. Owner escapes remain limited to the first and last straight
segments. All seven connections enter the existing compiler together; its final
SVG path feeds every pipe layer and flow animation. Active routing fully replaces
the existing fixed heat-pump bridges with computed paths.

Bridge ownership and SVG paint order use the same rule: the lexicographically
higher connection ID owns the bridge and its complete pipe group is painted
later. Shadows, colour, highlights and animation follow that order together,
so the bridged pipe appears in front. This is a drawing rule, not a priority
assigned to a fluid or flow direction. Fixed canonical drawing recipes remain
unchanged.

Existing FWM eligibility and text limits remain. Additional heat-pump requirements:
type `luft`, no `wmz`, `sg_ready`, `quelle_ein` or `quelle_aus`; `name_wp` up to
5 characters and custom `text_wp_an` / `text_wp_aus` up to 12 characters. This
keeps meter geometry, unbounded SG text and the external air-temperature label
outside this step. Sensor values may change colours and animation, but not routed
geometry.

During active routing the renderer also checks the actual formatted display
strings: FWM temperature up to 7 characters, FWM flow including its unit up to 10,
heat-pump power up to 10, COP line up to 12, combined flow/return temperatures
up to 20, and dynamic heat-pump status up to 14 characters. Fixed translated
standard statuses remain allowed. Longer output produces `label-overflow`,
without truncating values or making paths depend on sensor values. This check
belongs to the renderer because the geometry adapter has no sensor state.

The search still plans centerlines individually, then validates them together in
the compiler. This PR adds no conflict rerouting and does not guarantee finding
every geometrically possible route. Proven developer-harness examples move the
FWM by `(+30,+15)` for `schicht` / `trennblech` and `(+60,+15)` for `getrennt`,
with other origins canonical and default tank separation. The `getrennt`
`(+30,+15)` example deliberately returns `failed` / `unnamed-contact`: independent
searches produce touching or overlapping paths without a shared reference. No
junction is invented and no pipe silently reverts to its fixed legacy path.

### Diagram versus actual installation

A bridge marks a geometric crossing of separate diagram connections. It implies
neither a hydraulic junction nor a physical mounting requirement. The separate-tank
FWM return from #2 retains the installation-specific topology discussed in the
issue; it is not a universal hydraulic rule. No internal valve plumbing is invented.

### Later work

Real heating-circuit junctions need a direction for each incident connection.
Further external loops and protection areas, meters with guaranteed straight
mounting sections, and dedicated rules for manifold rails and internal paths
follow separately. Versioned layout configuration, persistence and editor
interaction remain separate PRs. Testing in a real Home Assistant installation
is still required in addition to local browser checks. The ViewBox still follows
component geometry rather than the full pipe envelope; other internal offsets may
slightly clip pipes at the edge. This must also be addressed before public layout
support.

### Final verification

`node --check warmwasser-schema-card.js`, `git diff --check` and
`node --test tests/*.test.cjs` pass: **525 tests**, including all 459 unchanged
upstream v3.0.1 golden scenarios. New tests cover real bridges, identical paths
across pipe layers, upper/lower heat-pump zones, cooling, standby, sensor
invariance, both separate tanks, heat-pump/valve movement, and explicit failures
for partial batches, blocked ports and label overflow. Every computed crossing
also verifies that all layers of the bridge owner are painted after the complete
crossed pipe group.

Earlier valve and buffer-tank geometry probes use isolated configurations without
an FWM when their full system is outside routing eligibility. Their original
endpoint assertions and all golden values remain intact.

The browser harness at `tests/helpers/routing-harness.html` shows canonical and
internally moved configurations with an optional air-source heat pump. Local
browser checks covered all three eligible tank types, identical paths across
pipe layers/animation, and a visible `blocked-port` error. GPT-6-Astra found no
outstanding blocking issues within this scope. Unchanged goldens compare the
preceding version at canonical geometry; the harness page compares canonical
and moved geometry in the same new version, rather than two versions at the
same positions.
