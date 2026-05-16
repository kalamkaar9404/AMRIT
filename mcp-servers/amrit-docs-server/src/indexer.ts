#!/usr/bin/env node
/**
 * Indexer: fetches AMRIT docs from GitHub and builds a searchable JSON index.
 * Run: node dist/indexer.js
 *
 * Indexed sources:
 *   - README files from all configured AMRIT repos
 *   - Wiki pages (if available)
 *   - API docs (OpenAPI specs converted to text)
 *   - Architecture docs in /docs directories
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import type { DocEntry, DocsIndex, GitHubFile, GitHubContent } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_ORG = process.env.GITHUB_ORG ?? "PSMRI";
const INDEX_PATH = process.env.AMRIT_DOCS_INDEX_PATH ?? path.join(__dirname, "../../data/docs-index");

const REPOS_TO_INDEX = (
  process.env.AMRIT_DOCS_REPOS ??
  "PSMRI/AMRIT,PSMRI/HWC-API,PSMRI/Helpline104-API,PSMRI/TM-API,PSMRI/MMU-API,PSMRI/AMRIT-Mobile"
)
  .split(",")
  .map((r) => r.trim());

const INDEXABLE_EXTENSIONS = [".md", ".txt", ".yaml", ".yml"];
const INDEXABLE_FILES = ["README.md", "CONTRIBUTING.md", "ARCHITECTURE.md", "API.md"];
const INDEXABLE_DIRS = ["docs", "wiki", "api-docs", ".github"];

const headers: Record<string, string> = {
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "amrit-ai-framework-indexer",
};
if (GITHUB_TOKEN) headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;

async function githubGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status} for ${url}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function extractText(raw: string, filePath: string): string {
  // Strip YAML front-matter
  const stripped = raw.replace(/^---[\s\S]*?---\n/, "");
  // Strip HTML tags for markdown
  return stripped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function inferTags(filePath: string, content: string, repo: string): string[] {
  const tags: string[] = [repo.split("/")[1]];
  if (filePath.includes("api")) tags.push("api");
  if (filePath.includes("architecture")) tags.push("architecture");
  if (filePath.includes("setup") || filePath.includes("install")) tags.push("setup");
  if (content.toLowerCase().includes("spring boot")) tags.push("spring-boot");
  if (content.toLowerCase().includes("angular")) tags.push("angular");
  if (content.toLowerCase().includes("kotlin")) tags.push("kotlin");
  if (content.toLowerCase().includes("beneficiary")) tags.push("beneficiary");
  if (content.toLowerCase().includes("104")) tags.push("helpline-104");
  if (content.toLowerCase().includes("hwc") || content.toLowerCase().includes("health wellness")) tags.push("hwc");
  if (content.toLowerCase().includes("mmu") || content.toLowerCase().includes("mobile medical")) tags.push("mmu");
  return [...new Set(tags)];
}

async function decodeContent(apiResponse: GitHubContent): Promise<string> {
  const raw = Buffer.from(apiResponse.content, "base64").toString("utf-8");
  return raw;
}

async function indexFile(
  repo: string,
  filePath: string,
  downloadUrl: string,
  htmlUrl: string
): Promise<DocEntry | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (!INDEXABLE_EXTENSIONS.includes(ext)) return null;

  try {
    const res = await fetch(downloadUrl, { headers });
    if (!res.ok) return null;
    const raw = await res.text();
    const content = extractText(raw, filePath);
    if (content.length < 50) return null;

    const titleMatch = raw.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, ext);

    return {
      id: `${repo}/${filePath}`,
      title,
      content,
      url: htmlUrl,
      repo,
      path: filePath,
      lastUpdated: new Date().toISOString(),
      tags: inferTags(filePath, content, repo),
    };
  } catch {
    return null;
  }
}

async function indexDirectory(repo: string, dir: string): Promise<DocEntry[]> {
  const [owner, repoName] = repo.split("/");
  const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${dir}`;
  let files: GitHubFile[];
  try {
    files = await githubGet<GitHubFile[]>(url);
  } catch {
    return [];
  }

  const entries: DocEntry[] = [];
  for (const file of files) {
    if (file.type === "file" && file.download_url) {
      const entry = await indexFile(repo, file.path, file.download_url, file.html_url);
      if (entry) entries.push(entry);
    } else if (file.type === "dir" && INDEXABLE_DIRS.includes(file.name)) {
      const sub = await indexDirectory(repo, file.path);
      entries.push(...sub);
    }
  }
  return entries;
}

async function indexRepo(repo: string): Promise<DocEntry[]> {
  console.log(`  Indexing ${repo}...`);
  const [owner, repoName] = repo.split("/");
  const entries: DocEntry[] = [];

  // Index root-level important files
  for (const fileName of INDEXABLE_FILES) {
    const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${fileName}`;
    try {
      const file = await githubGet<GitHubContent>(url);
      const raw = await decodeContent(file);
      const content = extractText(raw, fileName);
      if (content.length >= 50) {
        const titleMatch = raw.match(/^#\s+(.+)/m);
        entries.push({
          id: `${repo}/${fileName}`,
          title: titleMatch ? titleMatch[1].trim() : fileName,
          content,
          url: file.html_url,
          repo,
          path: fileName,
          lastUpdated: new Date().toISOString(),
          tags: inferTags(fileName, content, repo),
        });
      }
    } catch {
      // File doesn't exist in this repo, skip
    }
  }

  // Index docs directories
  for (const dir of INDEXABLE_DIRS) {
    const dirEntries = await indexDirectory(repo, dir);
    entries.push(...dirEntries);
  }

  console.log(`    Found ${entries.length} documents`);
  return entries;
}

async function buildIndex(): Promise<void> {
  console.log("AMRIT Docs Indexer");
  console.log("==================");
  console.log(`Indexing ${REPOS_TO_INDEX.length} repos: ${REPOS_TO_INDEX.join(", ")}`);

  if (!GITHUB_TOKEN) {
    console.warn("Warning: GITHUB_TOKEN not set. Rate limits will apply (60 req/hr).");
  }

  const allEntries: DocEntry[] = [];

  for (const repo of REPOS_TO_INDEX) {
    try {
      const entries = await indexRepo(repo);
      allEntries.push(...entries);
    } catch (err) {
      console.error(`  Failed to index ${repo}:`, err);
    }
  }

  const index: DocsIndex = {
    version: "1.0",
    builtAt: new Date().toISOString(),
    entries: allEntries,
  };

  fs.mkdirSync(INDEX_PATH, { recursive: true });
  const indexFile = path.join(INDEX_PATH, "index.json");
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));

  console.log(`\nIndex built: ${allEntries.length} documents`);
  console.log(`Saved to: ${indexFile}`);
}

buildIndex().catch((err) => {
  console.error("Indexer failed:", err);
  process.exit(1);
});
