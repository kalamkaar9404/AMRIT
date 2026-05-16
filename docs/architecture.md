# AMRIT AI Framework — Architecture

## Overview

The framework is built around three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Agents                                │
│   Claude Code    Cursor    GitHub Copilot    Gemini Code Assist  │
└────────┬──────────────┬────────────────┬───────────────────────┘
         │              │                │
         ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Agent Configuration Layer                      │
│  CLAUDE.md   .cursorrules   copilot-instructions.md             │
│  (injects AMRIT context into every session)                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ MCP Protocol
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Server Layer                            │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  amrit-docs      │  │  amrit-jira      │                    │
│  │  (doc search)    │  │  (ticket mgmt)   │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  amrit-confluence│  │  code-context    │                    │
│  │  (BRDs, notes)   │  │  (GitHub search) │                    │
│  └──────────────────┘  └──────────────────┘                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
         ┌────────────────┼──────────────────┐
         ▼                ▼                  ▼
┌─────────────┐  ┌────────────────┐  ┌─────────────┐
│  AMRIT Docs │  │ Confluence/JIRA│  │  GitHub API │
│  (JSON idx) │  │  (Atlassian)   │  │  (PSMRI org)│
└─────────────┘  └────────────────┘  └─────────────┘
```

## Design Principles

### 1. Modular — add servers without changing core
Each MCP server is an independent Node.js process. Adding a new knowledge source
(Slack, SonarQube, GitHub Actions) means writing a new server — nothing else changes.

### 2. Stdio transport — works everywhere MCP is supported
All servers use MCP's stdio transport. They work in Claude Code, Cursor, any
MCP-compatible client. No HTTP server to host.

### 3. Offline-capable docs server
The `amrit-docs-server` builds a local JSON index from GitHub. Once indexed,
it works without internet. Perfect for environments with restricted egress.

### 4. Standards distributed as plain files
Coding standards are Markdown files in `coding-standards/`. Any tool that can
read files (Claude Code via CLAUDE.md, Cursor via .cursorrules, Copilot via
copilot-instructions.md) can consume them.

### 5. Skills as structured prompts, not code
Skills are Markdown documents that define how an agent should approach a task.
They are tool-agnostic: the same skill works in Claude Code, Cursor, or Copilot
because they describe workflows, not implementations.

## MCP Server Details

### amrit-docs-server

**Purpose:** Offline-capable full-text search over AMRIT documentation.

**How it works:**
1. `indexer.ts` fetches README, docs/, wiki/ from configured AMRIT repos via GitHub API
2. Builds a JSON index (`index.json`) with title, content, tags, URL for each doc
3. `search.ts` implements TF-IDF-inspired keyword search over the index
4. `index.ts` (the MCP server) exposes search as `search_amrit_docs` tool

**When to re-index:** Run `npm run index:docs` after significant doc changes or weekly.

**Tools exposed:**
- `search_amrit_docs` — plain-English search
- `get_doc` — full content of a specific doc
- `list_amrit_repos` — all indexed repos
- `list_amrit_tags` — all tags (topic classification)
- `get_docs_by_tag` — filter by tag
- `get_index_status` — index health check

### amrit-jira-server

**Purpose:** JIRA integration for AMRIT project management.

**Auth:** JIRA Cloud Basic Auth (email + API token).

**Tools exposed:**
- `search_jira_issues` — JQL or plain-English issue search
- `get_jira_issue` — full issue detail
- `create_jira_ticket` — create Story/Bug/Task
- `list_jira_projects` — available projects
- `get_active_sprint` — current sprint for a board
- `generate_ticket_from_brd` — structured ticket draft from BRD text

### amrit-confluence-server

**Purpose:** Read/write AMRIT Confluence documentation.

**Auth:** Confluence Cloud Basic Auth (email + API token).

**Tools exposed:**
- `search_confluence` — full-text search with CQL
- `get_confluence_page` — full page content
- `list_confluence_spaces` — available spaces
- `list_space_pages` — pages in a space
- `create_confluence_page` — create new page

### amrit-code-context-server

**Purpose:** Cross-repo code search and API endpoint discovery.

**Auth:** GitHub Personal Access Token (read:repo).

**Tools exposed:**
- `search_amrit_code` — GitHub code search across PSMRI org
- `get_amrit_file` — fetch a specific file
- `list_amrit_repos` — all PSMRI repos
- `find_api_endpoints` — Spring Boot endpoint discovery
- `get_repo_structure` — file tree
- `explain_repo_relationships` — frontend ↔ backend mapping

## Skills Architecture

Skills are stored as Markdown files with frontmatter metadata:

```
skills/
├── requirements/    # SDLC phase: requirements
├── development/     # SDLC phase: development
├── code-review/     # SDLC phase: review
├── testing/         # SDLC phase: QA
├── devops/          # SDLC phase: deployment
├── support/         # SDLC phase: L2 support
└── documentation/   # SDLC phase: docs
```

Each skill has:
- `name` — unique ID
- `description` — what the skill does (used for triggering)
- `triggers` — natural language phrases that invoke the skill
- Body — structured instructions for the AI agent

## Extensibility

To add a new MCP server:
1. `mkdir mcp-servers/my-server && cd mcp-servers/my-server`
2. Copy `package.json` and `tsconfig.json` from an existing server
3. Implement `src/index.ts` using `@modelcontextprotocol/sdk`
4. Add to `config/mcp-config.json`
5. Document in `docs/mcp-servers-guide.md`

To add a new skill:
1. Create `skills/<sdlc-phase>/<skill-name>.md`
2. Follow the frontmatter schema (name, description, triggers)
3. Document in `docs/skills-guide.md`

To add a coding standard:
1. Add `coding-standards/<language-or-framework>.md`
2. Reference it from `config/claude-code/CLAUDE.md` and `config/cursor/.cursorrules`
