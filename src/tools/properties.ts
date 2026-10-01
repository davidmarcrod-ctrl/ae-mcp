import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runExtendScript } from "../ae-bridge.js";
import { runTool } from "../tool-helpers.js";
import { jsxLiteral } from "../jsx-literal.js";
import { CompRef, LayerRef } from "../types.js";

const propertyPathDescription =
    "AE property path, dot-separated, e.g. 'Transform.Position', 'Effects.Gaussian Blur.Blurriness', 'Masks.Mask 1.Mask Path', 'Text.Source Text'. Top-level shortcuts: Transform, Effects, Text, Masks, Layer Styles.";

export function registerPropertyTools(server: McpServer): void {
    server.registerTool(
        "get_property",
        {
            title: "Get property",
            description: "Reads a property's current value (or its value at a given time), plus its keyframe count, match name, and expression (if any). Shape-valued properties (mask paths) come back as {vertices, inTangents, outTangents, closed}; Source Text comes back as a plain string.",
            inputSchema: z.object({
                ...CompRef,
                ...LayerRef,
                propertyPath: z.string().describe(propertyPathDescription),
                time: z.number().optional().describe("Seconds. Omit to read the current/static value.")
            })
        },
        async ({ compId, compName, layerIndex, layerName, propertyPath, time }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var layer = __resolveLayer(comp, ${jsxLiteral(layerIndex)}, ${jsxLiteral(layerName)});
            var prop = __resolvePropertyPath(layer, ${jsxLiteral(propertyPath)});
            return {
                value: __readPropertyValue(prop, ${jsxLiteral(time)}),
                numKeys: prop.numKeys,
                expressionEnabled: prop.expressionEnabled,
                expression: prop.expressionEnabled ? prop.expression : null,
                matchName: prop.matchName
            };
`)
            )
    );

    server.registerTool(
        "set_property",
        {
            title: "Set property",
            description: "Writes a value to any property by path, optionally at a specific time (otherwise sets the static/current value). Source Text values are given as a plain string; Shape-valued properties (mask paths) as {vertices, inTangents?, outTangents?, closed?}.",
            inputSchema: z.object({
                ...CompRef,
                ...LayerRef,
                propertyPath: z.string().describe(propertyPathDescription),
                value: z.unknown(),
                time: z.number().optional().describe("Seconds. If given, sets the value at this time (creating/updating a keyframe if the property is already animated); otherwise sets the static value.")
            })
        },
        async ({ compId, compName, layerIndex, layerName, propertyPath, value, time }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var layer = __resolveLayer(comp, ${jsxLiteral(layerIndex)}, ${jsxLiteral(layerName)});
            var prop = __resolvePropertyPath(layer, ${jsxLiteral(propertyPath)});
            var rawValue = ${jsxLiteral(value)};
            var valueToSet = rawValue;
            if (__isTextDocumentProperty(prop)) {
                var td = prop.value;
                td.text = rawValue;
                valueToSet = td;
            } else if (__isShapeProperty(prop)) {
                valueToSet = __shapeFromPlainObject(rawValue);
            }
            var time = ${jsxLiteral(time)};
            if (time !== undefined) {
                prop.setValueAtTime(time, valueToSet);
            } else {
                prop.setValue(valueToSet);
            }
            return {
                propertyPath: ${jsxLiteral(propertyPath)},
                matchName: prop.matchName,
                newValue: __readPropertyValue(prop, time)
            };
`)
            )
    );
}
