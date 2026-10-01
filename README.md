# ae-mcp

An MCP server for controlling Adobe After Effects (macOS) from an LLM — composition/layer management, generic property and keyframe control, expressions, effects, masks, compositing (blend modes, track mattes), and render queue control, plus a raw ExtendScript escape hatch for anything not covered.

## How it works

Node generates ExtendScript (JSX), writes it to a temp file, and runs it against the currently open After Effects instance via `osascript`'s `DoScriptFile`. The script writes its JSON result to a second temp file (rather than relying on the `DoScriptFile` AppleEvent reply, which does not reliably carry the return value back), and Node reads that back.

## Requirements

- macOS, with Adobe After Effects installed and running with a project open.
- Node.js 20+.

By default the bridge targets "Adobe After Effects 2026" (matching the exact `.app` name macOS shows in `/Applications`). On a machine with a different version installed, set `AE_MCP_APP_NAME`, e.g.:

```bash
export AE_MCP_APP_NAME="Adobe After Effects 2025"
```

(add this to your shell profile, or to the `env` block of the server's entry in `claude_desktop_config.json`/`.mcp.json` if you want it scoped to just this server).

## Setup

```bash
npm install
npm run build
```

## Using it

**Claude Code** (this project already has a `.mcp.json` at its root declaring the server, so opening this project in Claude Code should pick it up automatically). To add it manually to another project or via the CLI:

```bash
claude mcp add ae-mcp -- node /path/to/ae-mcp/dist/index.js
```

**Claude Desktop**: add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ae-mcp": {
      "command": "node",
      "args": ["/path/to/ae-mcp/dist/index.js"]
    }
  }
}
```

Restart the app after editing. Either way, `npm run build` must be run first (and again after any code change).

For manual testing without a full MCP client:

```bash
npm run inspect
```

## Tools

| Tool | Purpose |
|---|---|
| `list_compositions` / `create_composition` | project composition management |
| `open_project` / `save_project` / `get_project_info` | project-level I/O |
| `list_layers` | layers in a comp with a transform snapshot |
| `get_property` / `set_property` | generic read/write of any property by path (e.g. `"Transform.Position"`, `"Effects.Gaussian Blur.Blurriness"`, `"Masks.Mask 1.Mask Path"`, `"Text.Source Text"`) |
| `set_keyframe` | keyframe a property with interpolation + temporal ease control — the core animation primitive |
| `set_expression` | set/clear an AE expression on a property — the main lever for procedural/complex animation |
| `apply_effect` | apply an effect (by match name) or an `.ffx` preset |
| `create_layer` | create a new shape / text / solid / camera / light / null layer |
| `duplicate_layer` / `precompose_layers` / `set_layer_parent` / `set_layer_3d` | structural layer ops |
| `set_layer_blend_mode` / `set_track_matte` | compositing |
| `add_mask` | create a polygon mask; animate its shape afterward via `set_property`/`set_keyframe` on its `Mask Path` |
| `queue_render` / `start_render` / `get_render_queue_status` | render queue control — see the warning below |
| `run_script` | escape hatch: arbitrary ExtendScript for anything the structured tools above don't cover |

## Known limitations

- **Layer indices shift** after any structural change (duplicate, precompose, a `run_script` that adds/removes layers). Re-call `list_layers` before reusing an index after such an operation.
- **`start_render` blocks** until the entire render queue finishes — this can be minutes to hours for a real render. There is no live progress polling: a `get_render_queue_status` call made *during* a render will most likely just queue behind it rather than returning early.
- **`open_project` refuses** if the current project has unsaved changes, since a native "Save changes?" dialog would otherwise block headless execution indefinitely.
- **Camera and light layers** have no `blendingMode` (`list_layers` reports it as `null` for them) and no 3D toggle in the usual sense (`threeDLayer` is omitted).
- **Motion tracking / camera tracking / roto brush / warp stabilizer** are not covered by structured tools (mostly UI-driven, not reliably scriptable) — `run_script` is the fallback, with low expectations.
- `run_script` runs arbitrary code against your live AE instance with no sandboxing.
