
import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { getConfig } from '@/lib/r2-utils';
import { getDomainMap } from '@/lib/cloudflare-api';

export const runtime = 'edge';

const CF_API_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId'); 
  const range = searchParams.get('range') || '7d';

  const env = await getEnv();
  const rawApiToken = env.CF_API_TOKEN || '';
  const rawZoneToken = env.CF_ZONE_API_TOKEN || rawApiToken;
  
  const apiToken = rawApiToken.trim();
  let zoneApiToken = rawZoneToken.trim();

  let zoneId = env.CF_ZONE_ID ? env.CF_ZONE_ID.trim() : undefined; 
  
  // Smart check: If CF_ZONE_API_TOKEN looks like a Zone ID (32 hex chars), use it as Zone ID
  if (zoneApiToken && zoneApiToken.length === 32 && /^[0-9a-fA-F]+$/.test(zoneApiToken)) {
    console.log('CF_ZONE_API_TOKEN looks like a Zone ID, using it as zoneId');
    zoneId = zoneApiToken;
    zoneApiToken = apiToken; // Revert token to main one for auth
  }

  let configUrl = '';
  let resolvedDomain = '';
  let resolveError = '';
  let resolveLogs: string[] = [];
  
  if (siteId) {
    try {
      const [config, domainMap] = await Promise.all([
        getConfig(env.CONTENT_BUCKET, siteId),
        getDomainMap(env.CONTENT_BUCKET),
      ]);
      const domainsForSite = Object.entries(domainMap)
        .filter(([, sid]) => sid === siteId)
        .map(([host]) => host);
      const firstDomain = domainsForSite[0];
      configUrl = firstDomain ? `https://${firstDomain}` : '';

      // Priority 1: Explicit Zone ID in config
      if (config.zoneId) {
        zoneId = config.zoneId;
      }
      // Priority 2: Auto-resolve from bound domain
      else if (firstDomain && zoneApiToken) {
        resolvedDomain = firstDomain;
        console.log(`Auto-resolving Zone ID for domain: ${firstDomain}`);
        const result = await resolveZoneId(firstDomain, zoneApiToken);
        resolveLogs = result.logs;
        if (result.id) zoneId = result.id;
      }
    } catch (e: any) {
      console.warn('Failed to load site config for analytics', e);
      resolveError = `Config load failed: ${e.message}`;
    }
  }

  // --- FALLBACK TO ACCOUNT ANALYTICS IF ZONE ID MISSING ---
  const accountId = env.CF_ACCOUNT_ID;

  if (!zoneId) {
    if (!accountId || !apiToken) {
      return jsonResponse({
        mock: true,
        data: generateMockData(range),
        note: 'Missing Zone ID AND Account ID. Please configure at least one.',
        debug: {
          siteId,
          hasApiToken: !!apiToken,
          envZoneId: env.CF_ZONE_ID,
          hasAccountId: !!accountId,
          resolveLogs
        }
      });
    }

    // Query Account Analytics
    const accountQuery = `
      query GetAccountAnalytics($accountTag: string!, $filter: String) {
        viewer {
          accounts(filter: {accountTag: $accountTag}) {
            httpRequestsAdaptiveGroups(
              limit: 1000,
              filter: {
                date_geq: "${getStartDate(range).split('T')[0]}",
                date_leq: "${new Date().toISOString().split('T')[0]}"
              },
              orderBy: [date_DESC]
            ) {
              count
              dimensions {
                date
              }
            }
          }
        }
      }
    `;

    try {
      const res = await fetch(CF_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken.trim()}`,
        },
        body: JSON.stringify({
          query: accountQuery,
          variables: { accountTag: accountId },
        }),
      });

      const result = await res.json<any>();
      
      if (result.errors) {
        return jsonResponse({
          mock: true,
          data: generateMockData(range),
          error: `Account Query Failed: ${result.errors[0]?.message}`,
          debug: { resolveLogs, cfErrors: result.errors }
        });
      }

      const data = result.data?.viewer?.accounts?.[0]?.httpRequestsAdaptiveGroups || [];
      const formatted = data.map((d: any) => ({
        date: d.dimensions.date,
        visits: d.count,
        views: d.count,
      })).reverse();

      return jsonResponse({
        mock: false,
        data: formatted,
        note: 'Showing Account-level Data (Zone ID not found)'
      });

    } catch (e: any) {
      return errorResponse(e.message, 500);
    }
  }

  // GraphQL query for Zone-level HTTP Requests
  const query = `
    query GetZoneAnalytics($zoneTag: string!, $filter: String) {
      viewer {
        zones(filter: {zoneTag: $zoneTag}) {
          httpRequests1dGroups(
            limit: 1000,
            filter: {
              date_geq: "${getStartDate(range).split('T')[0]}",
              date_leq: "${new Date().toISOString().split('T')[0]}"
            },
            orderBy: [date_DESC]
          ) {
            sum {
              requests
              pageViews
            }
            dimensions {
              date
            }
          }
        }
      }
    }
  `;

    try {
      const res = await fetch(CF_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${zoneApiToken.trim()}`, // Use the token that can access the zone!
        },
        body: JSON.stringify({
          query,
          variables: {
            zoneTag: zoneId,
          },
        }),
      });

    const result = await res.json<any>();
    
    if (result.errors) {
      console.error('CF GraphQL Error:', JSON.stringify(result.errors, null, 2));
      return errorResponse(`GraphQL Error: ${result.errors[0]?.message}`, 500);
    }

    const data = result.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
    
    // Format for frontend
    const formatted = data.map((d: any) => ({
      date: d.dimensions.date,
      visits: d.sum.visits || d.sum.requests, 
      views: d.sum.pageViews || d.sum.requests,
    })).reverse();

    return jsonResponse({
      mock: false,
      data: formatted,
    });

  } catch (e: any) {
    console.error(e);
    return errorResponse(e.message, 500);
  }
}

