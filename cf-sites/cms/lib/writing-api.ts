/**
 * Article Writing System API client.
 * Base: https://web-production-0084b.up.railway.app
 * Auth: X-API-Key header
 */

const BASE_URL = 'https://web-production-0084b.up.railway.app';

export interface WritingProject {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
  language: string;
  created_at: string | null;
}

export interface WritingJob {
  job_id: string;
  project_id: string;
  job_type: string;
  status: string;
  created_at: string;
}

export interface JobDetail {
  job_id: string;
  project_id: string;
  job_type: string;
  status: string;
  result?: {
    files?: { name: string; type: string; size: number }[];
    metadata?: {
      slug?: string;
      meta?: {
        title?: string;
        description?: string;
        keywords?: string[];
        category?: string;
        author?: string;
      };
      og?: { title?: string; description?: string; type?: string };
    };
  };
  cost?: { total_usd?: number; tokens_used?: number };
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface JobFilesResponse {
  job_id: string;
  files: { name: string; type: string; size: number; url: string }[];
  total: number;
}

function getApiKey(env: Record<string, unknown>): string {
  const key =
    env.ARTICLE_WRITING_API_KEY ||
    env.ARTICLE_WRITING_SYSTEM_API_TOKEN;
  if (!key || typeof key !== 'string') {
    throw new Error('ARTICLE_WRITING_API_KEY or ARTICLE_WRITING_SYSTEM_API_TOKEN required');
  }
  return key;
}

function headers(apiKey: string): Record<string, string> {
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export async function listProjects(env: Record<string, unknown>): Promise<WritingProject[]> {
  const apiKey = getApiKey(env);
  const res = await fetch(`${BASE_URL}/api/v1/projects`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`listProjects failed: ${res.status}`);
  const data = await res.json<{ projects: WritingProject[] }>();
  return data.projects ?? [];
}

export async function getProject(
  env: Record<string, unknown>,
  projectId: string
): Promise<unknown> {
  const apiKey = getApiKey(env);
  const res = await fetch(`${BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}`, {
    headers: headers(apiKey),
  });
  if (!res.ok) throw new Error(`getProject failed: ${res.status}`);
  return res.json();
}

export async function createProjectFromDomain(
  env: Record<string, unknown>,
  domain: string,
  projectId: string,
  options?: { language?: string }
): Promise<{ job_id: string; status: string }> {
  const apiKey = getApiKey(env);
  const res = await fetch(`${BASE_URL}/api/v1/projects/from-domain`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ domain, project_id: projectId, options }),
  });
  if (!res.ok) throw new Error(`createProjectFromDomain failed: ${res.status}`);
  return res.json();
}

export async function listJobs(
  env: Record<string, unknown>,
  projectId: string,
  opts?: { after?: string; limit?: number; status?: string, order?: string }
): Promise<{ jobs: WritingJob[]; total: number; has_more?: boolean }> {
  const apiKey = getApiKey(env);
  const params = new URLSearchParams();
  params.set('project_id', projectId);
  if (opts?.after) params.set('after', opts.after);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.status) params.set('status', opts.status);
  if (opts?.order) params.set('order', opts.order);
  const res = await fetch(`${BASE_URL}/api/v1/jobs?${params}`, {
    headers: headers(apiKey),
  });
  if (!res.ok) throw new Error(`listJobs failed: ${res.status}`);
  return res.json();
}

export async function getJob(
  env: Record<string, unknown>,
  jobId: string
): Promise<JobDetail> {
  const apiKey = getApiKey(env);
  const res = await fetch(`${BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
    headers: headers(apiKey),
  });
  if (!res.ok) throw new Error(`getJob failed: ${res.status}`);
  return res.json();
}

export async function getJobFiles(
  env: Record<string, unknown>,
  jobId: string
): Promise<JobFilesResponse> {
  const apiKey = getApiKey(env);
  const res = await fetch(`${BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/files`, {
    headers: headers(apiKey),
  });
  if (!res.ok) throw new Error(`getJobFiles failed: ${res.status}`);
  return res.json();
}

export async function downloadJobFile(
  env: Record<string, unknown>,
  jobId: string,
  filePath: string
): Promise<ArrayBuffer> {
  const apiKey = getApiKey(env);
  const pathSegments = filePath.split('/').map((s) => encodeURIComponent(s)).join('/');
  const res = await fetch(
    `${BASE_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/files/${pathSegments}`,
    { headers: headers(apiKey) }
  );
  if (!res.ok) throw new Error(`downloadJobFile failed: ${res.status}`);
  return res.arrayBuffer();
}
