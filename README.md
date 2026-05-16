# AMRIT AI Framework

An open-source, modular agentic AI framework that embeds AI assistance into every phase of AMRIT's Software Development Lifecycle.

## What Is This?

AMRIT (Accessible Medical Records via Integrated Technology) is an open-source EHR platform maintained by Piramal Swasthya with 10+ repositories spanning Angular frontends, Java/Spring Boot backends, and Kotlin/Android mobile apps.

This framework gives AI coding agents (Claude Code, Cursor, Copilot, Gemini) deep contextual knowledge of AMRIT's architecture, conventions, and documentation — so developers get meaningful, AMRIT-aware assistance without copy-pasting context into every session.

## Architecture Overview

```
amrit-ai-framework/
├── mcp-servers/              # MCP servers connecting agents to knowledge sources
│   ├── amrit-docs-server/    # Indexes + searches AMRIT documentation
│   ├── confluence-server/    # Reads/writes Confluence pages and BRDs
│   ├── jira-server/          # Manages JIRA tickets and sprint boards
│   └── code-context-server/  # Cross-repo GitHub search and API discovery
├── coding-standards/         # AMRIT conventions for Spring Boot, Angular, Kotlin
├── skills/                   # Reusable AI skills per SDLC phase
│   ├── requirements/         # Ticket generation, BRD analysis
│   ├── development/          # Code generation, implementation plans
│   ├── code-review/          # PR review against AMRIT standards
│   ├── testing/              # Test case generation
│   ├── devops/               # CI/CD and deployment assistance
│   ├── support/              # L2 bug triage
│   └── documentation/        # Release notes, onboarding
├── commands/                 # Developer workflow scripts
├── config/                   # AI agent configurations (Claude, Cursor, Copilot)
└── docs/                     # Architecture, setup, and contribution guides
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+
- Docker (optional, for containerized MCP servers)
- An AMRIT GitHub PAT (for code-context-server)
- Confluence + JIRA API tokens (for those integrations)

### 1. Clone and install

```bash
git clone https://github.com/PSMRI/amrit-ai-framework
cd amrit-ai-framework
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys and endpoints
```

### 3. Build all MCP servers

```bash
npm run build
```

### 4. Start the docs server (minimum viable setup)

```bash
npm run start:docs-server
```

### 5. Configure your AI agent

**Claude Code** — copy the CLAUDE.md to your AMRIT repo:
```bash
cp config/claude-code/CLAUDE.md /path/to/your/amrit-repo/
```

**Cursor** — copy the rules file:
```bash
cp config/cursor/.cursorrules /path/to/your/amrit-repo/
```

**GitHub Copilot** — copy the instructions:
```bash
cp config/copilot/.github/copilot-instructions.md /path/to/your/amrit-repo/.github/
```

**Add MCP servers to Claude Code** (`~/.claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "amrit-docs": {
      "command": "node",
      "args": ["/path/to/amrit-ai-framework/mcp-servers/amrit-docs-server/dist/index.js"],
      "env": { "AMRIT_DOCS_INDEX_PATH": "/path/to/index" }
    },
    "amrit-jira": {
      "command": "node",
      "args": ["/path/to/amrit-ai-framework/mcp-servers/jira-server/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://your-org.atlassian.net",
        "JIRA_EMAIL": "your@email.com",
        "JIRA_API_TOKEN": "your-token"
      }
    }
  }
}
```

## SDLC Coverage

| Phase | Skills Available | MCP Servers Used |
|---|---|---|
| Requirements | Generate JIRA tickets from BRDs | Confluence, JIRA |
| Sprint Planning | Estimate issues, groom backlog | JIRA, Code Context |
| Development | Implementation plans, code generation | Docs, Code Context |
| Code Review | PR review against AMRIT standards | Docs, Code Context |
| Testing | Test case generation, defect analysis | Docs, Code Context |
| DevOps | CI/CD assistance, deployment validation | Docs |
| L2 Support | Bug triage, root cause analysis | Docs, Code Context, JIRA |
| Security | Vulnerability flagging, compliance | Docs |
| Documentation | Release notes, contributor onboarding | Confluence, JIRA |

## Example Queries (once set up)

> "How does the 104 helpline call routing work?"

> "What API endpoint does beneficiary registration call?"

> "Generate a JIRA ticket for adding offline sync to the ASHA mobile app"

> "Review this PR against AMRIT's Spring Boot coding standards"

> "Write a JUnit test for the BeneficiaryService.registerBeneficiary method"

## Supported AI Agents

- Claude Code (primary — MCP native)
- Cursor (via `.cursorrules` and MCP)
- GitHub Copilot (via `copilot-instructions.md`)
- Gemini Code Assist (via project context files)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/contributing-guide.md](docs/contributing-guide.md).

Good first contributions:
- Add a new MCP server (Slack, SonarQube, GitHub Actions)
- Write a skill for a new SDLC phase
- Expand coding standards for a specific AMRIT module
- Add IDE-specific configuration

## License

MIT — see [LICENSE](LICENSE)

## Maintained by

PSMRI / C4GT open-source contributors. Mentor: @drtechie
