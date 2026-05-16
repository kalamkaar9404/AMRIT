#!/usr/bin/env node
/**
 * AMRIT JIRA MCP Server
 *
 * Connects AI agents to JIRA for the AMRIT project.
 *
 * Tools:
 *   - search_jira_issues       Search issues using JQL or plain text
 *   - get_jira_issue           Get full details of a specific issue
 *   - create_jira_ticket       Create a new ticket (Story/Bug/Task)
 *   - list_jira_projects       List all AMRIT-related JIRA projects
 *   - get_active_sprint        Get the current active sprint for a board
 *   - generate_ticket_from_brd Parse a BRD/feature description into a structured ticket
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
import { JiraClient } from "./jira-client.js";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL ?? "";
const JIRA_EMAIL = process.env.JIRA_EMAIL ?? "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN ?? "";

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("Missing required env vars: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN");
  process.exit(1);
}

const jira = new JiraClient(JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN);

const server = new Server(
  { name: "amrit-jira-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_jira_issues",
      description:
        "Search AMRIT JIRA issues. Accepts either a JQL query or plain English. " +
        "Examples: 'open bugs in AMRIT project', 'unassigned stories in current sprint', 'issues related to beneficiary registration'",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "JQL query or plain English search" },
          project_key: { type: "string", description: "Optional JIRA project key to filter by (e.g. AMRIT)" },
          max_results: { type: "number", description: "Maximum results (default 10)" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_jira_issue",
      description: "Get full details of a specific JIRA issue including description, comments, and status",
      inputSchema: {
        type: "object",
        properties: {
          issue_key: { type: "string", description: "JIRA issue key (e.g. AMRIT-123)" },
        },
        required: ["issue_key"],
      },
    },
    {
      name: "create_jira_ticket",
      description: "Create a new JIRA ticket for an AMRIT project. Use after generating ticket content with generate_ticket_from_brd.",
      inputSchema: {
        type: "object",
        properties: {
          project_key: { type: "string", description: "JIRA project key (e.g. AMRIT)" },
          summary: { type: "string", description: "One-line ticket summary" },
          description: { type: "string", description: "Detailed description including acceptance criteria" },
          issuetype: {
            type: "string",
            enum: ["Story", "Bug", "Task", "Epic"],
            description: "Issue type",
          },
          priority: {
            type: "string",
            enum: ["Highest", "High", "Medium", "Low", "Lowest"],
          },
          labels: { type: "array", items: { type: "string" }, description: "Labels (e.g. ['backend', 'spring-boot'])" },
          story_points: { type: "number", description: "Story point estimate" },
        },
        required: ["project_key", "summary", "description", "issuetype"],
      },
    },
    {
      name: "list_jira_projects",
      description: "List all JIRA projects accessible in the configured AMRIT workspace",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_active_sprint",
      description: "Get the currently active sprint for a JIRA board",
      inputSchema: {
        type: "object",
        properties: {
          board_id: { type: "number", description: "JIRA board ID" },
        },
        required: ["board_id"],
      },
    },
    {
      name: "generate_ticket_from_brd",
      description:
        "Given a raw BRD excerpt or feature description, generate a structured JIRA ticket draft " +
        "(summary, user story, acceptance criteria, technical notes, labels). " +
        "Returns the draft — you can then call create_jira_ticket to actually create it.",
      inputSchema: {
        type: "object",
        properties: {
          feature_description: {
            type: "string",
            description: "Raw feature description, BRD excerpt, or Confluence page content",
          },
          project_key: { type: "string", description: "Target JIRA project key" },
          issuetype: {
            type: "string",
            enum: ["Story", "Task", "Epic"],
            description: "Issue type (default: Story)",
          },
        },
        required: ["feature_description", "project_key"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search_jira_issues") {
      const parsed = z
        .object({ query: z.string(), project_key: z.string().optional(), max_results: z.number().optional() })
        .parse(args);

      // Convert plain English to JQL if needed (heuristic: no operators present)
      let jql = parsed.query;
      if (!jql.includes("=") && !jql.includes("ORDER BY") && !jql.toUpperCase().includes(" AND ")) {
        const textJql = `text ~ "${jql.replace(/"/g, '\\"')}"`;
        jql = parsed.project_key ? `project = ${parsed.project_key} AND ${textJql}` : textJql;
        jql += " ORDER BY updated DESC";
      }

      const issues = await jira.searchIssues(jql, parsed.max_results ?? 10);
      if (!issues.length) return { content: [{ type: "text", text: "No issues found." }] };

      const text = issues
        .map(
          (i) =>
            `**${i.key}** [${i.issuetype}] ${i.summary}\n` +
            `  Status: ${i.status} | Priority: ${i.priority} | Assignee: ${i.assignee ?? "Unassigned"}\n` +
            `  URL: ${i.url}`
        )
        .join("\n\n");

      return { content: [{ type: "text", text }] };
    }

    if (name === "get_jira_issue") {
      const { issue_key } = z.object({ issue_key: z.string() }).parse(args);
      const issue = await jira.getIssue(issue_key);
      return {
        content: [
          {
            type: "text",
            text:
              `# ${issue.key}: ${issue.summary}\n\n` +
              `**Type:** ${issue.issuetype} | **Status:** ${issue.status} | **Priority:** ${issue.priority}\n` +
              `**Assignee:** ${issue.assignee ?? "Unassigned"} | **Reporter:** ${issue.reporter}\n` +
              `**Story Points:** ${issue.storyPoints ?? "Not set"}\n` +
              `**Labels:** ${issue.labels.join(", ") || "None"}\n` +
              `**URL:** ${issue.url}\n\n` +
              `## Description\n\n${issue.description ?? "No description"}`,
          },
        ],
      };
    }

    if (name === "create_jira_ticket") {
      const parsed = z
        .object({
          project_key: z.string(),
          summary: z.string(),
          description: z.string(),
          issuetype: z.enum(["Story", "Bug", "Task", "Epic"]),
          priority: z.enum(["Highest", "High", "Medium", "Low", "Lowest"]).optional(),
          labels: z.array(z.string()).optional(),
          story_points: z.number().optional(),
        })
        .parse(args);

      const result = await jira.createIssue({
        projectKey: parsed.project_key,
        summary: parsed.summary,
        description: parsed.description,
        issuetype: parsed.issuetype,
        priority: parsed.priority,
        labels: parsed.labels,
        storyPoints: parsed.story_points,
      });

      return {
        content: [
          {
            type: "text",
            text: `Ticket created successfully!\n**Key:** ${result.key}\n**URL:** ${result.url}`,
          },
        ],
      };
    }

    if (name === "list_jira_projects") {
      const projects = await jira.getProjects();
      const text = projects.map((p) => `- **${p.key}** — ${p.name} (${p.projectTypeKey})`).join("\n");
      return { content: [{ type: "text", text }] };
    }

    if (name === "get_active_sprint") {
      const { board_id } = z.object({ board_id: z.number() }).parse(args);
      const sprint = await jira.getActiveSprint(board_id);
      if (!sprint) return { content: [{ type: "text", text: "No active sprint found for this board." }] };
      return {
        content: [
          {
            type: "text",
            text: `**Active Sprint:** ${sprint.name}\n**State:** ${sprint.state}\n**Start:** ${sprint.startDate ?? "N/A"}\n**End:** ${sprint.endDate ?? "N/A"}`,
          },
        ],
      };
    }

    if (name === "generate_ticket_from_brd") {
      const parsed = z
        .object({
          feature_description: z.string(),
          project_key: z.string(),
          issuetype: z.enum(["Story", "Task", "Epic"]).optional(),
        })
        .parse(args);

      // Template-based ticket generation (AI agents using this tool should have LLM context)
      const draft = generateTicketDraft(parsed.feature_description, parsed.project_key, parsed.issuetype ?? "Story");
      return { content: [{ type: "text", text: draft }] };
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  } catch (err) {
    if (err instanceof McpError) throw err;
    throw new McpError(ErrorCode.InternalError, String(err));
  }
});

function generateTicketDraft(description: string, projectKey: string, issuetype: string): string {
  // Extract key phrases for structured ticket template
  const lines = description.trim().split("\n").filter(Boolean);
  const firstLine = lines[0] ?? "New feature";

  return `# Generated JIRA Ticket Draft

## Summary
${firstLine.slice(0, 100)}

## Issue Type
${issuetype}

## Project
${projectKey}

## User Story
As a [role], I want to [action] so that [benefit].

> Fill in based on this description:
> ${description.slice(0, 500)}

## Acceptance Criteria
- [ ] Given [precondition], when [action], then [outcome]
- [ ] [Add more AC based on the description above]

## Technical Notes
- Identify the relevant AMRIT backend service (HWC-API / TM-API / Helpline104-API)
- Identify the Angular frontend module affected
- List any API changes, DB schema changes, or integration points

## Labels
[Suggest: backend, frontend, api, beneficiary, hwc, mmu, helpline-104, android]

## Story Points
[Estimate: 1 / 2 / 3 / 5 / 8 / 13]

---
*Review this draft before calling create_jira_ticket*`;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AMRIT JIRA MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
