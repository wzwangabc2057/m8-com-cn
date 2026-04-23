'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SiteInfo {
  siteId: string;
  name: string;
  displayName?: string;
  disabled?: boolean;
}

export function SiteSwitcher() {
  const { apiKey, siteId, setSiteId } = useStore();

  const { data: sites, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await axios.get('/api/sites', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data.sites as SiteInfo[];
    },
    enabled: !!apiKey,
  });

  const sitesFiltered = (sites ?? []).filter((s) => s.siteId !== 'default' && !s.disabled);

  // Auto-select the first site if none is selected (excluding hidden default)
  useEffect(() => {
    if (!siteId && sites && sites.length > 0) {
      const first = sites.find((s) => s.siteId !== 'default' && !s.disabled);
      if (first) setSiteId(first.siteId);
    }
  }, [sites, siteId, setSiteId]);

  if (isLoading) return <div>Loading sites...</div>;

  return (
    <Select value={siteId || ''} onValueChange={setSiteId}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a site" />
      </SelectTrigger>
      <SelectContent>
        {sitesFiltered.map((site) => (
          <SelectItem key={site.siteId} value={site.siteId}>
            {site.displayName || site.name || site.siteId}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
