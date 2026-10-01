import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runExtendScriptInUndoGroup } from "../ae-bridge.js";
import { runTool } from "../tool-helpers.js";

export function registerEscapeHatchTool(server: McpServer): void {
    server.registerTool(
        "run_script",
        {
            title: "Run script (escape hatch)",
            description:
                "Executes arbitrary ExtendScript code directly inside the user's running After Effects instance. This has full access to the AE scripting object model (app, project, compositions, layers, files, the file system via File/Folder) with NO sandboxing -- it can create, modify, or permanently delete project data, and can read/write arbitrary files reachable by the ExtendScript File/Folder objects. Use only when the structured tools (set_property, set_keyframe, set_expression, apply_effect, create_layer, layer/comp/render/mask tools) cannot express what's needed -- notably: anything involving motion tracking, camera tracking, roto brush, or warp stabilizer (mostly UI-driven, not reliably scriptable), or effect/layer types beyond what create_layer and apply_effect cover. The helpers __resolveComp(compId, compName), __resolveLayer(comp, layerIndex, layerName), and __resolvePropertyPath(layer, pathStr) are already in scope. The script body must end in an explicit return statement whose value will be JSON-serialized back. Runs inside a single AE undo group, so Cmd+Z in the AE UI can revert one call's effects -- there is no other rollback.",
            inputSchema: z.object({
                script: z.string().describe("ExtendScript source. Must end in a `return <value>;` statement.")
            })
        },
        async ({ script }) => runTool(() => runExtendScriptInUndoGroup(script, "ae-mcp: run_script"))
    );
}
