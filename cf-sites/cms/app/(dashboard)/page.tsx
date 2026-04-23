'use client';

import { useStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, TrendingUp, Users, Eye, Search } from 'lucide-react';
import { AnalyticsChart } from '@/components/analytics-chart';
import { GscPerformanceChart } from '@/components/gsc-performance-chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function DashboardPage() {
  const { apiKey, siteId } = useStore();

  // Fetch Count (posts + pages) - lightweight, no full list
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ['meta', 'count', siteId],
    queryFn: async () => {
      const res = await axios.get(`/api/meta/count?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data as { posts: number; pages: number };
    },
    enabled: !!siteId,
  });

  // Fetch Analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', siteId],
    queryFn: async () => {
      const res = await axios.get(`/api/analytics?siteId=${siteId}&range=7d`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data;
    },
    enabled: !!siteId,
  });

  const [gscRange, setGscRange] = useState<'7d' | '28d' | '3m' | '1d'>('28d');
  const { data: gsc, isLoading: gscLoading } = useQuery({
    queryKey: ['gsc', siteId, gscRange],
    queryFn: async () => {
      const res = await axios.get(`/api/sites/${siteId}/gsc?range=${gscRange}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data as {
        ok: boolean;
        error?: string;
        hint?: string;
        domain?: string | null;
        siteUrl?: string;
        period?: { startDate: string; endDate: string; range?: string };
        summary?: { clicks: number; impressions: number; ctr: number; position: number };
        daily?: { date: string; clicks: number; impressions: number; ctr: number; position: number }[];
        queries?: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
        pages?: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
        countries?: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
        devices?: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
      };
    },
    enabled: !!siteId,
  });

  const totalPosts = counts?.posts ?? 0;
  const totalPages = counts?.pages ?? 0;

  // Calculate totals from analytics data
  const stats = analytics?.data || [];
  const totalViews = stats.reduce((acc: number, cur: any) => acc + cur.views, 0);
  const totalVisits = stats.reduce((acc: number, cur: any) => acc + cur.visits, 0);
  const isMock = analytics?.mock;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        {isMock && (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full border border-yellow-200">
            Demo Mode (Env vars missing)
          </span>
        )}
      </div>
      
      {!siteId ? (
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            Please select a site from the top-right menu to get started.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Analytics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views (7d)</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : totalViews.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Visits (7d)</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : totalVisits.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {countsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : totalPosts}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {countsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : totalPages}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart Section */}
          <div className="grid gap-4 md:grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Traffic Overview</CardTitle>
                <CardDescription>
                  Visitor stats for the last 7 days
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <AnalyticsChart data={stats} loading={analyticsLoading} />
              </CardContent>
            </Card>
          </div>

          {/* GSC Performance (simulated GSC Performance report) */}
          <div className="grid gap-4 md:grid-cols-1">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Performance
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {gsc?.domain != null ? (
                        <>Domain: <span className="font-medium text-foreground">{gsc.domain}</span>
                          {gsc?.ok && gsc.period ? ` · ${gsc.period.startDate} — ${gsc.period.endDate}` : ''}
                        </>
                      ) : (
                        'Google Search Console performance. Please configure GSC_SERVICE_ACCOUNT_JSON and add the service account as a user.'
                      )}
                    </CardDescription>
                  </div>
                  {gsc?.ok && (
                    <div className="flex items-center gap-1">
                      {(['1d', '7d', '28d', '3m'] as const).map((r) => (
                        <Button
                          key={r}
                          variant={gscRange === r ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setGscRange(r)}
                        >
                          {r === '1d' ? '24h' : r === '7d' ? '7d' : r === '28d' ? '28d' : '3m'}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {gscLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : !gsc?.ok ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                    {gsc?.domain != null && <p className="font-medium">Current Domain: {gsc.domain}</p>}
                    <p>{gsc?.error ?? 'Not configured'}</p>
                    {gsc?.hint && <p className="mt-1 opacity-90">{gsc.hint}</p>}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Metric cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Total clicks</div>
                        <div className="text-xl font-semibold">{gsc.summary?.clicks ?? 0}</div>
                      </div>
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Total impressions</div>
                        <div className="text-xl font-semibold">{(gsc.summary?.impressions ?? 0).toLocaleString()}</div>
                      </div>
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Average CTR</div>
                        <div className="text-xl font-semibold">{((gsc.summary?.ctr ?? 0) * 100).toFixed(2)}%</div>
                      </div>
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Average position</div>
                        <div className="text-xl font-semibold">{(gsc.summary?.position ?? 0).toFixed(1)}</div>
                      </div>
                    </div>

                    {/* Daily trend chart */}
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">Daily Trend</div>
                      <GscPerformanceChart data={gsc.daily ?? []} loading={false} />
                    </div>

                    {/* Tabs: Queries, Pages, Countries, Devices, Days */}
                    <Tabs defaultValue="queries" className="w-full">
                      <TabsList className="flex flex-wrap h-auto gap-1">
                        <TabsTrigger value="queries">Queries</TabsTrigger>
                        <TabsTrigger value="pages">Pages</TabsTrigger>
                        <TabsTrigger value="countries">Countries</TabsTrigger>
                        <TabsTrigger value="devices">Devices</TabsTrigger>
                        <TabsTrigger value="days">Days</TabsTrigger>
                      </TabsList>
                      {(['queries', 'pages', 'countries', 'devices'] as const).map((tab) => {
                        const rows = tab === 'queries' ? gsc.queries : tab === 'pages' ? gsc.pages : tab === 'countries' ? gsc.countries : gsc.devices;
                        const label = tab === 'queries' ? 'Top queries' : tab === 'pages' ? 'Top pages' : tab === 'countries' ? 'Countries' : 'Devices';
                        return (
                          <TabsContent key={tab} value={tab} className="mt-3">
                            <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
                            <div className="rounded-lg border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/50 border-b">
                                    <th className="text-left py-2 px-3 font-medium">{tab === 'queries' ? 'Query' : tab === 'pages' ? 'Page' : tab === 'countries' ? 'Country' : 'Device'}</th>
                                    <th className="text-right py-2 px-3 font-medium">Clicks</th>
                                    <th className="text-right py-2 px-3 font-medium">Impressions</th>
                                    <th className="text-right py-2 px-3 font-medium">CTR</th>
                                    <th className="text-right py-2 px-3 font-medium">Position</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(rows ?? []).length === 0 ? (
                                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No data</td></tr>
                                  ) : (
                                    (rows ?? []).map((r, i) => (
                                      <tr key={i} className="border-b last:border-0">
                                        <td className="py-2 px-3 truncate max-w-[240px]" title={r.key}>{r.key || '(not set)'}</td>
                                        <td className="text-right py-2 px-3">{r.clicks}</td>
                                        <td className="text-right py-2 px-3">{r.impressions}</td>
                                        <td className="text-right py-2 px-3">{((r.ctr ?? 0) * 100).toFixed(2)}%</td>
                                        <td className="text-right py-2 px-3">{(r.position ?? 0).toFixed(1)}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </TabsContent>
                        );
                      })}
                      <TabsContent value="days" className="mt-3">
                        <div className="text-sm font-medium text-muted-foreground mb-2">By day</div>
                        <div className="rounded-lg border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/50 border-b">
                                <th className="text-left py-2 px-3 font-medium">Date</th>
                                <th className="text-right py-2 px-3 font-medium">Clicks</th>
                                <th className="text-right py-2 px-3 font-medium">Impressions</th>
                                <th className="text-right py-2 px-3 font-medium">CTR</th>
                                <th className="text-right py-2 px-3 font-medium">Position</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(gsc.daily ?? []).length === 0 ? (
                                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No data</td></tr>
                              ) : (
                                [...(gsc.daily ?? [])].reverse().map((d, i) => (
                                  <tr key={i} className="border-b last:border-0">
                                    <td className="py-2 px-3">{new Date(d.date).toLocaleDateString()}</td>
                                    <td className="text-right py-2 px-3">{d.clicks}</td>
                                    <td className="text-right py-2 px-3">{d.impressions}</td>
                                    <td className="text-right py-2 px-3">{((d.ctr ?? 0) * 100).toFixed(2)}%</td>
                                    <td className="text-right py-2 px-3">{(d.position ?? 0).toFixed(1)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
