# AMRIT AI Framework — Setup Guide

Complete installation guide for developers, QA, and contributors.

---

## Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| Node.js | 20 LTS | https://nodejs.org |
| npm | 9+ | Bundled with Node.js |
| Git | 2.x | https://git-scm.com |
| Docker | 24+ | https://docker.com (optional) |
| Claude Code | Latest | `npm i -g @anthropic-ai/claude-code` |

---

## Step 1: Clone the framework

```bash
git clone https://github.com/PSMRI/amrit-ai-framework
cd amrit-ai-framework
```

---

## Step 2: Install dependencies

```bash
npm install
```

This installs workspace dependencies for all 4 MCP servers.

---

## Step 3: Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in the values you have access to:

### Minimum viable setup (docs server only)
```env
# No external APIs needed for docs search
AMRIT_DOCS_REPOS=PSMRI/AMRIT,PSMRI/HWC-API,PSMRI/Helpline104-API
AMRIT_DOCS_INDEX_PATH=./data/docs-index
# Optional but recommended (increases GitHub rate limit from 60 to 5000 req/hr):
GITHUB_TOKEN=ghp_your_personal_access_token
```

### Full setup (all servers)
See `.env.example` for all variables. You'll need:
- **GitHub PAT** with `read:repo` scope → Settings → Developer settings → Personal access tokens
- **JIRA API token** → https://id.atlassian.com/manage-profile/security/api-tokens
- **Confluence API token** → Same as JIRA (shared Atlassian account)

---

## Step 4: Build the MCP servers

```bash
npm run build
```

Compiles all TypeScript to `dist/` in each server directory.

To build a single server:
```bash
npm run build:docs        # amrit-docs-server
npm run build:jira        # jira-server
npm run build:confluence  # confluence-server
npm run build:code-context # code-context-server
```

---

## Step 5: Index AMRIT documentation

```bash
npm run index:docs
```

This fetches docs from GitHub and builds the search index at `./data/docs-index/index.json`.
Takes ~2–5 minutes on first run. Run again weekly to refresh.

Expected output:
```
AMRIT Docs Indexer
==================
Indexing 6 repos: PSMRI/AMRIT, PSMRI/HWC-API, ...
  Indexing PSMRI/AMRIT...
    Found 12 documents
  Indexing PSMRI/HWC-API...
    Found 8 documents
  ...
Index built: 47 documents
Saved to: ./data/docs-index/index.json
```

---

## Step 6: Configure Claude Code

### Add MCP servers to Claude Code

Edit `~/.claude/claude_desktop_config.json` (create if it doesn't exist):

```json
{
  "mcpServers": {
    "amrit-docs": {
      "command": "node",
      "args": ["/absolute/path/to/amrit-ai-framework/mcp-servers/amrit-docs-server/dist/index.js"],
      "env": {
        "AMRIT_DOCS_INDEX_PATH": "/absolute/path/to/amrit-ai-framework/data/docs-index"
      }
    },
    "amrit-jira": {
      "command": "node",
      "args": ["/absolute/path/to/amrit-ai-framework/mcp-servers/jira-server/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://your-org.atlassian.net",
        "JIRA_EMAIL": "your@email.com",
        "JIRA_API_TOKEN": "your_token"
      }
    },
    "amrit-confluence": {
      "command": "node",
      "args": ["/absolute/path/to/amrit-ai-framework/mcp-servers/confluence-server/dist/index.js"],
      "env": {
        "CONFLUENCE_BASE_URL": "https://your-org.atlassian.net/wiki",
        "CONFLUENCE_EMAIL": "your@email.com",
        "CONFLUENCE_API_TOKEN": "your_token"
      }
    },
    "amrit-code-context": {
      "command": "node",
      "args": ["/absolute/path/to/amrit-ai-framework/mcp-servers/code-context-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token",
        "GITHUB_ORG": "PSMRI"
      }
    }
  }
}
```

Replace `/absolute/path/to/amrit-ai-framework` with the actual path on your machine.

### Copy CLAUDE.md to your AMRIT repo

```bash
cp config/claude-code/CLAUDE.md /path/to/your/amrit-repo/CLAUDE.md
```

Do this for every AMRIT repo you work in. Claude Code reads `CLAUDE.md` automatically.

---

## Step 7: Configure Cursor (alternative)

Copy the rules file to your AMRIT repo:
```bash
cp config/cursor/.cursorrules /path/to/your/amrit-repo/.cursorrules
```

For MCP support in Cursor, add servers via **Settings → MCP** using the same
JSON format from `config/mcp-config.json`.

---

## Step 8: Configure GitHub Copilot (alternative)

```bash
cp config/copilot/.github/copilot-instructions.md /path/to/your/amrit-repo/.github/copilot-instructions.md
```

Copilot reads this file automatically for context.

---

## Verify the Setup

Open Claude Code in any AMRIT repo:

```
> search_amrit_docs("how does beneficiary registration work")
```

You should get matching documentation. If you see "index not found", run `npm run index:docs`.

Try:
```
> What API does the HWC beneficiary registration call?
```

Claude should use the MCP tools to search and answer.

---

## Using Docker (optional)

Run all MCP servers as Docker services:

```bash
docker-compose up -d
```

Servers will run as HTTP servers that any MCP-compatible client can connect to.
See `docker-compose.yml` for port mappings.

---

## Keeping the Index Fresh

Run the indexer on a schedule to keep docs current:

**Linux/Mac cron** (weekly on Sundays):
```cron
0 2 * * 0 cd /path/to/amrit-ai-framework && npm run index:docs >> logs/indexer.log 2>&1
```

**Windows Task Scheduler:** Schedule `npm run index:docs` weekly.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `Cannot find module dist/index.js` | Run `npm run build` first |
| `Index not found` | Run `npm run index:docs` |
| `GitHub API 403` | Set `GITHUB_TOKEN` in `.env` or the MCP server env |
| `JIRA API 401` | Verify `JIRA_EMAIL` + `JIRA_API_TOKEN` are correct |
| MCP server not showing in Claude | Restart Claude Code after editing config |
| Rate limit on indexing | Set `GITHUB_TOKEN` (increases limit from 60 to 5000 req/hr) |

---

## Next Steps

- Read [docs/skills-guide.md](skills-guide.md) to learn available skills
- Read [CONTRIBUTING.md](../CONTRIBUTING.md) to add new components
- Check [docs/sdlc-phases.md](sdlc-phases.md) for SDLC use cases
