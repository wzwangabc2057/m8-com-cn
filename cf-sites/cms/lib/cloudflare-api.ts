/**
 * Cloudflare API helpers for site management.
 *
 * All functions call the Cloudflare REST API using the token / account-id
 * that are stored as environment variables in the CMS Pages project.
 */

const CF_API = 'https://api.cloudflare.com/client/v4';

// ─── Low-level fetch wrapper ────────────────────────────────

async function cfFetch<T = unknown>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<{ success: boolean; result: T; errors: { code: number; message: string }[] }> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return res.json() as any;
}

// ─── Zone lookup ────────────────────────────────────────────

export interface ZoneInfo {
  id: string;
  name: string;
  status: string;
}

/**
 * Find the Cloudflare Zone for a given hostname.
 * e.g. "blog.example.com" → Zone for "example.com"
 */
export async function findZoneForHostname(
  token: string,
  hostname: string,
): Promise<ZoneInfo | null> {
  // Extract the registerable domain (last two parts, or last three for co.uk etc.)
  // Simple heuristic: try progressively shorter suffixes.
  const parts = hostname.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    const data = await cfFetch<ZoneInfo[]>(
      `/zones?name=${encodeURIComponent(candidate)}&status=active`,
      token,
    );
    if (data.success && data.result.length > 0) {
      return data.result[0];
    }
  }
  return null;
}

// ─── Workers Routes ─────────────────────────────────────────

export interface WorkersRoute {
  id: string;
  pattern: string;
  script: string;
}

/** List all Workers Routes in a zone. */
export async function listRoutes(token: string, zoneId: string): Promise<WorkersRoute[]> {
  const data = await cfFetch<WorkersRoute[]>(`/zones/${zoneId}/workers/routes`, token);
  return data.success ? data.result : [];
}

/** Create a Workers Route that sends traffic to site-router. */
export async function createRoute(
  token: string,
  zoneId: string,
  pattern: string,
  scriptName = 'site-router',
): Promise<{ id: string } | null> {
  const data = await cfFetch<{ id: string }>(`/zones/${zoneId}/workers/routes`, token, {
    method: 'POST',
    body: JSON.stringify({ pattern, script: scriptName }),
  });
  if (!data.success) {
    throw new Error(`Failed to create route: ${data.errors.map((e) => e.message).join(', ')}`);
  }
  return data.result;
}

/** Delete a Workers Route by id. */
export async function deleteRoute(token: string, zoneId: string, routeId: string): Promise<void> {
  const data = await cfFetch(`/zones/${zoneId}/workers/routes/${routeId}`, token, {
    method: 'DELETE',
  });
  if (!data.success) {
    throw new Error(`Failed to delete route: ${data.errors.map((e) => e.message).join(', ')}`);
  }
}

// ─── DNS Records ────────────────────────────────────────────

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}

