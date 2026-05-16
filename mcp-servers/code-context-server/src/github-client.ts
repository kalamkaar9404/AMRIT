/**
 * GitHub Code Search client for AMRIT repositories.
 * Uses GitHub REST API v3 code search and contents API.
 */

export interface CodeSearchResult {
  repo: string;
  path: string;
  url: string;
  htmlUrl: string;
  excerpt: string;
  score: number;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  htmlUrl: string;
  repo: string;
}

export interface RepoInfo {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  topics: string[];
  defaultBranch: string;
  url: string;
  stars: number;
  updatedAt: string;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  controller: string;
  file: string;
  htmlUrl: string;
}

export class GitHubClient {
  private org: string;
  private headers: Record<string, string>;

  constructor(token: string, org: string) {
    this.org = org;
    this.headers = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "amrit-ai-framework",
    };
    if (token) this.headers["Authorization"] = `Bearer ${token}`;
  }

  private async get<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status} for ${url}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async searchCode(query: string, repos?: string[]): Promise<CodeSearchResult[]> {
    const repoFilter = repos?.length
      ? repos.map((r) => `repo:${r.includes("/") ? r : `${this.org}/${r}`}`).join(" ")
      : `org:${this.org}`;

    const fullQuery = `${query} ${repoFilter}`;
    const url = `https://api.github.com/search/code?q=${encodeURIComponent(fullQuery)}&per_page=10`;

    const data = await this.get<{
      items: Array<{
        name: string;
        path: string;
        html_url: string;
        repository: { full_name: string; html_url: string };
        score: number;
        text_matches?: Array<{ fragment: string }>;
      }>;
    }>(url);

    return data.items.map((item) => ({
      repo: item.repository.full_name,
      path: item.path,
      url: `https://raw.githubusercontent.com/${item.repository.full_name}/main/${item.path}`,
      htmlUrl: item.html_url,
      excerpt: item.text_matches?.[0]?.fragment ?? "",
      score: item.score,
    }));
  }

  async getFile(repo: string, filePath: string, branch = "main"): Promise<FileContent> {
    const fullRepo = repo.includes("/") ? repo : `${this.org}/${repo}`;
    const url = `https://api.github.com/repos/${fullRepo}/contents/${filePath}?ref=${branch}`;
    const data = await this.get<{ content: string; encoding: string; html_url: string }>(url);
    const content =
      data.encoding === "base64" ? Buffer.from(data.content, "base64").toString("utf-8") : data.content;
    return { path: filePath, content, encoding: data.encoding, htmlUrl: data.html_url, repo: fullRepo };
  }

  async listOrgRepos(): Promise<RepoInfo[]> {
    const url = `https://api.github.com/orgs/${this.org}/repos?per_page=50&sort=updated`;
    const data = await this.get<
      Array<{
        name: string;
        full_name: string;
        description: string | null;
        language: string | null;
        topics: string[];
        default_branch: string;
        html_url: string;
        stargazers_count: number;
        updated_at: string;
      }>
    >(url);

    return data.map((r) => ({
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      language: r.language,
      topics: r.topics ?? [],
      defaultBranch: r.default_branch,
      url: r.html_url,
      stars: r.stargazers_count,
      updatedAt: r.updated_at,
    }));
  }

  async getRepoTree(repo: string, branch = "main"): Promise<Array<{ path: string; type: string; url: string }>> {
    const fullRepo = repo.includes("/") ? repo : `${this.org}/${repo}`;
    const url = `https://api.github.com/repos/${fullRepo}/git/trees/${branch}?recursive=1`;
    const data = await this.get<{ tree: Array<{ path: string; type: string; url: string }> }>(url);
    return data.tree;
  }

  async findApiEndpoints(repo: string): Promise<ApiEndpoint[]> {
    // Search for Spring Boot @RequestMapping, @GetMapping, @PostMapping etc.
    const mappingQuery = `@RequestMapping OR @GetMapping OR @PostMapping OR @PutMapping OR @DeleteMapping extension:java repo:${this.org}/${repo}`;
    const url = `https://api.github.com/search/code?q=${encodeURIComponent(mappingQuery)}&per_page=20`;

    let data: { items: Array<{ path: string; html_url: string; text_matches?: Array<{ fragment: string }> }> };
    try {
      data = await this.get(url);
    } catch {
      return [];
    }

    const endpoints: ApiEndpoint[] = [];
    for (const item of data.items) {
      const fragment = item.text_matches?.[0]?.fragment ?? "";
      const mappingMatch = fragment.match(/@(Get|Post|Put|Delete|Request)Mapping\s*\(\s*["']([^"']+)["']/);
      if (mappingMatch) {
        endpoints.push({
          method: mappingMatch[1] === "Request" ? "ANY" : mappingMatch[1].toUpperCase(),
          path: mappingMatch[2],
          controller: item.path.split("/").pop()?.replace(".java", "") ?? "",
          file: item.path,
          htmlUrl: item.html_url,
        });
      }
    }
    return endpoints;
  }
}
