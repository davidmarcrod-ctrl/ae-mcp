import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { registerProjectTools } from "./tools/project.js";
import { registerLayerTools } from "./tools/layers.js";
import { registerPropertyTools } from "./tools/properties.js";
import { registerKeyframeTools } from "./tools/keyframes.js";
import { registerExpressionTools } from "./tools/expressions.js";
import { registerEffectTools } from "./tools/effects.js";
import { registerRenderTools } from "./tools/render.js";
import { registerEscapeHatchTool } from "./tools/escape_hatch.js";

const server = new McpServer({ name: "ae-mcp", version: "0.1.0" });

registerProjectTools(server);
registerLayerTools(server);
registerPropertyTools(server);
registerKeyframeTools(server);
registerExpressionTools(server);
registerEffectTools(server);
registerRenderTools(server);
registerEscapeHatchTool(server);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    console.error("ae-mcp fatal startup error:", err);
    process.exit(1);
});
