import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runExtendScript } from "../ae-bridge.js";
import { runTool } from "../tool-helpers.js";
import { jsxLiteral } from "../jsx-literal.js";
import { CompRef, LayerRef } from "../types.js";

export function registerEffectTools(server: McpServer): void {
    server.registerTool(
        "apply_effect",
        {
            title: "Apply effect",
            description:
                "Adds an effect to a layer by its AE match name (e.g. 'ADBE Gaussian Blur 2', 'ADBE Drop Shadow', or a third-party plugin's match name), or applies an .ffx preset file. Effect parameters are then reachable via get_property/set_property/set_keyframe using paths like 'Effects.Gaussian Blur.Blurriness'. There is no built-in way to enumerate all installed effects' match names -- look them up externally, or use run_script to inspect an existing layer's applied effects.",
            inputSchema: z.object({
                ...CompRef,
                ...LayerRef,
                matchName: z.string().optional().describe("Effect match name, e.g. 'ADBE Gaussian Blur 2'. Use this or presetPath, not both."),
                presetPath: z.string().optional().describe("Absolute path to an .ffx preset file. Use this or matchName, not both.")
            })
        },
        async ({ compId, compName, layerIndex, layerName, matchName, presetPath }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var layer = __resolveLayer(comp, ${jsxLiteral(layerIndex)}, ${jsxLiteral(layerName)});
            var matchName = ${jsxLiteral(matchName)};
            var presetPath = ${jsxLiteral(presetPath)};
            if (matchName === undefined && presetPath === undefined) {
                throw new Error("Provide either matchName or presetPath.");
            }
            if (matchName !== undefined) {
                var fx = layer.property("ADBE Effect Parade").addProperty(matchName);
                return { name: fx.name, matchName: fx.matchName, propertyIndex: fx.propertyIndex };
            }
            layer.applyPreset(new File(presetPath));
            return { appliedPreset: presetPath };
`)
            )
    );
}
