#!/usr/bin/env node
/**
 * AMRIT Code Context MCP Server
 *
 * Gives AI agents access to AMRIT's codebase across all repos.
 *
 * Tools:
 *   - search_amrit_code      Search code across AMRIT GitHub repos
 *   - get_file               Get a specific file from any AMRIT repo
 *   - list_amrit_repos       List all AMRIT GitHub repositories
 *   - find_api_endpoints     Discover Spring Boot API endpoints in a repo
 *   - get_repo_structure     Get the file tree of an AMRIT repo
 *   - explain_cross_repo     Explain how frontend/backend repos connect via APIs
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
import { GitHubClient } from "./github-client.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_ORG = process.env.GITHUB_ORG ?? "PSMRI";

const github = new GitHubClient(GITHUB_TOKEN, GITHUB_ORG);

// AMRIT repo map: frontend → backend relationships
const REPO_RELATIONSHIPS: Record<string, { backends: string[]; description: string }> = {
  "HWC-UI": {
    backends: ["HWC-API"],
    description: "Health and Wellness Centre frontend (Angular) ↔ HWC-API (Spring Boot)",
  },
  "Helpline104-UI": {
    backends: ["Helpline104-API"],
    description: "104 Helpline call centre frontend ↔ Helpline104-API",
  },
  "TM-UI": {
    backends: ["TM-API"],
    description: "Telemedicine frontend ↔ TM-API",
  },
  "MMU-UI": {
    backends: ["MMU-API"],
    description: "Mobile Medical Unit frontend ↔ MMU-API",
  },
  "AMRIT-Mobile": {
    backends: ["HWC-API", "MMU-API"],
    description: "Kotlin/Android ASHA mobile app ↔ HWC-API and MMU-API",
  },
};

const server = new Server(
  { name: "amrit-code-context-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_amrit_code",
      description:
        "Search code across all AMRIT GitHub repositories. Find implementations, classes, methods, or configs. " +
        "Examples: 'BeneficiaryService', 'call routing algorithm', 'BeneficiaryRegistrationController', '@GetMapping beneficiary'",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Code search query" },
          repos: {
            type: "array",
            items: { type: "string" },
            description: "Optional: limit search to specific repos (e.g. ['HWC-API', 'TM-API'])",
          },
          language: {
            type: "string",
            description: "Optional: filter by language (java, typescript, kotlin)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_amrit_file",
      description: "Get the full content of a specific file from an AMRIT repository",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Repository name (e.g. 'HWC-API' or 'PSMRI/HWC-API')" },
          file_path: { type: "string", description: "File path within the repo (e.g. 'src/main/java/com/psmri/hwc/service/BeneficiaryService.java')" },
          branch: { type: "string", description: "Branch name (default: main)" },
        },
        required: ["repo", "file_path"],
      },
    },
    {
      name: "list_amrit_repos",
      description: "List all PSMRI/AMRIT GitHub repositories with their tech stack and purpose",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "find_api_endpoints",
      description: "Discover REST API endpoints defined in a Spring Boot AMRIT repository",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Repository name (e.g. 'HWC-API')" },
        },
        required: ["repo"],
      },
    },
    {
      name: "get_repo_structure",
      description: "Get the file/directory structure of an AMRIT repository",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Repository name" },
          branch: { type: "string", description: "Branch (default: main)" },
        },
        required: ["repo"],
      },
    },
    {
      name: "explain_repo_relationships",
      description:
        "Explain how AMRIT's frontend, backend, and mobile repos connect to each other. " +
        "Useful for understanding which API a UI calls, or which repos are involved in a feature.",
      inputSchema: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description: "Optional: get relationships for a specific repo (e.g. 'HWC-UI'). Omit for full map.",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search_amrit_code") {
      const parsed = z
        .object({ query: z.string(), repos: z.array(z.string()).optional(), language: z.string().optional() })
        .parse(args);

      let query = parsed.query;
      if (parsed.language) query += ` language:${parsed.language}`;

      const results = await github.searchCode(query, parsed.repos);
      if (!results.length) return { content: [{ type: "text", text: "No code found." }] };

      const text = results
        .map(
          (r) =>
            `**${r.repo}** — \`${r.path}\`\n` +
            `URL: ${r.htmlUrl}\n` +
            (r.excerpt ? `\`\`\`\n${r.excerpt}\n\`\`\`` : "")
        )
        .join("\n\n---\n\n");

      return { content: [{ type: "text", text }] };
    }

    if (name === "get_amrit_file") {
      const parsed = z.object({ repo: z.string(), file_path: z.string(), branch: z.string().optional() }).parse(args);
      const file = await github.getFile(parsed.repo, parsed.file_path, parsed.branch ?? "main");
      return {
        content: [
          {
            type: "text",
            text: `# ${file.path}\n**Repo:** ${file.repo}\n**URL:** ${file.htmlUrl}\n\n\`\`\`\n${file.content}\n\`\`\``,
          },
        ],
      };
    }

    if (name === "list_amrit_repos") {
      const repos = await github.listOrgRepos();
      const text = repos
        .map(
          (r) =>
            `**${r.name}** (${r.language ?? "unknown"})\n` +
            `${r.description ?? "No description"}\n` +
            `Topics: ${r.topics.join(", ") || "none"} | Stars: ${r.stars}\n` +
            `URL: ${r.url}`
        )
        .join("\n\n");
      return { content: [{ type: "text", text }] };
    }

    if (name === "find_api_endpoints") {
      const { repo } = z.object({ repo: z.string() }).parse(args);
      const endpoints = await github.findApiEndpoints(repo);
      if (!endpoints.length) {
        return { content: [{ type: "text", text: "No API endpoints found (or repo doesn't use Spring Boot mapping annotations)." }] };
      }
      const text = endpoints
        .map((e) => `**${e.method}** \`${e.path}\` — ${e.controller}\n  ${e.htmlUrl}`)
        .join("\n\n");
      return { content: [{ type: "text", text }] };
    }

    if (name === "get_repo_structure") {
      const parsed = z.object({ repo: z.string(), branch: z.string().optional() }).parse(args);
      const tree = await github.getRepoTree(parsed.repo, parsed.branch ?? "main");
      const dirs = tree.filter((f) => f.type === "tree").map((f) => `📁 ${f.path}`);
      const files = tree
        .filter((f) => f.type === "blob")
        .slice(0, 100)
        .map((f) => `  ${f.path}`);
      return {
        content: [{ type: "text", text: [...dirs, ...files].join("\n") }],
      };
    }

    if (name === "explain_repo_relationships") {
      const parsed = z.object({ repo: z.string().optional() }).parse(args ?? {});

      if (parsed.repo) {
        const rel = REPO_RELATIONSHIPS[parsed.repo];
        if (!rel) {
          return { content: [{ type: "text", text: `No relationship data for repo: ${parsed.repo}` }] };
        }
        return {
          content: [
            {
              type: "text",
              text: `## ${parsed.repo} Relationships\n\n${rel.description}\n\n**Connected backends:** ${rel.backends.join(", ")}`,
            },
          ],
        };
      }

      const text = Object.entries(REPO_RELATIONSHIPS)
        .map(([repo, rel]) => `**${repo}** → ${rel.backends.join(", ")}\n${rel.description}`)
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `# AMRIT Repository Relationships\n\n${text}\n\n## Shared Services\nAll backends connect to a shared **AMRIT** core repo for common utilities (auth, logging, common models).`,
          },
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
  console.error("AMRIT Code Context MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
