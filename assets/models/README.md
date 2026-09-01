# 3D assets

Every model is a Wavefront **OBJ** file with a matching **MTL**. Open any
`.obj` in Blender, edit it, and export over the same filename — the web
client picks it up on reload. No build step.

| file        | what it is                        | used as                          |
| ----------- | --------------------------------- | -------------------------------- |
| `tile.obj`  | one grid cell panel               | 25 tiles, 5×5 field              |
| `player.obj`| the marker you slide to dodge     | bottom row                       |
| `note.obj`  | a falling hazard gem              | one per falling letter           |
| `pip.obj`   | a single health pip               | 3 above the field                |
| `frame.obj` | the border (4 bars)               | around the field                 |

## Conventions

- 1 unit = one grid cell.
- The field is centred on the origin; cell centres sit at x/z ∈ {-2,-1,0,1,2}.
- +y is up. A tile's **top face is at y = 0**, so models that "sit on" the
  board are built upward from y = 0.
- Keep each file's pieces named (the `o` groups) — nothing depends on the
  names yet, but it keeps the outliner readable.

## Materials

The neon glow in the client comes from materials assigned in
`web/main.js` (so the bloom pass has something to work with). The `.mtl`
files carry the equivalent colours — `Kd` base, `Ke` emission — so Blender
shows roughly the right look. If you want to retune colours for the game,
edit `web/main.js`; the `.mtl` is just for editing convenience.

## Regenerating

`node assets/models/generate.js` rewrites all five pairs from the
parametric definitions at the bottom of that script. Only needed if you
want to change base dimensions; hand-edits in Blender are the normal path.
