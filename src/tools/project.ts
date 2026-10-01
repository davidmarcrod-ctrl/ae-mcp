import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { runExtendScript } from "../ae-bridge.js";
import { runTool } from "../tool-helpers.js";
import { jsxLiteral } from "../jsx-literal.js";
import type { CompSummary } from "../types.js";

export function registerProjectTools(server: McpServer): void {
    server.registerTool(
        "list_compositions",
        {
            title: "List compositions",
            description: "Lists every composition in the currently open After Effects project, with id, name, size, pixel aspect, duration, frame rate, and layer count.",
            inputSchema: z.object({})
        },
        async () =>
            runTool(() =>
                runExtendScript<CompSummary[]>(`
            var items = [];
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof CompItem) {
                    items.push({
                        id: it.id, name: it.name, width: it.width, height: it.height,
                        pixelAspect: it.pixelAspect, duration: it.duration,
                        frameRate: it.frameRate, numLayers: it.numLayers
                    });
                }
            }
            return items;
`)
            )
    );

    server.registerTool(
        "create_composition",
        {
            title: "Create composition",
            description: "Creates a new composition in the currently open project.",
            inputSchema: z.object({
                name: z.string(),
                width: z.number().int().min(4).max(30000),
                height: z.number().int().min(4).max(30000),
                pixelAspect: z.number().positive().default(1),
                durationSeconds: z.number().positive(),
                frameRate: z.number().min(1).max(99)
            })
        },
        async ({ name, width, height, pixelAspect, durationSeconds, frameRate }) =>
            runTool(() =>
                runExtendScript<{ id: number; name: string }>(`
            var comp = app.project.items.addComp(
                ${jsxLiteral(name)}, ${jsxLiteral(width)}, ${jsxLiteral(height)},
                ${jsxLiteral(pixelAspect)}, ${jsxLiteral(durationSeconds)}, ${jsxLiteral(frameRate)}
            );
            return { id: comp.id, name: comp.name };
`)
            )
    );

    server.registerTool(
        "open_project",
        {
            title: "Open project",
            description: "Opens an existing .aep project file. Refuses if the currently open project has unsaved changes, since a native 'Save changes?' dialog would otherwise block headless execution -- save or discard first.",
            inputSchema: z.object({ path: z.string().describe("Absolute path to the .aep file.") })
        },
        async ({ path }) =>
            runTool(() =>
                runExtendScript<{ path: string | null }>(`
            if (app.project.dirty) {
                throw new Error("Current project has unsaved changes. Save or discard them before opening another project.");
            }
            app.open(new File(${jsxLiteral(path)}));
            return { path: app.project.file ? app.project.file.fsName : null };
`)
            )
    );

    server.registerTool(
        "save_project",
        {
            title: "Save project",
            description: "Saves the currently open project, optionally to a new path (Save As).",
            inputSchema: z.object({ path: z.string().optional().describe("If given, saves to this path (Save As); otherwise saves in place.") })
        },
        async ({ path }) =>
            runTool(() =>
                runExtendScript<{ path: string | null }>(`
            if (${jsxLiteral(path)} !== undefined) {
                app.project.save(new File(${jsxLiteral(path)}));
            } else {
                app.project.save();
            }
            return { path: app.project.file ? app.project.file.fsName : null };
`)
            )
    );

    server.registerTool(
        "get_project_info",
        {
            title: "Get project info",
            description: "Returns info about the currently open project: file path, active composition, item count, and unsaved-changes flag.",
            inputSchema: z.object({})
        },
        async () =>
            runTool(() =>
                runExtendScript<{
                    projectPath: string | null;
                    activeCompId: number | null;
                    activeCompName: string | null;
                    numItems: number;
                    dirty: boolean;
                }>(`
            var active = app.project.activeItem;
            var isComp = active instanceof CompItem;
            return {
                projectPath: app.project.file ? app.project.file.fsName : null,
                activeCompId: isComp ? active.id : null,
                activeCompName: isComp ? active.name : null,
                numItems: app.project.numItems,
                dirty: app.project.dirty
            };
`)
            )
    );
}
