import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runExtendScript } from "../ae-bridge.js";
import { runTool } from "../tool-helpers.js";
import { jsxLiteral } from "../jsx-literal.js";
import { CompRef, LayerRef } from "../types.js";

const INTERPOLATION_TYPES = ["LINEAR", "BEZIER", "HOLD"] as const;

export function registerKeyframeTools(server: McpServer): void {
    server.registerTool(
        "set_keyframe",
        {
            title: "Set keyframe",
            description: "Sets a keyframe on any property at a given time, with optional interpolation type and temporal ease. This is the core primitive for animation -- shares the same Source Text / mask-shape handling as set_property, so mask-path (roto) keyframing works through this tool too.",
            inputSchema: z.object({
                ...CompRef,
                ...LayerRef,
                propertyPath: z.string().describe("AE property path, e.g. 'Transform.Position', 'Masks.Mask 1.Mask Path'."),
                time: z.number().describe("Seconds."),
                value: z.unknown(),
                interpolation: z
                    .object({
                        in: z.enum(INTERPOLATION_TYPES).optional(),
                        out: z.enum(INTERPOLATION_TYPES).optional()
                    })
                    .optional(),
                easing: z
                    .object({
                        inSpeed: z.number().default(0),
                        inInfluence: z.number().min(0.1).max(100).default(33.33),
                        outSpeed: z.number().default(0),
                        outInfluence: z.number().min(0.1).max(100).default(33.33)
                    })
                    .optional()
                    .describe("Temporal ease. Only meaningful combined with BEZIER interpolation.")
            })
        },
        async ({ compId, compName, layerIndex, layerName, propertyPath, time, value, interpolation, easing }) =>
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

            prop.setValueAtTime(${jsxLiteral(time)}, valueToSet);
            var keyIndex = prop.nearestKeyIndex(${jsxLiteral(time)});

            var interpIn = ${jsxLiteral(interpolation?.in)};
            var interpOut = ${jsxLiteral(interpolation?.out)};
            if (interpIn !== undefined || interpOut !== undefined) {
                prop.setInterpolationTypeAtKey(
                    keyIndex,
                    KeyframeInterpolationType[interpIn || interpOut || "LINEAR"],
                    KeyframeInterpolationType[interpOut || interpIn || "LINEAR"]
                );
            }

            var easing = ${jsxLiteral(easing)};
            if (easing !== undefined) {
                var dims = prop.isSpatial ? 1 : ((prop.value instanceof Array) ? prop.value.length : 1);
                var inEase = [], outEase = [];
                for (var d = 0; d < dims; d++) {
                    inEase.push(new KeyframeEase(easing.inSpeed, easing.inInfluence));
                    outEase.push(new KeyframeEase(easing.outSpeed, easing.outInfluence));
                }
                prop.setTemporalEaseAtKey(keyIndex, inEase, outEase);
            }

            return {
                keyIndex: keyIndex,
                time: prop.keyTime(keyIndex),
                value: __normalizePropertyValue(prop, prop.keyValue(keyIndex))
            };
`)
            )
    );
}
