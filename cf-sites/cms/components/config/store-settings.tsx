'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { SiteSettings } from '@/lib/settings-d1';
import { GLOBAL_SITE_ID } from '@/lib/settings-d1';

function CreateSalesChannelButton({
  siteId,
  apiKey,
  onSuccess,
  onError,
}: {
  siteId: string;
  apiKey?: string | null;
  onSuccess: (result: { publishableKeyCreated?: boolean }) => void;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(siteId)}/sales-channel`, {
        method: 'POST',
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; publishableKeyCreated?: boolean };
      if (!res.ok) {
        onError(data?.error || res.statusText || 'Request failed');
        return;
      }
      onSuccess({ publishableKeyCreated: data.publishableKeyCreated });
    } catch (e: any) {
      onError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCreate} disabled={loading}>
      {loading ? (
        <>
          {/* @ts-expect-error Lucide Icon type mismatch */}
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating…
        </>
      ) : (
        'Create & link sales channel'
      )}
    </Button>
  );
}

function CreatePublishableKeyButton({
  siteId,
  apiKey,
  onSuccess,
  onError,
}: {
  siteId: string;
  apiKey?: string | null;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(siteId)}/publishable-key`, {
        method: 'POST',
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onError(data?.error || res.statusText || 'Request failed');
        return;
      }
      onSuccess();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleCreate} disabled={loading}>
      {loading ? (
        <>
          {/* @ts-expect-error Lucide Icon type mismatch */}
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating…
        </>
      ) : (
        'Create & save Publishable Key via API'
      )}
    </Button>
  );
}

export function StoreSettings({ siteId, apiKey }: { siteId?: string | null; apiKey?: string | null }) {
  const effectiveSiteId = siteId || GLOBAL_SITE_ID;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const { data: settings, isLoading } = useQuery<SiteSettings>({
    queryKey: ['settings', effectiveSiteId],
    queryFn: async () => {
      const res = await fetch(`/api/settings?siteId=${encodeURIComponent(effectiveSiteId)}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
    enabled: !!effectiveSiteId,
  });

  const updateMutation = useMutation({
    mutationFn: async (newSettings: Partial<SiteSettings>) => {
      const res = await fetch(`/api/settings?siteId=${encodeURIComponent(effectiveSiteId)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', effectiveSiteId] });
      toast({
        title: 'Settings saved',
        description: 'Store configuration updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save settings.',
        variant: 'destructive',
      });
    },
  });

  const [localStore, setLocalStore] = useState(settings?.store);

  useEffect(() => {
    if (settings?.store) {
      setLocalStore(settings.store);
    }
  }, [settings]);

  const handleSave = () => {
    if (localStore) {
      updateMutation.mutate({ store: localStore });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        {/* @ts-expect-error Lucide Icon type mismatch with React */}
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ecommerce Configuration</CardTitle>
        <CardDescription>Control store visibility and payment methods.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            {/* @ts-expect-error Radix Primitive type mismatch */}
            <Label htmlFor="store-enabled" className="text-base">Enable Storefront</Label>
            <p className="text-sm text-muted-foreground">
              Turn this off to put the store in maintenance mode.
            </p>
          </div>
          {/* @ts-expect-error Radix Primitive type mismatch */}
          <Switch
            id="store-enabled"
            checked={localStore?.enabled ?? false}
            onCheckedChange={(checked) =>
              setLocalStore((prev) => prev ? { ...prev, enabled: checked } : undefined)
            }
          />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Sales channel</h3>
          {localStore?.medusaSalesChannelId ? (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              Linked: <span className="font-mono">{localStore.medusaSalesChannelId}</span>
              <p className="mt-1">Created in Medusa and linked when this site was set up. Orders and products are scoped to this channel.</p>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm">
              <p className="text-muted-foreground mb-2">No sales channel linked. Link one so orders and products are scoped to this site.</p>
              <CreateSalesChannelButton
                siteId={effectiveSiteId}
                apiKey={apiKey}
                onSuccess={({ publishableKeyCreated }) => {
                  queryClient.invalidateQueries({ queryKey: ['settings', effectiveSiteId] });
                  toast({
                    title: 'Sales channel linked',
                    description: publishableKeyCreated
                      ? 'Sales channel and Publishable Key were created in Medusa and saved.'
                      : 'Sales channel was created in Medusa and linked. You can create a Publishable Key below if needed.',
                  });
                }}
                onError={(msg) => toast({ title: 'Failed to create channel', description: msg, variant: 'destructive' })}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          {/* @ts-expect-error Radix Primitive type mismatch */}
          <Label htmlFor="medusa-pk">Publishable API Key (storefront)</Label>
          <Input
            id="medusa-pk"
            type="password"
            autoComplete="off"
            placeholder="pk_..."
            value={localStore?.medusaPublishableKey ?? ''}
            onChange={(e) =>
              setLocalStore((prev) =>
                prev ? { ...prev, medusaPublishableKey: e.target.value.trim() || undefined } : prev
              )
            }
            className="font-mono text-sm"
          />
          <p className="text-[0.8rem] text-muted-foreground">
            One per site. Used by the storefront to scope requests to this site&apos;s sales channel.
          </p>
          {localStore?.medusaSalesChannelId && !localStore?.medusaPublishableKey && (
            <CreatePublishableKeyButton
              siteId={effectiveSiteId}
              apiKey={apiKey}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['settings', effectiveSiteId] });
                toast({ title: 'Publishable key created', description: 'Key was created in Medusa, linked to this site, and saved.' });
              }}
              onError={(msg) => toast({ title: 'Failed to create key', description: msg, variant: 'destructive' })}
            />
          )}
        </div>

        {/* @ts-expect-error Radix Primitive type mismatch */}
        <Separator />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Payment Methods</h3>
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              {/* @ts-expect-error Radix Primitive type mismatch */}
              <Label htmlFor="cod-enabled">Cash on Delivery (COD)</Label>
            </div>
            {/* @ts-expect-error Radix Primitive type mismatch */}
            <Switch
              id="cod-enabled"
              checked={localStore?.paymentMethods?.cod?.enabled ?? true}
              onCheckedChange={(checked) =>
                setLocalStore((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    paymentMethods: {
                      ...prev.paymentMethods,
                      cod: { ...prev.paymentMethods.cod, enabled: checked },
                    },
                  };
                })
              }
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && 
              // @ts-expect-error Lucide Icon type mismatch
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            }
            {/* @ts-expect-error Lucide Icon type mismatch */}
            <Save className="mr-2 h-4 w-4" />
            Save Store Config
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
