export interface DocEntry {
  id: string;
  title: string;
  content: string;
  url: string;
  repo?: string;
  path?: string;
  lastUpdated: string;
  tags: string[];
}

export interface SearchResult {
  entry: DocEntry;
  score: number;
  excerpt: string;
}

export interface DocsIndex {
  version: string;
  builtAt: string;
  entries: DocEntry[];
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  download_url: string | null;
  type: "file" | "dir";
}

export interface GitHubContent {
  content: string;
  encoding: string;
  name: string;
  path: string;
  html_url: string;
}
