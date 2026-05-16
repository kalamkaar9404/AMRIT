#!/usr/bin/env bash
# AMRIT AI Framework — Developer Environment Setup
# Run this once to set up the full framework on a new machine.
# Usage: bash commands/setup-dev-env.sh

set -euo pipefail

FRAMEWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[amrit-setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

echo ""
echo "  AMRIT AI Framework — Environment Setup"
echo "  ======================================="
echo ""

# ── Check prerequisites ────────────────────────────────────────────────────────

log "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  error "Node.js not found. Install from https://nodejs.org (v20 LTS)"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  error "Node.js v20+ required (found $(node -v))"
fi
log "Node.js $(node -v) ✓"

if ! command -v npm &>/dev/null; then
  error "npm not found"
fi
log "npm $(npm -v) ✓"

# ── Install dependencies ───────────────────────────────────────────────────────

log "Installing dependencies..."
cd "$FRAMEWORK_DIR"
npm install
log "Dependencies installed ✓"

# ── Build MCP servers ──────────────────────────────────────────────────────────

log "Building MCP servers..."
npm run build
log "Build complete ✓"

# ── Environment configuration ─────────────────────────────────────────────────

if [ ! -f "$FRAMEWORK_DIR/.env" ]; then
  log "Creating .env from .env.example..."
  cp "$FRAMEWORK_DIR/.env.example" "$FRAMEWORK_DIR/.env"
  warn ".env created — edit it with your API keys before continuing"
  warn "Required: GITHUB_TOKEN (for indexing)"
  warn "Optional: JIRA_*, CONFLUENCE_* (for those MCP servers)"
else
  log ".env already exists ✓"
fi

# ── Index docs ─────────────────────────────────────────────────────────────────

log "Building AMRIT docs index..."
source "$FRAMEWORK_DIR/.env" 2>/dev/null || true

if [ -z "${GITHUB_TOKEN:-}" ]; then
  warn "GITHUB_TOKEN not set — indexing with anonymous API (60 req/hr limit)"
fi

npm run index:docs
log "Docs index built ✓"

# ── Claude Code configuration ──────────────────────────────────────────────────

CLAUDE_CONFIG_DIR="$HOME/.claude"
CLAUDE_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

log "Configuring Claude Code MCP servers..."
mkdir -p "$CLAUDE_CONFIG_DIR"

if [ ! -f "$CLAUDE_CONFIG" ]; then
  cat > "$CLAUDE_CONFIG" << EOF
{
  "mcpServers": {
    "amrit-docs": {
      "command": "node",
      "args": ["$FRAMEWORK_DIR/mcp-servers/amrit-docs-server/dist/index.js"],
      "env": {
        "AMRIT_DOCS_INDEX_PATH": "$FRAMEWORK_DIR/data/docs-index"
      }
    }
  }
}
EOF
  log "Claude Code MCP config created at $CLAUDE_CONFIG ✓"
  log "Add JIRA/Confluence/GitHub servers by editing the config file"
else
  warn "$CLAUDE_CONFIG already exists — add AMRIT servers manually"
  warn "See config/mcp-config.json for the server definitions"
fi

# ── Summary ────────────────────────────────────────────────────────────────────

echo ""
echo "  Setup complete!"
echo "  ==============="
echo ""
echo "  Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Restart Claude Code to pick up MCP servers"
echo "  3. Copy CLAUDE.md to your AMRIT repos:"
echo "     cp config/claude-code/CLAUDE.md /path/to/your/amrit-repo/"
echo ""
echo "  Test the setup in Claude Code:"
echo "     > search_amrit_docs('beneficiary registration')"
echo ""
echo "  Re-index docs weekly:"
echo "     npm run index:docs"
echo ""
