import { z } from "zod";

/** Identifies a composition by id or name; omit both to mean "the active comp". */
export const CompRef = {
    compId: z.number().int().optional().describe("Composition id (from list_compositions). Omit with compName, or omit both to use the active composition."),
    compName: z.string().optional().describe("Composition name. Omit with compId, or omit both to use the active composition.")
};

/** Identifies a layer by 1-based index or name within a resolved comp. */
export const LayerRef = {
    layerIndex: z.number().int().min(1).optional().describe("1-based layer index within the composition. Layer indices shift after structural changes (duplicate, precompose, layer add/remove) -- call list_layers again before reusing an index after such an operation."),
    layerName: z.string().optional().describe("Layer name. Used if layerIndex is omitted.")
};

export interface CompSummary {
    id: number;
    name: string;
    width: number;
    height: number;
    pixelAspect: number;
    duration: number;
    frameRate: number;
    numLayers: number;
}
