#!/usr/bin/env bash
# AMRIT AI Framework — Onboard a New Repository
# Copies AI agent config files to an AMRIT repo so AI tools work with AMRIT context.
# Usage: bash commands/onboard-repo.sh /path/to/amrit-repo

set -euo pipefail

FRAMEWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_REPO="${1:-}"

if [ -z "$TARGET_REPO" ]; then
  echo "Usage: bash commands/onboard-repo.sh /path/to/amrit-repo"
  exit 1
fi

if [ ! -d "$TARGET_REPO" ]; then
  echo "Error: directory not found: $TARGET_REPO"
  exit 1
fi

echo "Onboarding: $TARGET_REPO"

# ── Claude Code ────────────────────────────────────────────────────────────────
cp "$FRAMEWORK_DIR/config/claude-code/CLAUDE.md" "$TARGET_REPO/CLAUDE.md"
echo "✓ CLAUDE.md → $TARGET_REPO/CLAUDE.md"

# ── Cursor ─────────────────────────────────────────────────────────────────────
cp "$FRAMEWORK_DIR/config/cursor/.cursorrules" "$TARGET_REPO/.cursorrules"
echo "✓ .cursorrules → $TARGET_REPO/.cursorrules"

# ── GitHub Copilot ─────────────────────────────────────────────────────────────
mkdir -p "$TARGET_REPO/.github"
cp "$FRAMEWORK_DIR/config/copilot/.github/copilot-instructions.md" \
   "$TARGET_REPO/.github/copilot-instructions.md"
echo "✓ copilot-instructions.md → $TARGET_REPO/.github/copilot-instructions.md"

echo ""
echo "Repository onboarded! The following AI tools now have AMRIT context:"
echo "  - Claude Code (reads CLAUDE.md automatically)"
echo "  - Cursor (reads .cursorrules automatically)"
echo "  - GitHub Copilot (reads .github/copilot-instructions.md automatically)"
echo ""
echo "Commit these files to share the setup with your team:"
echo "  cd $TARGET_REPO"
echo "  git add CLAUDE.md .cursorrules .github/copilot-instructions.md"
echo "  git commit -m 'chore: add AMRIT AI framework context files'"
