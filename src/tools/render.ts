import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runExtendScript } from "../ae-bridge.js";
import { runTool } from "../tool-helpers.js";
import { jsxLiteral } from "../jsx-literal.js";
import { CompRef } from "../types.js";

// renderQueue.render() blocks AE's main thread until every queued item
// finishes, which for real renders can be minutes to hours -- start_render
// needs a much longer bridge timeout than the ~30s default used elsewhere.
const RENDER_TIMEOUT_MS = 6 * 60 * 60 * 1000;

export function registerRenderTools(server: McpServer): void {
    server.registerTool(
        "queue_render",
        {
            title: "Queue render",
            description: "Adds a composition to the render queue with an output path and optional render-settings/output-module template names. Does NOT start rendering -- call start_render for that.",
            inputSchema: z.object({
                ...CompRef,
                outputPath: z.string().describe("Absolute output file path."),
                renderSettingsTemplate: z.string().optional().describe("Name of a saved Render Settings template, e.g. 'Best Settings'."),
                outputModuleTemplate: z.string().optional().describe("Name of a saved Output Module template, e.g. 'H.264'.")
            })
        },
        async ({ compId, compName, outputPath, renderSettingsTemplate, outputModuleTemplate }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var rqItem = app.project.renderQueue.items.add(comp);
            var renderSettingsTemplate = ${jsxLiteral(renderSettingsTemplate)};
            if (renderSettingsTemplate !== undefined) rqItem.applyTemplate(renderSettingsTemplate);
            var om = rqItem.outputModule(1);
            var outputModuleTemplate = ${jsxLiteral(outputModuleTemplate)};
            if (outputModuleTemplate !== undefined) om.applyTemplate(outputModuleTemplate);
            om.file = new File(${jsxLiteral(outputPath)});
            return { rqIndex: rqItem.index, compName: comp.name };
`)
            )
    );

    server.registerTool(
        "start_render",
        {
            title: "Start render",
            description:
                "Starts rendering everything currently in the render queue. WARNING: this blocks until all queued items finish rendering -- for a real render this can take minutes to hours, and this tool call will not return until then. There is no live progress polling: get_render_queue_status called during a render will most likely just wait behind this call rather than returning early with partial status.",
            inputSchema: z.object({})
        },
        async () =>
            runTool(() =>
                runExtendScript(
                    `
            app.project.renderQueue.render();
            return { numItems: app.project.renderQueue.numItems };
`,
                    RENDER_TIMEOUT_MS
                )
            )
    );

    server.registerTool(
        "get_render_queue_status",
        {
            title: "Get render queue status",
            description: "Reads the status (QUEUED/RENDERING/DONE/etc.) of every item in the render queue. Only reliably answerable between renders -- see start_render's description for why this can't meaningfully poll progress during an active render.",
            inputSchema: z.object({})
        },
        async () =>
            runTool(() =>
                runExtendScript(`
            var out = [];
            var rq = app.project.renderQueue;
            for (var i = 1; i <= rq.numItems; i++) {
                var item = rq.item(i);
                out.push({ index: i, comp: item.comp.name, status: item.status.toString() });
            }
            return out;
`)
            )
    );
}
