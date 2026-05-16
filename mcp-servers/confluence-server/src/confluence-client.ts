/**
 * Confluence Cloud REST API v2 client.
 */

export interface ConfluencePage {
  id: string;
  title: string;
  spaceKey: string;
  spaceName: string;
  content: string;
  url: string;
  lastModified: string;
  author: string;
  version: number;
}

export interface ConfluenceSpace {
  key: string;
  name: string;
  type: string;
  url: string;
}

export interface ConfluenceSearchResult {
  page: ConfluencePage;
  excerpt: string;
}

export class ConfluenceClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64");
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/rest/api${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Confluence API ${res.status} for ${path}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<li>/gi, "\n- ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private parsePage(raw: Record<string, unknown>): ConfluencePage {
    const space = raw.space as Record<string, string> | undefined;
    const body = raw.body as Record<string, Record<string, string>> | undefined;
    const history = raw.history as Record<string, unknown> | undefined;
    const lastUpdated = history?.lastUpdated as Record<string, string> | undefined;
    const createdBy = history?.createdBy as Record<string, string> | undefined;

    return {
      id: raw.id as string,
      title: raw.title as string,
      spaceKey: space?.key ?? "",
      spaceName: space?.name ?? "",
      content: this.htmlToText(body?.storage?.value ?? body?.view?.value ?? ""),
      url: `${this.baseUrl}${(raw._links as Record<string, string>)?.webui ?? ""}`,
      lastModified: lastUpdated?.when ?? "",
      author: createdBy?.displayName ?? "Unknown",
      version: (raw.version as Record<string, number>)?.number ?? 1,
    };
  }

  async getSpaces(keys?: string[]): Promise<ConfluenceSpace[]> {
    const filter = keys?.length ? `?spaceKey=${keys.join("&spaceKey=")}` : "";
    const data = await this.request<{ results: Record<string, unknown>[] }>(`/space${filter}&limit=50`);
    return data.results.map((s) => ({
      key: s.key as string,
      name: s.name as string,
      type: s.type as string,
      url: `${this.baseUrl}${(s._links as Record<string, string>)?.webui ?? ""}`,
    }));
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    const data = await this.request<Record<string, unknown>>(
      `/content/${pageId}?expand=body.storage,body.view,space,history,history.lastUpdated,history.createdBy,version`
    );
    return this.parsePage(data);
  }

  async searchPages(query: string, spaceKeys?: string[]): Promise<ConfluenceSearchResult[]> {
    let cql = `type=page AND text~"${query.replace(/"/g, '\\"')}"`;
    if (spaceKeys?.length) {
      cql += ` AND space in (${spaceKeys.map((k) => `"${k}"`).join(",")})`;
    }
    const data = await this.request<{ results: Record<string, unknown>[]; totalSize: number }>(
      `/content/search?cql=${encodeURIComponent(cql)}&limit=10&expand=body.view,space,history,history.lastUpdated`
    );

    return data.results.map((r) => {
      const page = this.parsePage(r);
      const excerpt = page.content.slice(0, 300) + (page.content.length > 300 ? "..." : "");
      return { page, excerpt };
    });
  }

  async getPagesInSpace(spaceKey: string, limit = 20): Promise<ConfluencePage[]> {
    const data = await this.request<{ results: Record<string, unknown>[] }>(
      `/content?type=page&spaceKey=${spaceKey}&limit=${limit}&expand=body.view,space,history,history.lastUpdated`
    );
    return data.results.map((r) => this.parsePage(r));
  }

  async createPage(spaceKey: string, title: string, content: string, parentId?: string): Promise<{ id: string; url: string }> {
    const body: Record<string, unknown> = {
      type: "page",
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: `<p>${content.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`,
          representation: "storage",
        },
      },
    };
    if (parentId) body.ancestors = [{ id: parentId }];

    const data = await this.request<Record<string, unknown>>("/content", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      id: data.id as string,
      url: `${this.baseUrl}${(data._links as Record<string, string>)?.webui ?? ""}`,
    };
  }
}
