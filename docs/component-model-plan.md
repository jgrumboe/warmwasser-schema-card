# Gemeinsames Diagrammmodell / Shared diagram model

## Deutsch

### Ziel und Branch-Basis

Der abgestimmte PR umfasst die vollständige Modellmigration des bestehenden
Anlagenschemas. Automatisches Routing, freie Anordnung und der visuelle
Layout-Editor folgen in eigenen PRs. Die Modellmigration wird innerhalb eines
PR in den unten beschriebenen Schritten geprüft.

[PR #2](https://github.com/mariofritzer/warmwasser-schema-card/pull/2) wurde am
29. Oktober 2026 als `ff7f5ad` gemerged. Der Arbeitsbranch
`codex/component-connection-model` basiert auf Upstream `main`, Commit
`5637cc24a1832652a91a18c24b76e3f71610cb46` (Version 3.0.1). Damit sind auch
die letzten Korrekturen an Rücklauf, Ladeanschluss und Heizstab aus #2 enthalten.
Der Modell-PR enthält ausschließlich die darauf aufbauende Modellmigration.

### Prüfschritte innerhalb eines PR

1. Die vollständige bisherige HTML-/SVG-Ausgabe des Fix-Stands in
   deterministischen Referenzszenarien sichern.
2. Komponenten, lokale Geometrie, Anschlüsse und echte Abzweige des Primärkreises
   modellieren und den vorhandenen Renderer daran anbinden.
3. Verteiler und einzelne Heizkreise einschließlich Mischern und Pumpen ergänzen.
4. Solar, Zusatzwärme, Trinkwasser, Zirkulation und WP-Quellenkreis migrieren.
5. Speicherinnere, Fühler, Heizstäbe und sämtliche komponenteninternen Symbole,
   Beschriftungen und SVG-Ressourcen an ihren geometrischen Besitzer binden.
6. Graph, vollständige Renderbindung und unveränderte Ausgabe prüfen; die
   Dokumentation auf Deutsch und Englisch abschließen.

Jeder Schritt behält dieselben Referenztests. Das gemeinsame fachliche Ziel ist
vollständige interne Modellierung bei unveränderter Darstellung und Konfiguration.

### Entscheidungen und Alternativen

- **Migration im vorhandenen SVG-Renderer.** Ein kompletter Rendererwechsel würde
  den Review und den optischen Vergleich erschweren. Ein zusätzliches, ungenutztes
  Modell neben weiterhin unabhängig verdrahteten SVG-Pfaden wäre unzureichend.
- **Explizite Verbindungen und Abzweige.** Gleiche Koordinaten erzeugen keine
  Verbindung. Durchgehende Zeichenpfade dürfen mehrere semantische Abschnitte
  darstellen; echte Zwischenabzweige müssen ausdrücklich referenziert sein.
- **Symbolgeometrie und Graph getrennt betrachten.** Ein Lüfter, eine Flamme oder
  ein elektrischer Heizstab ist keine Flüssigkeitsleitung. Mehrlagige Rohrdarstellung
  und Strömungsoverlays sind Darstellungen derselben Verbindung, keine neuen Kanten.
- **Kanonische Symbolrezepte.** Definierte Referenzpositionen erhalten das
  Standard-Markup. Lokale Geometrie und gegebenenfalls Translationen binden auch
  innere Symbole und Texte an ihre Komponente. Es gibt keinen allgemeinen
  SVG-String-Rewriter und keine zweite Layout-Engine.
- **Feste Rohrwege vor freiem Routing.** Der
  [Prototyp](https://github.com/jgrumboe/warmwasser-schema-card/tree/codex/fresh-water-return-separate-tanks)
  (`160fce3`) dient als Referenz für benannte Anschlüsse und Routing. Er enthält
  gleichzeitig neue Anlagenoptionen, Positionsregeln und einen Editor und wird
  deshalb nicht als Patch übernommen. Sein Junction-Alias-Muster wird ebenfalls
  nicht übernommen: Abzweige benötigen eine eindeutige tatsächliche Identität.
- **Keine neue Nutzerkonfiguration.** Keine öffentliche `layout`-Struktur,
  Positionsvalidierung oder Editor-Anpassung. Bestehende Konfigurationsfelder
  behalten ihre Bedeutung. Installation weiterhin mit einer JS-Datei ohne Build
  und ohne Laufzeitabhängigkeiten.

### Umfang und Modellvertrag

| Bereich | Zu modellierender Umfang |
| --- | --- |
| Speicher | Alle fünf Formen, getrennte WW-/Pufferkomponenten, Anschlüsse, Stutzen, Innenbehälter und Wärmetauscher |
| FM und WP | Gerätegeometrie, alle dargestellten Anschlüsse, Anzeigen und innere Symbole; Umschaltventil |
| Heizkreise | Verteilerrails, Anschlussabzweige, einzelne Kreise, Mischer, Rückführung, Pumpen und Weiche |
| Solar und Zusatzwärme | Kollektor, Wendel, Pumpen, alle sieben Zusatzwärmetypen und vollständige dargestellte Leitungen |
| Trinkwasser | Externe Ein-/Austritte, integrierter Trinkwasserkreis, Zirkulation, Pumpe und echte Abzweige |
| WP-Quelle | Dargestellter Sole-/Brunnenkreis mit Anschlüssen; keine erfundene Hydraulik für Luftsymbole |
| Anbauteile | Eindeutiger geometrischer Besitzer für Fühler, Heizstäbe, Zähler, Füße, Beschriftungen und Dekoration |

`setConfig` erzeugt das interne `_model` aus der normalisierten Konfiguration;
Sensorupdates verwenden dasselbe Modell. Komponenten besitzen einen Ursprung,
lokale Bounds und benannte Ports. Anschlussanker und Stutzengeometrie gehören
zusammen; ihre Außenkanten müssen nicht übereinstimmen, weil auch die bestehende
Darstellung Rohranker innerhalb eines Stutzens verwendet.

Der interne Vertrag lautet:

- `components[id]`: `origin`, kanonischer `baseOrigin`, lokale `bounds` und
  `ports`; bei angehängten Elementen zusätzlich `parent` und `localOrigin`.
- `junctions[id]`: aufgelöste `x`/`y`, `medium` und `kind` (`tee`, `endpoint`
  oder `meter`), gegebenenfalls mit einem lokalen Bezug zur Elternkomponente.
- `connections[id]`: `from`, `to` und geordnete `via`-Referenzen.

`diagramPort` und `diagramStub` lösen Anschlussanker und Stutzen in
SVG-Koordinaten auf. Elternbewegungen nehmen die angehängten Teile mit.
`bounds` bezeichnet die feste Körper-/Referenzbox eines kanonischen Symbols,
nicht dessen vollständige sichtbare Fläche oder eine Kollisions-/Trefferfläche.
Beschriftungen und andere Details können darüber hinausreichen. Dieser PR
enthält keine Größenänderungs-API und keine Kollisionsprüfung. `_model` ist eine
interne Struktur und keine öffentliche Konfigurations- oder Erweiterungs-API.

`connections` referenzieren Anschlüsse über `from` und `to`. `via` kennzeichnet
einen echten verbundenen Zwischenpunkt innerhalb eines durchgehenden Pfads.
Ein solcher Punkt zählt zwei inzidente Abschnitte entlang des Pfads; ein
Pfadendpunkt nur einen. Anschlüsse am Ende einer Verteilerrail unterscheiden sich
somit von einem T-Abzweig innerhalb der Rail. Tatsächliche externe Ein-/Austritte
bleiben ausdrückliche Grenzen. Die frühere interne Grenze `legacy-manifolds`
entfällt.

Messstellen sind transparente Punkte mit Grad zwei; sie sind keine Abzweige.
Pumpendurchgänge bilden tatsächlich durchlaufende gezeichnete Rohrpfade ab.
Ventil- und Mischersymbole besitzen benannte Anschlüsse, ohne daraus eine
unbelegte innere Verrohrung abzuleiten. Rohrlagen und Animationen verwenden
dieselben Referenzen; Verteileranimationen folgen derselben Rail-Polyline auch
in umgekehrter Richtung.

Geometrische Austrittsrichtung, Medium und Rolle sind voneinander getrennt.
Heizwasser bleibt im Kühlbetrieb Heizwasser; Farbe beschreibt den Zustand.
Trinkwasser, Solarkreis, WP-Quellenkreis und Fernwärme-Primärkreis bleiben eigene
Medien. Eine Trennung
im Modell legt keine chemische Zusammensetzung der realen Flüssigkeit fest.
Komponentenports werden nicht pauschal innerhalb eines Geräts miteinander
verbunden. Nicht dargestellte WP-/FM-Innenverrohrung bleibt unbekannt.

### Belegte Diagrammregeln und Hydraulik

Referenz ist, was die bestehende Karte zeichnet. Bei gemeinsamen Speichern liegt
der FM-Rücklauf unten am Speicher. Für getrennte Speicher bildet #2 die im
[Issue #1](https://github.com/mariofritzer/warmwasser-schema-card/issues/1)
beschriebene individuelle Anlage ab: beide FM-Heizwasseranschlüsse am
Warmwasserspeicher. Das ist keine universelle hydraulische Vorschrift.
Auch die gezeichneten WP-/HK-Abzweige werden aus dem Bestand übernommen, nicht
hydraulisch berechnet. Wärmetauscher übertragen Wärme zwischen getrennten
Kreisen und verbinden deren Flüssigkeiten nicht. Das Modell beschreibt ein
Diagramm und prüft weder reale Verrohrung noch Anlagensicherheit.

Kopfzeile, Energiebalken und Temperaturlegende sind kartenweite Annotationen.
Das Legionellenlabel gehört zum Speicher; Zähler haben einen geometrischen
Besitzer und liegen ausdrücklich auf ihrer dargestellten Leitung.

### Prüfung und spätere Arbeiten

```sh
node --check warmwasser-schema-card.js
node --test tests/*.test.cjs
```

Node.js 22 oder neuer genügt; keine Pakete zu installieren. Referenztests
vergleichen vollständige HTML-/SVG-Ausgaben mit festen SHA256-Fixtures aus dem
unveränderten Fix-Stand. Der Generator akzeptiert nur den exakten Quelltext dieser
Basisrevision; normale Testläufe benötigen weder Git noch Netzwerk. Modelltests
prüfen zusätzlich Anschlussauflösung, Medien, Inzidenz, Rekonfiguration und die
Bindung tatsächlicher Symbole und Rohrenden an veränderte Modellgeometrie.

Visueller Vergleich: `node tests/helpers/visual-compare.cjs`, dann
`http://127.0.0.1:8765/` öffnen. Die Basisrevision muss lokal in Git vorhanden sein.
Beide Versionen laufen in getrennten Frames; Geometrieproben gelten nur für die
aktuelle Version. HA-Icons sind gestubbt. Ein echter Home-Assistant-Test bleibt
zusätzlich erforderlich.

Nach diesem PR folgen Routing mit expliziter Fehlerbehandlung und danach eine
versionierte Layout-Konfiguration mit Editor. Kollisionsbehandlung, Anschlussseiten,
freie Anordnung, Touch/Tastatur und Speichern/Neuladen sind gesondert zu prüfen.
Feste Zeichenrezepte und interne Geometrieproben versprechen noch kein freies Layout.

### Abschlussnachweis

Am 29. Oktober 2026 bestanden Syntaxprüfung, `git diff --check` und alle
**500 Tests**. Darunter sind **459 vollständige Referenzszenarien** aus dem
unveränderten Upstream-Stand v3.0.1. Die Modelltests prüfen zusätzlich Mediengrenzen,
Elternbezüge, Pumpendurchgänge, Messpunkte, Verteilerinzidenz, Rekonfiguration und
die tatsächliche Renderbindung von Anschluss-, Abzweig- und Symboländerungen.

Der abschließende GPT-6-Astra-Code-Review hat keine offenen konkreten Findings.
Nach den letzten Korrekturen hatten neun Browserfälle identischen Shadow-DOM-Inhalt
zur Basis: getrennte Speicher als Vollanlage, Schicht minimal, Kombi, Hygiene,
Luft-WP, Wasserquelle, Fernwärme, Schicht-Vollanlage mit Heizstäben und Fühlern
sowie kleine getrennte Speicher (35 %) mit FM, WP und oberem Heizstab.
Zusätzliche Sichtprüfungen der Geometrieproben deckten Zusatzwärme einschließlich
Flammenausschnitt, WP-Lüfter und Anzeigen sowie Speicher mit Verlauf, Fühlern,
Füßen und Wendel ab; Deutsch/dunkel und Englisch/hell wurden geprüft.
Die Browserprüfung verwendet gestubbte HA-Icons. Der Test in einer echten
Home-Assistant-Installation steht noch aus.

## English

### Goal and branch base

The agreed PR covers the complete model migration of the existing diagram.
Automatic routing, free placement and the visual layout editor follow in separate
PRs. The model migration is reviewed in the steps below within one PR.

On 29 October 2026, [PR #2](https://github.com/mariofritzer/warmwasser-schema-card/pull/2)
was merged as `ff7f5ad`. `codex/component-connection-model` starts from upstream
`main` at `5637cc24a1832652a91a18c24b76e3f71610cb46` (version 3.0.1), including
the final return, charging-port and heater corrections from #2. The model PR
contains only the subsequent model migration.

### Reviewable steps within one PR

1. Capture complete existing HTML/SVG output from the fix baseline in deterministic
   reference scenarios.
2. Model primary components, local geometry, ports and real junctions and bind
   the existing renderer to them.
3. Add manifolds and individual heating circuits, including mixers and pumps.
4. Migrate solar, additional heat, domestic water, circulation and heat-pump source.
5. Bind tank internals, sensors, immersion heaters and all internal symbols,
   labels and SVG resources to their geometric owners.
6. Verify the graph, full render binding and unchanged output; complete DE/EN docs.

Each step retains the same reference tests. The shared goal is complete internal
modeling with unchanged rendering and configuration.

### Decisions and alternatives

- **Keep the existing SVG renderer.** Replacing it would complicate review and
  visual comparison. An unused model alongside independently wired SVG paths
  would also be insufficient.
- **Explicit connections and junctions.** Matching coordinates do not connect
  anything. A continuous drawing path may represent multiple semantic sections,
  but real intermediate branches must be explicit.
- **Separate symbol geometry from the graph.** A fan, flame or electric heater is
  not a fluid pipe. Pipe layers and flow overlays represent the same connection,
  not extra graph edges.
- **Canonical symbol recipes.** Defined reference positions preserve standard
  markup. Local geometry and translations bind internal symbols and text to their
  component. There is no generic SVG string rewriter or second layout engine.
- **Fixed routes before automatic routing.** The
  [prototype](https://github.com/jgrumboe/warmwasser-schema-card/tree/codex/fresh-water-return-separate-tanks)
  (`160fce3`) serves as a reference for ports and routing. It also adds system
  options, placement rules and an editor, so its patch is not copied. Its junction
  alias pattern is not copied either: real junctions need one explicit identity.
- **No new user configuration.** No public `layout` structure, position validation
  or editor changes. Existing fields keep their meaning. Installation remains one
  JavaScript file without runtime dependencies or a build step.

### Scope and model contract

| Area | Scope to model |
| --- | --- |
| Tanks | All five types, separate hot-water/buffer components, ports, connectors, inner vessel and exchangers |
| FWM and heat pump | Device geometry, all displayed ports, displays and internal symbols; diverter valve |
| Heating circuits | Manifold rails, branch junctions, individual circuits, mixers, bypasses, pumps and separator |
| Solar and additional heat | Collector, coil, pumps, all seven additional-source types and complete displayed pipes |
| Domestic water | External inlets/outlets, integrated domestic circuit, circulation, pump and real junctions |
| Heat-pump source | Displayed ground/well circuit and its ports; no invented hydraulic circuit for air symbols |
| Attached elements | A geometric owner for sensors, heaters, meters, feet, labels and decoration |

`setConfig` creates internal `_model` from normalized configuration; sensor
updates reuse it. Components own an origin, local bounds and named ports. Pipe
anchors and connector geometry belong together; their outer edges may differ
because existing pipes can terminate inside a connector.

The internal contract is:

- `components[id]`: `origin`, canonical `baseOrigin`, local `bounds` and `ports`;
  attached elements also have `parent` and `localOrigin`.
- `junctions[id]`: resolved `x`/`y`, `medium` and `kind` (`tee`, `endpoint` or
  `meter`), optionally with coordinates relative to a parent component.
- `connections[id]`: `from`, `to` and ordered `via` references.

`diagramPort` and `diagramStub` resolve pipe anchors and connectors to SVG
coordinates. Attached elements follow their parents. `bounds` denotes a fixed
body/reference box for a canonical symbol, not its entire visible extent or a
collision/hit area. Labels and details may extend beyond it. This PR contains no
resizing API or collision check. `_model` is internal, not a public configuration
or extension API.

`connections` use `from` and `to` references. `via` identifies a truly connected
intermediate point in a continuous drawing path. Such a point contributes two
incident sections along the path; an endpoint contributes one. Rail-end
connections therefore differ from T-junctions inside a rail. Real external
inlets/outlets remain explicit boundaries. The former internal
`legacy-manifolds` boundary is removed.

Meters are transparent degree-two points rather than branches. Pump passages
represent actually drawn continuous pipes. Valve and mixer symbols have named
ports without inferring undocumented internal plumbing. Pipe layers and
animations use the same references; manifold animations follow the same rail
polyline in either direction.

Geometric outward direction, medium and role are separate. Heating water remains
heating water during cooling; colour represents state. Domestic water, solar and
heat-pump source and district-heating primary remain distinct media. A medium
identifier does not determine
actual fluid chemistry. Ports are not automatically connected inside a device;
undrawn heat-pump/FWM internal plumbing remains unknown.

### Drawing evidence and hydraulics

The reference is what the existing card draws. Shared tanks use the bottom FWM
return. For separate tanks, #2 represents the individual installation described
in [issue #1](https://github.com/mariofritzer/warmwasser-schema-card/issues/1):
both FWM heating-water ports connect to the hot-water tank. This is not a universal
hydraulic rule. Existing heat-pump/heating-circuit junctions are preserved drawing
conventions rather than results of hydraulic calculations. Exchangers transfer
heat without connecting their fluids. The model describes a diagram; it does not
validate real plumbing or installation safety.

The header, energy bars and temperature legend are card-level annotations. The
legionella label belongs to the tank; meters have a geometric owner and are
explicitly attached to their displayed pipe.

### Verification and later work

```sh
node --check warmwasser-schema-card.js
node --test tests/*.test.cjs
```

Node.js 22 or newer is sufficient; no packages to install. Characterization tests
compare complete HTML/SVG output against fixed SHA256 fixtures from the unchanged
fix baseline. The generator accepts only that exact source; normal test runs need
neither Git nor network access. Model tests additionally check port resolution,
media, incidence, reconfiguration and binding of actual symbols and pipe endpoints
to altered model geometry.

For visual comparison, run `node tests/helpers/visual-compare.cjs` and open
`http://127.0.0.1:8765/`. The baseline revision must exist in local Git. The versions
run in separate frames; geometry probes affect only the current version. HA icons
are stubbed. Testing inside a real Home Assistant installation is still required.

Follow-up PRs add routing with explicit failure handling, then versioned layouts
and an editor. Collision handling, connection sides, free placement, touch/keyboard
and saving/reloading need separate checks. Fixed drawing recipes and internal
geometry probes do not yet promise free layout support.

### Final verification

On 29 October 2026, syntax validation, `git diff --check` and all **500 tests**
passed, including **459 complete reference scenarios** from the unchanged upstream v3.0.1
baseline. Additional model tests cover media boundaries, parent relationships,
pump passages, meter points, manifold incidence, reconfiguration and actual
render binding to port, junction and symbol changes.

The final GPT-6-Astra code review has no outstanding concrete findings. After the
last fixes, nine browser cases had identical shadow DOM content to the baseline:
full separate tanks, minimal stratified, combi, hygienic, air heat pump, water
source, district heat, a full stratified system with heaters and sensors, and
small separate tanks (35%) with an FWM, heat pump and upper heater.
Additional visual geometry probes covered the additional source with its flame
clip, heat-pump fan/displays, and tanks with gradients, sensors, feet and coils.
German/dark and English/light were checked. Browser tests use stubbed HA icons;
testing in a real Home Assistant installation remains outstanding.
