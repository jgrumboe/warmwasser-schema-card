# Visual editor: implementation decisions

## Model and compatibility

**Decision:** Represent connections between the heat pump, separate tanks,
diverter valve, fresh-water module and separate heating circuit as named ports
and pipes. A common return has an explicit junction. Each pipe retains its own
colour and activity. A crossing is not a junction.

**Alternative:** Infer connections from touching SVG paths. Explicit connections
make the hydraulic topology independent of where the paths happen to cross.
Existing configurations without a layout keep their original drawing. This
avoids changing established diagrams for installations not yet covered by the
new router.

## Placement

**Decision:** Save optional offsets in SVG coordinates under `layout` version 1.
The editor uses the same renderer as the card, supports dragging and arrow
buttons on a five-unit grid, and offers undo, redo and reset. Unknown
configuration and unknown layout fields are preserved. For a system with
separate tanks and heating-circuit connections and either valve placement, the
supported components can move in both dimensions without fixed coordinate
limits. Both separate and common heat-pump returns are supported. Multiple
heating circuits move together with their common manifold. Ground and water
sources follow the heat pump and can also be moved separately. Separate tanks
without a displayed heat pump are supported where their heating circuits are
absent or have separate connections. When there is no heat pump or additional
source, a heating circuit is also supported without the separate-port setting:
there is no other circuit with which its buffer ports must be shared. Other
system configurations retain their existing limited movement.

**Alternatives:** Fixed presets would be simpler but would not allow individual
arrangement. Enabling unrestricted movement for every configuration would imply
support for additional heat generators, separators and other topologies that
are not yet modeled. Multiple circuits share a manifold and move as a group;
individually moving circuits requires modeling the manifold connections.

## Routing and collision handling

**Decision:** Use an orthogonal visibility graph over ports, padded equipment
bounds and existing pipe segments. Short paths are preferred, with penalties
for bends and crossings. Corners are rounded; disconnected crossings receive
bridges, while explicit junctions remain joined. Components cannot overlap.
The editor rejects a position when a clear route cannot be found and keeps the
last saved position. Routes are cached because their geometry does not depend on
sensor values.

**Alternatives:** A pixel grid adds resolution and staircase choices; a diagram
library adds a dependency and integration cost. Handwritten routes do not scale
to free placement. This small router fits the existing SVG renderer, but routes
are calculated in a fixed order and it does not search every alternative. It
can reject a non-overlapping arrangement for which a route exists. Shared buffer connections and individually positioned heating circuits still require explicit modeling.

## Verification

Automated tests cover topology, routing, crossings, collision rejection, saved
positions and compatibility with existing diagrams. Manual interaction in a
browser and Home Assistant remains necessary to verify dragging, touch,
keyboard controls and real form events; geometry tests cannot replace it.

## Choosing connection sides

**Decision:** In the free-layout topology, the heating manifold chooses the
end facing the buffer, and the fresh-water module and hot-water tank choose
the sides facing one another. The heat-pump ports and common-return junction
face the diverter valve. The valve side port faces the heat pump, and tank
connections face their respective valve, heat pump or heating manifold. When
two buffer connections need the same side and height, their ports are
separated vertically: the heat-pump connection sits above the heating-circuit
connection. Upper ports remain on the straight side of the tank, and the
allocation avoids the valve when possible. The port direction, visible connector and flow
animation change together. Existing layouts keep their original sides.

**Alternative:** Let the router use a fixed side and draw around the device, or
try every possible port assignment. Facing sides avoid needless detours without
a combinatorial search. The allocation uses fixed vertical spacing rather than a general search across
all possible connection heights; the routing search can still reject placements
without a clear route.

## Movable return junctions

**Decision:** Register junctions in the connection model and derive the editor selection
from the configured topology. Only modeled return junctions with at least three
connected pipes and supported routing are selectable. The explicitly modeled
common heat-pump return junction can be selected and dragged. Its offsets are relative to the heat pump, and all
three connected pipes are rerouted together. A junction in an invalid or
unroutable position is not saved. The same editor and undo mechanism is used
for devices.

