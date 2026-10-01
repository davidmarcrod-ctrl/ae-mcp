import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runExtendScript } from "../ae-bridge.js";
import { runTool } from "../tool-helpers.js";
import { jsxLiteral } from "../jsx-literal.js";
import { CompRef, LayerRef } from "../types.js";

const BLEND_MODES = [
    "NORMAL", "MULTIPLY", "SCREEN", "OVERLAY", "DARKEN", "LIGHTEN",
    "COLOR_DODGE", "COLOR_BURN", "ADD", "SUBTRACT", "DIFFERENCE",
    "DIFFERENCE2", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY",
    "STENCIL_ALPHA", "STENCIL_LUMA", "SILHOUETTE_ALPHA", "SILHOUETTE_LUMA",
    "LUMINESCENT_PREMUL", "LINEAR_DODGE", "LINEAR_BURN", "LINEAR_LIGHT",
    "VIVID_LIGHT", "PIN_LIGHT", "HARD_MIX", "HARD_LIGHT", "SOFT_LIGHT",
    "CLASSIC_COLOR_DODGE", "CLASSIC_COLOR_BURN", "CLASSIC_DIFFERENCE",
    "DANCING_DISSOLVE", "DISSOLVE", "OVERLAY_CLASSIC", "ALPHA_ADD"
] as const;

const TRACK_MATTE_TYPES = ["ALPHA", "ALPHA_INVERTED", "LUMA", "LUMA_INVERTED"] as const;
const MASK_MODES = ["NONE", "ADD", "SUBTRACT", "INTERSECT", "LIGHTEN", "DARKEN", "DIFFERENCE"] as const;
const LAYER_TYPES = ["shape", "text", "solid", "camera", "light", "null"] as const;
const LIGHT_TYPES = ["PARALLEL", "SPOT", "POINT", "AMBIENT"] as const;

