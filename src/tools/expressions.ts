import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runExtendScript } from "../ae-bridge.js";
import { runTool } from "../tool-helpers.js";
import { jsxLiteral } from "../jsx-literal.js";
import { CompRef, LayerRef } from "../types.js";

export function registerExpressionTools(server: McpServer): void {
    server.registerTool(
        "set_expression",
        {
            title: "Set expression",
            description:
                "Sets (or clears, with an empty string) an AE expression on a property. This is the main lever for procedural/complex animation -- wiggle(), loopOut(), time-based motion, linking one property to another, etc. -- since it lets you write animation logic directly instead of needing a bespoke tool per pattern.",
            inputSchema: z.object({
                ...CompRef,
                ...LayerRef,
                propertyPath: z.string().describe("AE property path, e.g. 'Transform.Rotation', 'Transform.Position'."),
                expression: z.string().describe("AE expression source (JavaScript-like). Empty string disables/clears the expression.")
            })
        },
        async ({ compId, compName, layerIndex, layerName, propertyPath, expression }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var layer = __resolveLayer(comp, ${jsxLiteral(layerIndex)}, ${jsxLiteral(layerName)});
            var prop = __resolvePropertyPath(layer, ${jsxLiteral(propertyPath)});
            if (!prop.canSetExpression) {
                throw new Error("Property '" + ${jsxLiteral(propertyPath)} + "' does not support expressions.");
            }
            prop.expression = ${jsxLiteral(expression)};
            var err = null;
            try { err = prop.expressionError || null; } catch (e) { err = null; }
            return {
                propertyPath: ${jsxLiteral(propertyPath)},
                expressionEnabled: prop.expressionEnabled,
                expressionError: err
            };
`)
            )
    );
}
