# Contributing to AMRIT AI Framework

Welcome! This is a C4GT open-source project. Anyone can contribute new MCP servers,
skills, coding standards, or documentation.

---

## Ways to Contribute

| Area | Examples |
|---|---|
| MCP Servers | Slack connector, SonarQube, GitHub Actions, monitoring |
| Skills | New SDLC phases, domain-specific (clinical workflow, compliance) |
| Coding Standards | Module-specific patterns, new frameworks |
| Config | New AI tool integrations (Gemini, Windsurf, Zed) |
| Documentation | Tutorials, use-case guides, video walkthroughs |
| Bug fixes | Issues in existing servers or skills |

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Set up** the framework: follow [docs/setup-guide.md](docs/setup-guide.md)
4. **Create a branch**: `git checkout -b feat/my-contribution`
5. **Make changes** (see contribution guides below)
6. **Test** your changes
7. **Open a PR** — describe what you built and why

---

## Adding an MCP Server

### 1. Scaffold the server

```bash
mkdir mcp-servers/my-server
cd mcp-servers/my-server
```

Copy `package.json` and `tsconfig.json` from an existing server (e.g. `jira-server`).
Update `name` in `package.json`.

### 2. Implement `src/index.ts`

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "amrit-my-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "my_tool",
      description: "What this tool does and when to use it",
      inputSchema: {
        type: "object",
        properties: {
          param: { type: "string", description: "..." }
        },
        required: ["param"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "my_tool") {
    // implementation
    return { content: [{ type: "text", text: "result" }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 3. Add to workspace and config

- Add to root `package.json` workspaces (automatic if in `mcp-servers/`)
- Add entry to `config/mcp-config.json`
- Document in `docs/mcp-servers-guide.md`

### 4. Required quality bar
- [ ] Each tool has a descriptive `description` field (agents use this to decide when to call it)
- [ ] Input schema is complete with descriptions on every parameter
- [ ] Error handling: catch and return meaningful errors, don't crash the server process
- [ ] New env vars documented in `.env.example`
- [ ] README section in your server directory

---

## Adding a Skill

Skills are Markdown files in `skills/<sdlc-phase>/`.

### File format

```markdown
---
name: amrit-<skill-name>
description: >
  One paragraph: what this skill does, when to use it.
  Be specific — agents use this to decide whether to activate the skill.
triggers:
  - "phrase that invokes this skill"
  - "another trigger phrase"
---

# Skill: [Human-Readable Name]

## Purpose
[Why this skill exists — what problem it solves for AMRIT developers]

## When to Use
[Specific scenarios]

## Steps
[Numbered or structured instructions for the AI agent]

## Output Format
[What the agent should produce]

## Quality Checklist
- [ ] [What makes a good output for this skill]
```

### Required quality bar
- [ ] Triggers are specific enough to avoid accidental activation
- [ ] Steps reference specific AMRIT repos, classes, or patterns by name
- [ ] Output format defined — agent knows what to produce
- [ ] Added to the skills table in `README.md`

---

## Adding Coding Standards

Create `coding-standards/<name>.md`. Structure:

```markdown
# AMRIT <Language/Framework> Coding Standards

## Package / Project Structure
...

## Naming Conventions
...

## Key Patterns
[Code examples from actual AMRIT repos]

## What NOT to Do
[Anti-patterns found in the wild]

## Testing
...
```

Then reference the new file from:
- `config/claude-code/CLAUDE.md`
- `config/cursor/.cursorrules`
- `config/copilot/.github/copilot-instructions.md`

---

## PR Guidelines

### Branch naming
- `feat/<short-description>` — new feature / server / skill
- `fix/<short-description>` — bug fix
- `docs/<short-description>` — documentation only

### PR description template
```markdown
## What does this PR add/change?
[Brief description]

## SDLC phase(s) covered
[Requirements / Development / Review / Testing / DevOps / Support / Docs]

## How to test it
[Step-by-step instructions to verify the contribution works]

## Checklist
- [ ] Build passes (`npm run build`)
- [ ] New env vars added to `.env.example`
- [ ] `README.md` updated if new component added
- [ ] Coding standards file referenced from agent configs (if new standards added)
```

---

## Code Style

- TypeScript with `strict: true`
- No `any` in new code
- MCP server tools must have complete input schemas with descriptions
- Async/await over callbacks
- Error messages must be human-readable (agents surface them to users)

---

## Communication

- Open a GitHub Issue to discuss large contributions before starting
- Use JIRA label `amrit-ai-framework` for tickets related to this project
- Tag mentor @drtechie for architecture questions

---

## License

All contributions are licensed under MIT. By contributing, you agree your
work can be distributed under this license.
