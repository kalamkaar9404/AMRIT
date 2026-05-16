import type { DocEntry, SearchResult } from "./types.js";

/**
 * Lightweight keyword search over the docs index.
 * Uses TF-IDF-inspired scoring: term frequency in doc * inverse repo frequency.
 * No external dependencies needed — runs in-process.
 */

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function termFrequency(tokens: string[], query: string[]): number {
  let score = 0;
  for (const qTerm of query) {
    const count = tokens.filter((t) => t === qTerm || t.startsWith(qTerm)).length;
    score += count / tokens.length;
  }
  return score;
}

function titleBoost(title: string, query: string[]): number {
  const titleTokens = tokenize(title);
  const matches = query.filter((q) => titleTokens.some((t) => t.includes(q)));
  return matches.length * 2;
}

function tagBoost(tags: string[], query: string[]): number {
  const matches = query.filter((q) => tags.some((t) => t.toLowerCase().includes(q)));
  return matches.length * 1.5;
}

function extractExcerpt(content: string, query: string[], maxLen = 300): string {
  const lower = content.toLowerCase();
  let bestPos = 0;
  let bestScore = 0;

  for (const term of query) {
    const pos = lower.indexOf(term);
    if (pos !== -1) {
      const matchCount = query.filter((q) => lower.slice(Math.max(0, pos - 50), pos + 200).includes(q)).length;
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestPos = pos;
      }
    }
  }

  const start = Math.max(0, bestPos - 50);
  const end = Math.min(content.length, start + maxLen);
  let excerpt = content.slice(start, end).trim();
  if (start > 0) excerpt = "..." + excerpt;
  if (end < content.length) excerpt = excerpt + "...";
  return excerpt;
}

export function search(entries: DocEntry[], query: string, topK = 10): SearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored: SearchResult[] = entries.map((entry) => {
    const contentTokens = tokenize(entry.content);
    const tf = termFrequency(contentTokens, queryTokens);
    const tb = titleBoost(entry.title, queryTokens);
    const tagb = tagBoost(entry.tags, queryTokens);
    const score = tf + tb + tagb;

    return {
      entry,
      score,
      excerpt: extractExcerpt(entry.content, queryTokens),
    };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function getByRepo(entries: DocEntry[], repo: string): DocEntry[] {
  return entries.filter((e) => e.repo === repo || e.repo?.endsWith("/" + repo));
}

export function getByTag(entries: DocEntry[], tag: string): DocEntry[] {
  return entries.filter((e) => e.tags.includes(tag.toLowerCase()));
}
