# Free-layout variant audit

The renderer supports several combinations whose hydraulic drawing differs.
A draggable component must have modeled ports and connections before its
position can change. A visible intersection is not sufficient evidence for a
junction. These are diagram connections, not a claim about a particular
installation's plumbing.

| Variant | Current drawing | Work needed for free layout |
| --- | --- | --- |
| Stratified / baffle-plate tank | One outer tank; heat-pump, module and heating-circuit connections share it. | The tank, fresh-water module, heat pump and optional sources can move with distinct connections, with or without a heating circuit. With a heating circuit the manifold and separator can also move. |
| Combi / hygienic tank | One outer tank with integrated domestic-water vessel or coil; no separate fresh-water module is drawn. | The tank, integrated drinking-water connections, heat pump and optional sources can move, with or without a heating circuit. With a heating circuit the manifold and separator can also move. |
| Additional heat generator | Generator has flow and return on the buffer; pumps, labels, flue or district-heating lines are drawn separately. | For separate tanks without heating circuits, or with separate heating connections or a hydraulic separator, the generator and its two pipes are modeled with or without WP. Buffer ports are separated by available height; overlaps and missing routes are rejected. |
| Solar thermal | Collector connects to a coil at the bottom of the tank; pump and metrics are drawn separately. | Collector circuit and coil ports are modeled for separate tanks without heating circuits, or with separate heating-circuit connections or a hydraulic separator, with or without WP. Other combinations require their connections to be modeled. |
| Hydraulic separator | Separate device with four connections between the primary and secondary circuits. | In single- and separate-tank systems, the separator, tanks, manifold and optional sources can move; all four separator pipes route independently. WP with separate tanks requires separate heating-circuit connections. |
| Diverter valve in return | Tank returns pass through the valve to the heat pump; the heat-pump supply has different branches. | Separate tanks with separate heating-circuit connections are supported. An optional common supply is modeled as a real movable junction; unsupported combinations remain restricted. |
| Multiple heating circuits | Circuits are attached to a common manifold. The manifold and circuits can currently move together. | To move one circuit independently, model its supply and return connections to the manifold and give it a stable identity that survives reordering. |

Separate tanks without a displayed heating circuit, or with separate heating-circuit
connections, support both valve positions and optional sources with or without a heat pump.
Without a heat pump or additional source, a heating circuit can also move without
the separate-port setting, because no other circuit shares its buffer connections.
Movement in other configurations remains limited. Before broadening a variant, retain the
original rendering for cards without a layout and test the actual topology,
port direction, animation, overlap, saving and restoring positions, and the
interaction of optional devices. Do not enable unrestricted movement while a
connected device is still drawn using fixed coordinates.