// Helper types for debug
interface ResolveResult {
  id: string | null;
  logs: string[];
}

async function resolveZoneId(domain: string, apiToken: string): Promise<ResolveResult> {
  const logs: string[] = [];
  
  // Try exact match first
  logs.push(`Trying exact match: ${domain}`);
  let res = await fetchZoneId(domain, apiToken);
  logs.push(`Exact match result: ${JSON.stringify(res)}`);
  
  if (res.id) return { id: res.id, logs };

  // Try parent domain
  const parts = domain.split('.');
  if (parts.length > 2) {
    const parent = parts.slice(1).join('.');
    logs.push(`Trying parent domain: ${parent}`);
    res = await fetchZoneId(parent, apiToken);
    logs.push(`Parent match result: ${JSON.stringify(res)}`);
    if (res.id) return { id: res.id, logs };
  }

  return { id: null, logs };
}

async function fetchZoneId(name: string, apiToken: string): Promise<{ id: string | null; error?: any }> {
  try {
    const res = await fetch(`${CF_API_BASE}/zones?name=${name}`, {
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json<any>();
    
    if (!res.ok) {
      return { id: null, error: { status: res.status, data } };
    }

    if (data.success && data.result && data.result.length > 0) {
      return { id: data.result[0].id };
    }
    
    return { id: null, error: data };
  } catch (e: any) {
    return { id: null, error: e.message };
  }
}

function getStartDate(range: string): string {
  const date = new Date();
  if (range === '24h') date.setHours(date.getHours() - 24);
  else if (range === '30d') date.setDate(date.getDate() - 30);
  else date.setDate(date.getDate() - 7); // Default 7d
  return date.toISOString();
}

function generateMockData(range: string) {
  const days = range === '30d' ? 30 : 7;
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toISOString().split('T')[0],
      visits: Math.floor(Math.random() * 500) + 100,
      views: Math.floor(Math.random() * 1000) + 200,
    });
  }
  return data;
}