export function registerLayerTools(server: McpServer): void {
    server.registerTool(
        "list_layers",
        {
            title: "List layers",
            description: "Lists the layers in a composition, with a transform snapshot for each (position, scale, opacity, rotation -- 3D-aware). Layer indices shift after structural operations; re-call this before reusing an index.",
            inputSchema: z.object({ ...CompRef })
        },
        async ({ compId, compName }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var out = [];
            for (var i = 1; i <= comp.numLayers; i++) {
                var layer = comp.layer(i);
                var tg = layer.property("ADBE Transform Group");
                var transform = {
                    position: tg.property("ADBE Position").value,
                    scale: tg.property("ADBE Scale").value,
                    opacity: tg.property("ADBE Opacity").value,
                    rotation: null,
                    orientation: null
                };
                if (layer.threeDLayer) {
                    transform.orientation = tg.property("ADBE Orientation").value;
                    transform.rotation = {
                        x: tg.property("ADBE Rotate X").value,
                        y: tg.property("ADBE Rotate Y").value,
                        z: tg.property("ADBE Rotate Z").value
                    };
                } else {
                    transform.rotation = tg.property("ADBE Rotate Z").value;
                }
                out.push({
                    index: layer.index,
                    name: layer.name,
                    matchName: layer.matchName,
                    enabled: layer.enabled,
                    threeDLayer: layer.threeDLayer,
                    inPoint: layer.inPoint,
                    outPoint: layer.outPoint,
                    startTime: layer.startTime,
                    parentIndex: layer.parent ? layer.parent.index : null,
                    blendingMode: layer.blendingMode ? layer.blendingMode.toString() : null,
                    transform: transform
                });
            }
            return out;
`)
            )
    );

    server.registerTool(
        "duplicate_layer",
        {
            title: "Duplicate layer",
            description: "Duplicates a layer within its composition. Returns the new layer's index/name -- note this shifts every layer index below it.",
            inputSchema: z.object({ ...CompRef, ...LayerRef })
        },
        async ({ compId, compName, layerIndex, layerName }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var layer = __resolveLayer(comp, ${jsxLiteral(layerIndex)}, ${jsxLiteral(layerName)});
            var newLayer = layer.duplicate();
            return { index: newLayer.index, name: newLayer.name };
`)
            )
    );

    server.registerTool(
        "precompose_layers",
        {
            title: "Precompose layers",
            description: "Precomposes a set of layers (by index) in a composition into a new nested composition.",
            inputSchema: z.object({
                ...CompRef,
                layerIndices: z.array(z.number().int().min(1)).min(1),
                newCompName: z.string(),
                moveAllAttributes: z.boolean().default(true)
            })
        },
        async ({ compId, compName, layerIndices, newCompName, moveAllAttributes }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var newComp = comp.layers.precompose(
                ${jsxLiteral(layerIndices)}, ${jsxLiteral(newCompName)}, ${jsxLiteral(moveAllAttributes)}
            );
            return { id: newComp.id, name: newComp.name };
`)
            )
    );

    server.registerTool(
        "set_layer_parent",
        {
            title: "Set layer parent",
            description: "Sets (or clears, with parentLayerIndex omitted/null) a layer's parent, for rigging-style animation chains.",
            inputSchema: z.object({
                ...CompRef,
                layerIndex: z.number().int().min(1),
                parentLayerIndex: z.number().int().min(1).nullable()
            })
        },
        async ({ compId, compName, layerIndex, parentLayerIndex }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var layer = __resolveLayer(comp, ${jsxLiteral(layerIndex)}, undefined);
            var parentIndex = ${jsxLiteral(parentLayerIndex)};
            layer.parent = (parentIndex === null) ? null : comp.layer(parentIndex);
            return { index: layer.index, parentIndex: layer.parent ? layer.parent.index : null };
`)
            )
    );

    server.registerTool(
        "set_layer_3d",
        {
            title: "Set layer 3D flag",
            description: "Enables or disables the 3D layer switch for a layer.",
            inputSchema: z.object({ ...CompRef, ...LayerRef, threeD: z.boolean() })
        },
        async ({ compId, compName, layerIndex, layerName, threeD }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var layer = __resolveLayer(comp, ${jsxLiteral(layerIndex)}, ${jsxLiteral(layerName)});
            layer.threeDLayer = ${jsxLiteral(threeD)};
            return { threeDLayer: layer.threeDLayer };
`)
            )
    );

    server.registerTool(
        "set_layer_blend_mode",
        {
            title: "Set layer blend mode",
            description: "Sets a layer's compositing blend mode (Multiply, Screen, Add, etc.).",
            inputSchema: z.object({ ...CompRef, ...LayerRef, mode: z.enum(BLEND_MODES) })
        },
        async ({ compId, compName, layerIndex, layerName, mode }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var layer = __resolveLayer(comp, ${jsxLiteral(layerIndex)}, ${jsxLiteral(layerName)});
            layer.blendingMode = BlendingMode[${jsxLiteral(mode)}];
            return { blendingMode: layer.blendingMode.toString() };
`)
            )
    );

    server.registerTool(
        "set_track_matte",
        {
            title: "Set track matte",
            description: "Assigns matteLayerIndex as the track matte for the target layer, using the given matte type (alpha/luma, inverted or not). API shape for this was flagged as needing verification against the installed AE version -- if it fails, use run_script with 'layer.trackMatteType = TrackMatteType....' as a fallback (legacy API, requires the matte layer to be directly above the target in the stack).",
            inputSchema: z.object({
                ...CompRef,
                layerIndex: z.number().int().min(1),
                matteLayerIndex: z.number().int().min(1),
                matteType: z.enum(TRACK_MATTE_TYPES)
            })
        },
        async ({ compId, compName, layerIndex, matteLayerIndex, matteType }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var layer = __resolveLayer(comp, ${jsxLiteral(layerIndex)}, undefined);
            var matteLayer = __resolveLayer(comp, ${jsxLiteral(matteLayerIndex)}, undefined);
            layer.setTrackMatte(matteLayer, TrackMatteType[${jsxLiteral(matteType)}]);
            return { index: layer.index, matteLayerIndex: matteLayer.index, matteType: ${jsxLiteral(matteType)} };
`)
            )
    );

    server.registerTool(
        "add_mask",
        {
            title: "Add mask",
            description: "Creates a new mask on a layer from an initial polygon (straight edges only -- v1 does not set bezier tangents). Refine or animate the shape afterward via set_property/set_keyframe on propertyPath 'Masks.Mask N.Mask Path' (N = returned maskIndex).",
            inputSchema: z.object({
                ...CompRef,
                ...LayerRef,
                vertices: z.array(z.tuple([z.number(), z.number()])).min(3).describe("Polygon vertices in layer coordinates, e.g. [[100,100],[300,100],[300,300]]"),
                closed: z.boolean().default(true),
                maskMode: z.enum(MASK_MODES).default("ADD")
            })
        },
        async ({ compId, compName, layerIndex, layerName, vertices, closed, maskMode }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var layer = __resolveLayer(comp, ${jsxLiteral(layerIndex)}, ${jsxLiteral(layerName)});
            var masksGroup = layer.property("ADBE Mask Parade");
            var mask = masksGroup.addProperty("ADBE Mask Atom");
            mask.maskMode = MaskMode[${jsxLiteral(maskMode)}];
            var shapeProp = mask.property("ADBE Mask Shape");
            shapeProp.setValue(__shapeFromPlainObject({ vertices: ${jsxLiteral(vertices)}, closed: ${jsxLiteral(closed)} }));
            return { maskIndex: mask.propertyIndex, name: mask.name };
`)
            )
    );

    server.registerTool(
        "create_layer",
        {
            title: "Create layer",
            description:
                "Creates a new layer in a composition: shape, text, solid, camera, light, or null. This is the tool for adding new elements to a scene -- use it instead of run_script for layer creation.",
            inputSchema: z.object({
                ...CompRef,
                type: z.enum(LAYER_TYPES),
                name: z.string().optional().describe("Layer name. Ignored for solid/camera/light if you also want AE's default naming (they get a name param directly)."),
                text: z.string().optional().describe("Initial source text. Only used for type 'text'; defaults to empty string."),
                color: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]).optional().describe("RGB, each 0-1. Only used for type 'solid'; defaults to black."),
                width: z.number().int().positive().optional().describe("Only used for type 'solid'; defaults to the composition's width."),
                height: z.number().int().positive().optional().describe("Only used for type 'solid'; defaults to the composition's height."),
                lightType: z.enum(LIGHT_TYPES).default("POINT").describe("Only used for type 'light'.")
            })
        },
        async ({ compId, compName, type, name, text, color, width, height, lightType }) =>
            runTool(() =>
                runExtendScript(`
            var comp = __resolveComp(${jsxLiteral(compId)}, ${jsxLiteral(compName)});
            var type = ${jsxLiteral(type)};
            var name = ${jsxLiteral(name)};
            var layer;
            if (type === "shape") {
                layer = comp.layers.addShape();
            } else if (type === "text") {
                var text = ${jsxLiteral(text)};
                layer = comp.layers.addText(text !== undefined ? text : "");
            } else if (type === "solid") {
                var color = ${jsxLiteral(color)};
                var width = ${jsxLiteral(width)};
                var height = ${jsxLiteral(height)};
                layer = comp.layers.addSolid(
                    color !== undefined ? color : [0, 0, 0],
                    name !== undefined ? name : "Solid",
                    width !== undefined ? width : comp.width,
                    height !== undefined ? height : comp.height,
                    comp.pixelAspect,
                    comp.duration
                );
            } else if (type === "camera") {
                layer = comp.layers.addCamera(name !== undefined ? name : "Camera", [comp.width / 2, comp.height / 2]);
            } else if (type === "light") {
                layer = comp.layers.addLight(name !== undefined ? name : "Light", [comp.width / 2, comp.height / 2]);
                layer.lightType = LightType[${jsxLiteral(lightType)}];
            } else if (type === "null") {
                layer = comp.layers.addNull(comp.duration);
            } else {
                throw new Error("Unknown layer type: " + type);
            }
            if (name !== undefined && (type === "shape" || type === "text" || type === "null")) {
                layer.name = name;
            }
            return { index: layer.index, name: layer.name, matchName: layer.matchName };
`)
            )
    );
}
