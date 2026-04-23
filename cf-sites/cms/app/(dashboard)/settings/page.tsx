'use client';

import { useStore } from '@/lib/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { SiteConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettingsForm } from '@/components/config/general-form';
import { NavigationEditor } from '@/components/config/navigation-editor';
import { StoreSettings } from '@/components/config/store-settings';
import { ScheduledPublishForm } from '@/components/config/scheduled-publish-form';
import { Loader2, Save, RotateCcw, Send } from 'lucide-react';
import { ConfigEditor as RebuildButton } from '@/components/config-editor';

function WritingSyncPanel({
  siteId,
  apiKey,
  writingSync,
  onRefetch,
}: {
  siteId: string;
  apiKey: string;
  writingSync: { siteId: string; projectId: string | null; lastJobId: string | null; updatedAt: string | null } | undefined;
  onRefetch: () => void;
}) {
  const resetMutation = useMutation({
    mutationFn: async () => {
      await axios.post(
        '/api/writing-sync/reset',
        { siteId },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
    },
    onSuccess: () => {
      onRefetch();
    },
  });

  return (
    <div className="bg-white p-4 rounded-lg border space-y-4">
      <h3 className="font-medium">Writing Sync Status</h3>
      <p className="text-sm text-muted-foreground">Maintained automatically by scheduled sync job. Resetting Last Job ID will force the next sync to re-process from the earliest completed batch.</p>
      <div className="grid gap-3 text-sm">
        <div className="flex gap-2">
          <span className="text-muted-foreground w-28">Project ID</span>
          <span className="font-mono">{writingSync?.projectId ?? '—'}</span>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-muted-foreground w-28">Last Job ID</span>
          <span className="font-mono">{writingSync?.lastJobId ?? '—'}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2 h-8"
            disabled={!writingSync?.lastJobId || resetMutation.isPending}
            onClick={() => resetMutation.mutate()}
          >
            {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
            Reset
          </Button>
        </div>
        {writingSync?.updatedAt && (
          <div className="flex gap-2">
            <span className="text-muted-foreground w-28">Last Updated</span>
            <span>{new Date(writingSync.updatedAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GscSitemapPanel({ siteId, apiKey }: { siteId: string; apiKey: string }) {
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`/api/sites/${siteId}/gsc/sitemap`, {}, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data as {
        ok: boolean;
        error?: string;
        hint?: string;
        domain?: string;
        submitted?: string[];
        errors?: { url: string; message: string }[];
        detail?: string;
      };
    },
  });

  const data = submitMutation.data;

  return (
    <div className="bg-white p-4 rounded-lg border space-y-4">
      <h3 className="font-medium">Google Search Console — Submit Sitemap</h3>
      <p className="text-sm text-muted-foreground">
        Submit this site's sitemap index and nested sitemaps (sitemap.xml, sitemap-posts.xml, sitemap-pages.xml, sitemap-taxonomies.xml) to GSC for indexing.
      </p>
      <Button
        type="button"
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending}
      >
        {submitMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        Submit to Google Search Console
      </Button>
      {data && (
        <div className={`rounded-lg border p-3 text-sm ${data.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {data.ok ? (
            <>
              <p className="font-medium">Submitted {data.submitted?.length ?? 0} sitemaps</p>
              {data.domain && <p className="text-green-700">Domain: {data.domain}</p>}
              {data.submitted && data.submitted.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-green-700">
                  {data.submitted.map((url) => (
                    <li key={url}>{url}</li>
                  ))}
                </ul>
              )}
              {data.errors && data.errors.length > 0 && (
                <p className="mt-2 text-amber-700">Partial failures: {data.errors.map((e) => e.url).join(', ')}</p>
              )}
            </>
          ) : (
            <>
              <p className="font-medium">{data.error}</p>
              {data.hint && <p className="mt-1">{data.hint}</p>}
              {data.detail && <p className="mt-1 text-amber-700">{data.detail}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { apiKey, siteId } = useStore();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<Partial<SiteConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch Config
  const { data: fetchedConfig, isLoading } = useQuery({
    queryKey: ['config', siteId],
    queryFn: async () => {
      const res = await axios.get(`/api/config?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data.config as SiteConfig;
    },
    enabled: !!siteId,
  });

  // Fetch writing sync (projectId, lastJobId)
  const { data: writingSync } = useQuery({
    queryKey: ['writing-sync', siteId],
    queryFn: async () => {
      const res = await axios.get(`/api/writing-sync?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data as { siteId: string; projectId: string | null; lastJobId: string | null; updatedAt: string | null };
    },
    enabled: !!siteId && !!apiKey,
  });

  useEffect(() => {
    if (fetchedConfig) {
      setConfig(fetchedConfig);
      setHasChanges(false);
    }
  }, [fetchedConfig]);

  // Save Config
  const saveMutation = useMutation({
    mutationFn: async (newConfig: Partial<SiteConfig>) => {
      const res = await axios.put(`/api/config?siteId=${siteId}`, newConfig, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data as { success?: boolean; warning?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['config', siteId] });
      setHasChanges(false);
      if (data?.warning) {
        alert(data.warning);
      }
    },
  });

  const handleUpdate = (newValues: Partial<SiteConfig>) => {
    setConfig(newValues);
    setHasChanges(true);
  };

  if (isLoading) return <div className="p-8 flex justify-center">{/* @ts-expect-error Lucide Icon type mismatch */}<Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <Button 
          onClick={() => saveMutation.mutate(config)} 
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending && 
            // @ts-expect-error Lucide Icon type mismatch
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          }
          {/* @ts-expect-error Lucide Icon type mismatch */}
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        {/* @ts-expect-error Radix Primitive type mismatch */}
        <TabsList variant="line" className="w-full justify-start border-b rounded-none p-0 h-auto">
          {/* @ts-expect-error Radix Primitive type mismatch */}
          <TabsTrigger value="general" className="rounded-none shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent px-4 py-2">General</TabsTrigger>
          {/* @ts-expect-error Radix Primitive type mismatch */}
          <TabsTrigger value="store" className="rounded-none shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent px-4 py-2">Store</TabsTrigger>
          {/* @ts-expect-error Radix Primitive type mismatch */}
          <TabsTrigger value="navigation" className="rounded-none shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent px-4 py-2">Navigation</TabsTrigger>
          {/* @ts-expect-error Radix Primitive type mismatch */}
          <TabsTrigger value="publish-sync" className="rounded-none shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent px-4 py-2">Publish & Sync</TabsTrigger>
          {/* @ts-expect-error Radix Primitive type mismatch */}
          <TabsTrigger value="gsc-sitemap" className="rounded-none shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent px-4 py-2">GSC Sitemap</TabsTrigger>
          {/* @ts-expect-error Radix Primitive type mismatch */}
          <TabsTrigger value="maintenance" className="rounded-none shadow-none data-[state=active]:shadow-none data-[state=active]:bg-transparent px-4 py-2">Maintenance</TabsTrigger>
        </TabsList>
        
        {/* @ts-expect-error Radix Primitive type mismatch */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <GeneralSettingsForm 
            config={config as SiteConfig} 
            onChange={(c) => handleUpdate(c)} 
          />
        </TabsContent>

        {/* @ts-expect-error Radix Primitive type mismatch */}
        <TabsContent value="store" className="mt-4 space-y-4">
          <StoreSettings siteId={siteId} apiKey={apiKey} />
        </TabsContent>
        
        {/* @ts-expect-error Radix Primitive type mismatch */}
        <TabsContent value="navigation" className="mt-4 space-y-4">
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-medium mb-4">Main Menu</h3>
            <NavigationEditor 
              items={config.nav || []} 
              onChange={(items) => handleUpdate({ ...config, nav: items })} 
            />
          </div>
        </TabsContent>

        {/* @ts-expect-error Radix Primitive type mismatch */}
        <TabsContent value="publish-sync" className="mt-4 space-y-6">
          <div className="bg-white p-4 rounded-lg border space-y-4">
            <h3 className="font-medium">Writing Sync</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Writing Sync</p>
                <p className="text-xs text-muted-foreground">When enabled, the cron job will sync completed writing tasks from the Article Writing API to this site.</p>
              </div>
              <Switch
                checked={config.writingSyncEnabled !== false}
                onCheckedChange={(checked) => handleUpdate({ ...config, writingSyncEnabled: checked })}
              />
            </div>
          </div>
          <WritingSyncPanel
            siteId={siteId ?? ''}
            apiKey={apiKey ?? ''}
            writingSync={writingSync}
            onRefetch={() => queryClient.invalidateQueries({ queryKey: ['writing-sync', siteId] })}
          />
          <ScheduledPublishForm
            config={config as SiteConfig}
            onChange={(c) => handleUpdate(c)}
          />
        </TabsContent>

        {/* @ts-expect-error Radix Primitive type mismatch */}
        <TabsContent value="gsc-sitemap" className="mt-4 space-y-4">
          <GscSitemapPanel siteId={siteId ?? ''} apiKey={apiKey ?? ''} />
        </TabsContent>

        {/* @ts-expect-error Radix Primitive type mismatch */}
        <TabsContent value="maintenance" className="mt-4">
           {/* Reuse the Rebuild Button logic */}
           <RebuildButton />
        </TabsContent>
      </Tabs>
    </div>
  );
}
