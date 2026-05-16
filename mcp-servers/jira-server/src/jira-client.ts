/**
 * Thin JIRA REST API v3 client.
 * Uses Basic auth (email + API token) — the standard for Atlassian Cloud.
 */

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description: string | null;
  status: string;
  assignee: string | null;
  reporter: string;
  priority: string;
  issuetype: string;
  project: string;
  labels: string[];
  storyPoints: number | null;
  created: string;
  updated: string;
  url: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: "active" | "closed" | "future";
  startDate?: string;
  endDate?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface CreateIssueInput {
  projectKey: string;
  summary: string;
  description: string;
  issuetype: "Story" | "Bug" | "Task" | "Epic" | "Sub-task";
  priority?: "Highest" | "High" | "Medium" | "Low" | "Lowest";
  labels?: string[];
  storyPoints?: number;
  assigneeAccountId?: string;
}

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64");
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/rest/api/3${path}`;
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
      throw new Error(`JIRA API ${res.status} for ${path}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  private parseIssue(raw: Record<string, unknown>): JiraIssue {
    const fields = raw.fields as Record<string, unknown>;
    const assignee = fields.assignee as Record<string, string> | null;
    const reporter = fields.reporter as Record<string, string>;
    const status = fields.status as Record<string, string>;
    const priority = fields.priority as Record<string, string>;
    const issuetype = fields.issuetype as Record<string, string>;
    const project = fields.project as Record<string, string>;
    const sp = fields.story_points ?? fields.customfield_10016;

    return {
      id: raw.id as string,
      key: raw.key as string,
      summary: fields.summary as string,
      description: this.extractDescriptionText(fields.description),
      status: status?.name ?? "Unknown",
      assignee: assignee?.displayName ?? null,
      reporter: reporter?.displayName ?? "Unknown",
      priority: priority?.name ?? "Medium",
      issuetype: issuetype?.name ?? "Task",
      project: project?.key ?? "",
      labels: (fields.labels as string[]) ?? [],
      storyPoints: typeof sp === "number" ? sp : null,
      created: fields.created as string,
      updated: fields.updated as string,
      url: `${this.baseUrl}/browse/${raw.key}`,
    };
  }

  private extractDescriptionText(desc: unknown): string | null {
    if (!desc) return null;
    if (typeof desc === "string") return desc;
    // Atlassian Document Format (ADF) — extract plain text from content
    const adf = desc as Record<string, unknown>;
    if (adf.type === "doc" && Array.isArray(adf.content)) {
      return this.adfToText(adf.content as Record<string, unknown>[]);
    }
    return JSON.stringify(desc);
  }

  private adfToText(nodes: Record<string, unknown>[]): string {
    const parts: string[] = [];
    for (const node of nodes) {
      if (node.type === "text") parts.push(node.text as string);
      else if (Array.isArray(node.content)) parts.push(this.adfToText(node.content as Record<string, unknown>[]));
    }
    return parts.join(" ");
  }

  async getProjects(): Promise<JiraProject[]> {
    const data = await this.request<{ values: Record<string, unknown>[] }>("/project/search?maxResults=50");
    return data.values.map((p) => ({
      id: p.id as string,
      key: p.key as string,
      name: p.name as string,
      projectTypeKey: p.projectTypeKey as string,
    }));
  }

  async searchIssues(jql: string, maxResults = 20): Promise<JiraIssue[]> {
    const data = await this.request<{ issues: Record<string, unknown>[] }>(
      `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,description,status,assignee,reporter,priority,issuetype,project,labels,story_points,customfield_10016,created,updated`
    );
    return data.issues.map((i) => this.parseIssue(i));
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const data = await this.request<Record<string, unknown>>(
      `/issue/${issueKey}?fields=summary,description,status,assignee,reporter,priority,issuetype,project,labels,story_points,customfield_10016,created,updated,comment`
    );
    return this.parseIssue(data);
  }

  async createIssue(input: CreateIssueInput): Promise<{ key: string; url: string }> {
    const body: Record<string, unknown> = {
      fields: {
        project: { key: input.projectKey },
        summary: input.summary,
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: input.description }],
            },
          ],
        },
        issuetype: { name: input.issuetype },
        priority: { name: input.priority ?? "Medium" },
        labels: input.labels ?? [],
      },
    };

    if (input.storyPoints) {
      (body.fields as Record<string, unknown>).customfield_10016 = input.storyPoints;
    }
    if (input.assigneeAccountId) {
      (body.fields as Record<string, unknown>).assignee = { accountId: input.assigneeAccountId };
    }

    const data = await this.request<{ id: string; key: string }>("/issue", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return { key: data.key, url: `${this.baseUrl}/browse/${data.key}` };
  }

  async getActiveSprint(boardId: number): Promise<JiraSprint | null> {
    const data = await this.request<{ values: Record<string, unknown>[] }>(
      `/board/${boardId}/sprint?state=active`
    );
    if (!data.values.length) return null;
    const s = data.values[0];
    return {
      id: s.id as number,
      name: s.name as string,
      state: s.state as JiraSprint["state"],
      startDate: s.startDate as string | undefined,
      endDate: s.endDate as string | undefined,
    };
  }
}