/** List DNS records matching a name in a zone. */
export async function listDnsRecords(
  token: string,
  zoneId: string,
  name: string,
): Promise<DnsRecord[]> {
  const data = await cfFetch<DnsRecord[]>(
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}`,
    token,
  );
  return data.success ? data.result : [];
}

/**
 * Ensure a proxied AAAA record exists for the hostname.
 * Workers Routes require a proxied DNS record to intercept traffic.
 * We use AAAA 100:: (a convention for "dummy" proxied records).
 */
export async function ensureDnsRecord(
  token: string,
  zoneId: string,
  hostname: string,
): Promise<DnsRecord> {
  const existing = await listDnsRecords(token, zoneId, hostname);
  const aaaa = existing.find((r) => r.type === 'AAAA' && r.proxied);
  if (aaaa) return aaaa;

  const data = await cfFetch<DnsRecord>(`/zones/${zoneId}/dns_records`, token, {
    method: 'POST',
    body: JSON.stringify({
      type: 'AAAA',
      name: hostname,
      content: '100::',
      proxied: true,
      ttl: 1, // Auto
    }),
  });
  if (!data.success) {
    throw new Error(`Failed to create DNS record: ${data.errors.map((e) => e.message).join(', ')}`);
  }
  return data.result;
}

/** Delete a DNS record by id. */
export async function deleteDnsRecord(
  token: string,
  zoneId: string,
  recordId: string,
): Promise<void> {
  const data = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, token, {
    method: 'DELETE',
  });
  if (!data.success) {
    throw new Error(`Failed to delete DNS: ${data.errors.map((e) => e.message).join(', ')}`);
  }
}

// ─── Zone Settings: Image Resizing (Transformations) ───────────

/**
 * Enable or disable Cloudflare Image Resizing (transformations) for a zone.
 * Requires Zone Settings Write permission on the API token.
 */
export async function setTransformations(
  token: string,
  zoneId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const data = await cfFetch<{ value: string }>(
    `/zones/${zoneId}/settings/transformations`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ value: enabled ? 'on' : 'off' }),
    },
  );
  if (!data.success) {
    return {
      success: false,
      error: data.errors?.map((e) => e.message).join(', ') || 'Unknown error',
    };
  }
  return { success: true };
}

// ─── Domain Map (R2) ────────────────────────────────────────

export type DomainMap = Record<string, string>; // hostname → siteId

export async function getDomainMap(bucket: R2Bucket): Promise<DomainMap> {
  const obj = await bucket.get('_domain_map.json');
  if (!obj) return {};
  return obj.json<DomainMap>();
}

export async function putDomainMap(bucket: R2Bucket, map: DomainMap): Promise<void> {
  await bucket.put('_domain_map.json', JSON.stringify(map, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

// ─── High-level: bind domain to site ────────────────────────

export interface BindDomainResult {
  zoneId: string;
  zoneName: string;
  routeId: string;
  dnsRecordId: string;
}

/**
 * Full flow to bind a custom domain to a site:
 * 1. Look up Zone
 * 2. Ensure DNS record (AAAA 100:: proxied)
 * 3. Create Workers Route (hostname/* → site-router)
 * 4. Update _domain_map.json in R2
 */
export async function bindDomain(
  token: string,
  bucket: R2Bucket,
  hostname: string,
  siteId: string,
): Promise<BindDomainResult> {
  // 1. Find zone
  const zone = await findZoneForHostname(token, hostname);
  if (!zone) {
    throw new Error(`Zone not found for "${hostname}". Make sure the domain is in your Cloudflare account.`);
  }

  // 2. DNS
  const dns = await ensureDnsRecord(token, zone.id, hostname);

  // 3. Workers Route – need both "hostname/*" and "hostname"
  //    Check if routes already exist first
  const existingRoutes = await listRoutes(token, zone.id);
  const patternWild = `${hostname}/*`;
  const patternBare = hostname;

  let routeId = '';
  if (!existingRoutes.find((r) => r.pattern === patternWild)) {
    const r = await createRoute(token, zone.id, patternWild);
    if (r) routeId = r.id;
  }
  if (!existingRoutes.find((r) => r.pattern === patternBare)) {
    await createRoute(token, zone.id, patternBare);
  }

  // 4. Domain map
  const map = await getDomainMap(bucket);
  map[hostname] = siteId;
  await putDomainMap(bucket, map);

  return {
    zoneId: zone.id,
    zoneName: zone.name,
    routeId,
    dnsRecordId: dns.id,
  };
}

/**
 * Full flow to unbind a custom domain from a site:
 * 1. Remove from _domain_map.json
 * 2. Delete Workers Routes
 * 3. Delete DNS record
 */
export async function unbindDomain(
  token: string,
  bucket: R2Bucket,
  hostname: string,
): Promise<void> {
  // 1. Remove from domain map
  const map = await getDomainMap(bucket);
  delete map[hostname];
  await putDomainMap(bucket, map);

  // 2. Find zone & remove routes
  const zone = await findZoneForHostname(token, hostname);
  if (zone) {
    const routes = await listRoutes(token, zone.id);
    for (const r of routes) {
      if (r.pattern === `${hostname}/*` || r.pattern === hostname) {
        await deleteRoute(token, zone.id, r.id).catch(() => {});
      }
    }

    // 3. Remove DNS
    const records = await listDnsRecords(token, zone.id, hostname);
    for (const rec of records) {
      if (rec.type === 'AAAA' && rec.content === '100::') {
        await deleteDnsRecord(token, zone.id, rec.id).catch(() => {});
      }
    }
  }
}
