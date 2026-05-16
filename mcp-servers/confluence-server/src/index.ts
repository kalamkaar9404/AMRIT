#!/usr/bin/env node
/**
 * AMRIT Confluence MCP Server
 *
 * Tools:
 *   - search_confluence       Full-text search across AMRIT Confluence spaces
 *   - get_confluence_page     Get full content of a page by ID
 *   - list_confluence_spaces  List available spaces
 *   - list_space_pages        List pages in a Confluence space
 *   - create_confluence_page  Create a new page in Confluence
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import "dotenv/config";
import { ConfluenceClient } from "./confluence-client.js";

const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL ?? "";
const CONFLUENCE_EMAIL = process.env.CONFLUENCE_EMAIL ?? "";
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN ?? "";
const CONFLUENCE_SPACES = process.env.CONFLUENCE_SPACES?.split(",").map((s) => s.trim()) ?? [];

if (!CONFLUENCE_BASE_URL || !CONFLUENCE_EMAIL || !CONFLUENCE_API_TOKEN) {
  console.error("Missing required env vars: CONFLUENCE_BASE_URL, CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN");
  process.exit(1);
}

const confluence = new ConfluenceClient(CONFLUENCE_BASE_URL, CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN);

const server = new Server(
  { name: "amrit-confluence-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_confluence",
      description:
        "Search AMRIT Confluence for documentation, BRDs, concept notes, or architecture docs. " +
        "Examples: 'beneficiary registration BRD', '104 helpline call flow', 'HWC module architecture'",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          space_keys: {
            type: "array",
            items: { type: "string" },
            description: "Optional: limit to specific Confluence spaces (e.g. ['AMRIT', 'DEV'])",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_confluence_page",
      description: "Get the full content of a Confluence page by its ID",
      inputSchema: {
        type: "object",
        properties: {
          page_id: { type: "string", description: "Confluence page ID" },
        },
        required: ["page_id"],
      },
    },
    {
      name: "list_confluence_spaces",
      description: "List all available Confluence spaces in the AMRIT workspace",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_space_pages",
      description: "List pages in a specific Confluence space",
      inputSchema: {
        type: "object",
        properties: {
          space_key: { type: "string", description: "Confluence space key (e.g. AMRIT)" },
          limit: { type: "number", description: "Number of pages to return (default 20)" },
        },
        required: ["space_key"],
      },
    },
    {
      name: "create_confluence_page",
      description: "Create a new Confluence page (e.g. release notes, architecture decision records)",
      inputSchema: {
        type: "object",
        properties: {
          space_key: { type: "string", description: "Space key where the page should be created" },
          title: { type: "string", description: "Page title" },
          content: { type: "string", description: "Page content in plain text / markdown" },
          parent_id: { type: "string", description: "Optional: parent page ID to nest under" },
        },
        required: ["space_key", "title", "content"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search_confluence") {
      const parsed = z
        .object({ query: z.string(), space_keys: z.array(z.string()).optional() })
        .parse(args);
      const spaces = parsed.space_keys ?? CONFLUENCE_SPACES;
      const results = await confluence.searchPages(parsed.query, spaces.length ? spaces : undefined);

      if (!results.length) return { content: [{ type: "text", text: "No pages found." }] };

      const text = results
        .map(
          (r) =>
            `**${r.page.title}** (Space: ${r.page.spaceKey})\n` +
            `ID: ${r.page.id} | URL: ${r.page.url}\n` +
            `Last modified: ${r.page.lastModified}\n\n` +
            `${r.excerpt}`
        )
        .join("\n\n---\n\n");

      return { content: [{ type: "text", text }] };
    }

    if (name === "get_confluence_page") {
      const { page_id } = z.object({ page_id: z.string() }).parse(args);
      const page = await confluence.getPage(page_id);
      return {
        content: [
          {
            type: "text",
            text:
              `# ${page.title}\n\n` +
              `**Space:** ${page.spaceName} (${page.spaceKey})\n` +
              `**Author:** ${page.author} | **Last modified:** ${page.lastModified}\n` +
              `**URL:** ${page.url}\n\n---\n\n${page.content}`,
          },
        ],
      };
    }

    if (name === "list_confluence_spaces") {
      const spaces = await confluence.getSpaces(CONFLUENCE_SPACES.length ? CONFLUENCE_SPACES : undefined);
      const text = spaces.map((s) => `- **${s.key}** — ${s.name} (${s.type})\n  ${s.url}`).join("\n\n");
      return { content: [{ type: "text", text }] };
    }

    if (name === "list_space_pages") {
      const parsed = z.object({ space_key: z.string(), limit: z.number().optional() }).parse(args);
      const pages = await confluence.getPagesInSpace(parsed.space_key, parsed.limit ?? 20);
      const text = pages.map((p) => `- **${p.title}** (ID: ${p.id})\n  ${p.url}`).join("\n\n");
      return { content: [{ type: "text", text }] };
    }

    if (name === "create_confluence_page") {
      const parsed = z
        .object({ space_key: z.string(), title: z.string(), content: z.string(), parent_id: z.string().optional() })
        .parse(args);
      const result = await confluence.createPage(parsed.space_key, parsed.title, parsed.content, parsed.parent_id);
      return {
        content: [
          { type: "text", text: `Page created!\n**ID:** ${result.id}\n**URL:** ${result.url}` },
        ],
      };
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  } catch (err) {
    if (err instanceof McpError) throw err;
    throw new McpError(ErrorCode.InternalError, String(err));
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AMRIT Confluence MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
