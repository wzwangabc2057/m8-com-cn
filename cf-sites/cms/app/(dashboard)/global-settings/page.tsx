'use client';

import { useStore } from '@/lib/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MedusaSettingsForm } from '@/components/config/medusa-form';
import { ResetPasswordForm } from '@/components/config/reset-password-form';
import { Loader2, Save } from 'lucide-react';
import type { SiteConfig } from '@/lib/types';
import type { PlatformSettings } from '@/lib/platform-settings-d1';

export default function GlobalSettingsPage() {
  const { apiKey } = useStore();
  const queryClient = useQueryClient();
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: fetched, isLoading } = useQuery({
    queryKey: ['global-settings'],
    queryFn: async () => {
      const res = await axios.get('/api/global-settings', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data as PlatformSettings;
    },
    enabled: !!apiKey,
  });

  useEffect(() => {
    if (fetched) {
      setPlatformSettings(fetched);
      setHasChanges(false);
    }
  }, [fetched]);

  const saveMutation = useMutation({
    mutationFn: async (settings: Partial<PlatformSettings>) => {
      await axios.put('/api/global-settings', settings, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-settings'] });
      setHasChanges(false);
    },
  });

  const handleMedusaChange = (config: SiteConfig) => {
    setPlatformSettings((prev) => (prev ? { ...prev, medusa: config.medusa } : { updatedAt: '', medusa: config.medusa }));
    setHasChanges(true);
  };

  if (isLoading || !platformSettings) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const configForForm: SiteConfig = {
    name: '',
    description: '',
    language: 'zh-CN',
    postsPerPage: 10,
    nav: [],
    medusa: platformSettings.medusa,
  };

  const effectiveBackendUrl = (fetched as { effectiveMedusaBackendUrl?: string })?.effectiveMedusaBackendUrl ?? '';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Global Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Platform-wide configuration. Applies to all sites.
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(platformSettings)}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <MedusaSettingsForm
        config={configForForm}
        onChange={handleMedusaChange}
        effectiveBackendUrl={effectiveBackendUrl}
      />

      <ResetPasswordForm />
    </div>
  );
}