**Alternative:** Treat any line crossing as a movable junction. Crossings are
not necessarily connected, so that would change the represented topology. The
currently supported freely movable system has one modeled return junction;
other return junctions in other system variants must first be modeled before
they can be moved.

## Persistence and versioning

**Decision:** The card editor emits the complete configuration, including the
optional `layout.version: 1` map, through Home Assistant's normal
`config-changed` event. Coordinates are numeric SVG offsets, not pixels, so
responsive scaling does not change the saved layout. Positions for individual
tanks are relative to the combined tank offset; the heat source and common
return junction are relative to the heat pump. Pipes are recalculated from the
configuration and positions. Unknown configuration and layout fields are kept.

**Alternative:** Store fixed screen pixels or complete SVG paths. Pixels depend
on the display size; fixed paths would become detached when a component or the
topology changes. Existing version 1 coordinate meanings and default reference
positions are a compatibility contract. Incompatible changes require a new
version and an explicit migration; unknown versions remain untouched and are
not applied. Changing the topology can still make stored positions invalid or
unsupported, and changes to the router can alter the resulting path. Do not
promise identical rendering across arbitrary configuration or software changes.

**Verification:** Automated tests serialize the editor event, restore the card,
and check component and junction positions and connected pipes across sensor
updates. A standalone YAML round trip also checks the data types. Home
Assistant's own save, YAML editing and reload flow still requires an in-app
integration check.

## Heating circuits above the buffer

**Decision:** In a freely movable separate-buffer layout, mirror the manifold
and its circuits vertically when the manifold is placed above the buffer.
Supply and return endpoints, obstacle bounds and canvas bounds follow the
mirrored geometry; text is kept upright. The direction is derived from saved
positions, so no additional YAML setting is needed.

**Alternative:** Add a separate orientation setting. An explicit setting would
allow exceptions, but duplicates the usual spatial intent; the automatic rule
keeps the editor simple. The orientation can switch when the manifold crosses
the buffer height, and some positions may still be rejected by the router.

## Supply-side junctions and additional variants

The network exposes junctions for either supply or return only when actual
modeled pipes meet there. A return-side valve can optionally have a common
heat-pump supply (`wp.vorlauf_anbindung: gemeinsam`); its movable junction is
stored in `layout.vorlauf_abzweig`. The default remains the previous separate
supply drawing. This option is limited to separate tanks with separate heating
circuit connections and a supported combination of devices.

A stratified or baffle-plate tank with only a fresh-water module can be moved.
For separate tanks with a heat pump and separate heating-circuit connections,
solar thermal uses its own coil ports and a separately routed circuit. This
keeps the saved positions of the existing devices when solar is added. Existing
pipe segments are considered during routing; a routing failure is shown rather
than inventing a connection. Additional heat uses its own pair of buffer ports;
when components share a side, available heights are allocated with clearance.
If there is not enough room, the router reports a failure rather than merging
connections. The same separate-circuit topology is supported without a heat
pump, retaining the existing stored offsets. A hydraulic separator uses its
own four ports, and the allocator considers its buffer ports when placing
additional heat connections.
For separated tanks with a heating circuit and a hydraulic separator, the
separator has four independent connections. It, the tanks, manifold and sources
can move, with or without a fresh-water module or a heat pump; a heat pump
requires separate heating-circuit connections. Its position is
stored in `layout.weiche` as an offset. Connections sharing a side use separate
heights. The previous fixed diagram is kept without a custom layout; interpreting
visual crossings as junctions would give the diagram an unsupported hydraulic
meaning.
Combi and hygienic tanks can also move: their integrated vessel or coil and
drinking-water connections are part of the tank, rather than an independently
movable fresh-water module. With a heating circuit, these and the stratified and
baffle-plate types also have modeled heat-pump, separator, heating-manifold,
solar and additional-heat ports. Heating water and drinking water remain
distinct. The heat pump and optional sources can also be moved when no heating
circuit is displayed, for both single and separate tanks.
For separate tanks without a heat pump or heating circuits, additional heat
and solar are also movable, with separate routed supply and return and the
solar coil attached to the tank. Pumps are positioned on the computed return
route. These limited cases do not imply support for all combinations.
