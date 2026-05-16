#!/usr/bin/env node
/**
 * AMRIT Docs MCP Server
 *
 * Exposes AMRIT documentation as an MCP server so AI agents can search
 * indexed docs, retrieve full articles, and list available repositories.
 *
 * Tools exposed:
 *   - search_amrit_docs    Search indexed AMRIT documentation
 *   - get_doc              Retrieve full content of a specific doc
 *   - list_repos           List all indexed AMRIT repositories
 *   - list_tags            List all tags in the index
 *
 * Run with: node dist/index.js
 * Communicates over stdio (MCP standard transport).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import "dotenv/config";
import { search, getByRepo, getByTag } from "./search.js";
import type { DocsIndex, DocEntry } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = process.env.AMRIT_DOCS_INDEX_PATH ?? path.join(__dirname, "../../data/docs-index");

function loadIndex(): DocsIndex | null {
  const indexFile = path.join(INDEX_PATH, "index.json");
  if (!fs.existsSync(indexFile)) return null;
  return JSON.parse(fs.readFileSync(indexFile, "utf-8")) as DocsIndex;
}

const server = new Server(
  { name: "amrit-docs-server", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {} } }
);

// ─── Tools ────────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_amrit_docs",
      description:
        "Search AMRIT documentation using plain English. Returns relevant docs with excerpts. " +
        "Use this to answer questions like 'how does 104 call routing work?' or 'what API does beneficiary registration use?'",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query in plain English",
          },
          top_k: {
            type: "number",
            description: "Maximum number of results to return (default: 5)",
          },
          repo_filter: {
            type: "string",
            description: "Optional: filter results to a specific AMRIT repo (e.g. 'HWC-API')",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_doc",
      description: "Retrieve the full content of a specific AMRIT documentation entry by its ID",
      inputSchema: {
        type: "object",
        properties: {
          doc_id: {
            type: "string",
            description: "The document ID (e.g. 'PSMRI/HWC-API/README.md')",
          },
        },
        required: ["doc_id"],
      },
    },
    {
      name: "list_amrit_repos",
      description: "List all AMRIT repositories that have been indexed with their doc counts",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_amrit_tags",
      description: "List all tags in the AMRIT docs index (e.g. 'beneficiary', 'api', 'hwc')",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_docs_by_tag",
      description: "Get all AMRIT documentation entries that match a specific tag",
      inputSchema: {
        type: "object",
        properties: {
          tag: { type: "string", description: "Tag to filter by (e.g. 'api', 'beneficiary', 'hwc')" },
        },
        required: ["tag"],
      },
    },
    {
      name: "get_index_status",
      description: "Get information about the current docs index (when it was built, how many docs)",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const index = loadIndex();

  if (name === "get_index_status") {
    if (!index) {
      return {
        content: [
          {
            type: "text",
            text: "No index found. Run 'npm run index:docs' to build the docs index.\n" +
              `Expected index at: ${path.join(INDEX_PATH, "index.json")}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "ready",
              builtAt: index.builtAt,
              version: index.version,
              totalDocs: index.entries.length,
              repos: [...new Set(index.entries.map((e) => e.repo).filter(Boolean))],
            },
            null,
            2
          ),
        },
      ],
    };
  }

  if (!index) {
    return {
      content: [
        {
          type: "text",
          text: "Docs index not found. Run `npm run index:docs` first to build the index.",
        },
      ],
      isError: true,
    };
  }

  if (name === "search_amrit_docs") {
    const parsed = z.object({ query: z.string(), top_k: z.number().optional(), repo_filter: z.string().optional() }).parse(args);
    let entries = index.entries;
    if (parsed.repo_filter) {
      entries = getByRepo(entries, parsed.repo_filter);
    }
    const results = search(entries, parsed.query, parsed.top_k ?? 5);

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: "No matching documents found for: " + parsed.query }],
      };
    }

    const text = results
      .map(
        (r, i) =>
          `## ${i + 1}. ${r.entry.title}\n` +
          `**Repo:** ${r.entry.repo} | **Path:** ${r.entry.path}\n` +
          `**URL:** ${r.entry.url}\n` +
          `**Tags:** ${r.entry.tags.join(", ")}\n\n` +
          `${r.excerpt}\n`
      )
      .join("\n---\n\n");

    return { content: [{ type: "text", text }] };
  }

  if (name === "get_doc") {
    const { doc_id } = z.object({ doc_id: z.string() }).parse(args);
    const entry = index.entries.find((e) => e.id === doc_id);
    if (!entry) {
      throw new McpError(ErrorCode.InvalidParams, `Document not found: ${doc_id}`);
    }
    return {
      content: [
        {
          type: "text",
          text: `# ${entry.title}\n\n**Source:** ${entry.url}\n**Repo:** ${entry.repo}\n**Last indexed:** ${entry.lastUpdated}\n\n---\n\n${entry.content}`,
        },
      ],
    };
  }

  if (name === "list_amrit_repos") {
    const repoMap = new Map<string, number>();
    for (const entry of index.entries) {
      if (entry.repo) {
        repoMap.set(entry.repo, (repoMap.get(entry.repo) ?? 0) + 1);
      }
    }
    const repos = [...repoMap.entries()].map(([repo, count]) => ({ repo, docCount: count }));
    return { content: [{ type: "text", text: JSON.stringify(repos, null, 2) }] };
  }

  if (name === "list_amrit_tags") {
    const tagSet = new Set<string>();
    for (const entry of index.entries) entry.tags.forEach((t) => tagSet.add(t));
    return { content: [{ type: "text", text: JSON.stringify([...tagSet].sort(), null, 2) }] };
  }

  if (name === "get_docs_by_tag") {
    const { tag } = z.object({ tag: z.string() }).parse(args);
    const results = getByTag(index.entries, tag);
    const text = results
      .map((e) => `- **${e.title}** (${e.repo}) — ${e.url}`)
      .join("\n");
    return { content: [{ type: "text", text: text || "No docs found for tag: " + tag }] };
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

// ─── Resources ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const index = loadIndex();
  if (!index) return { resources: [] };
  return {
    resources: index.entries.map((e) => ({
      uri: `amrit-docs://${e.id}`,
      name: e.title,
      description: `${e.repo} — ${e.path}`,
      mimeType: "text/markdown",
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const id = uri.replace("amrit-docs://", "");
  const index = loadIndex();
  const entry = index?.entries.find((e) => e.id === id);
  if (!entry) throw new McpError(ErrorCode.InvalidParams, `Resource not found: ${uri}`);
  return {
    contents: [{ uri, mimeType: "text/markdown", text: entry.content }],
  };
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AMRIT Docs MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
