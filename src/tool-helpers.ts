import { AEBridgeError } from "./ae-bridge.js";

/** Successful tool result: pretty-printed JSON in a text content block. */
export function ok(data: unknown) {
    return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }]
    };
}

/**
 * Wraps a tool body so any AEBridgeError (AE not running, osascript failure,
 * bad response, or an error thrown inside the ExtendScript itself) is
 * surfaced as a structured isError:true result instead of a generic thrown
 * exception -- lets the LLM see the actual AE-side message/line number.
 */
export async function runTool<T>(fn: () => Promise<T>) {
    try {
        const data = await fn();
        return ok(data);
    } catch (err) {
        if (err instanceof AEBridgeError) {
            const location = err.line !== null && err.line !== undefined ? ` (line ${err.line})` : "";
            return {
                content: [{ type: "text" as const, text: `[${err.kind}] ${err.message}${location}` }],
                isError: true
            };
        }
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: message }], isError: true };
    }
}
