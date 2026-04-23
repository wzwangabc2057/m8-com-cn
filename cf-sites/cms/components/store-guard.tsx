'use client';

import { useStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Settings, Store } from 'lucide-react';
import { GLOBAL_SITE_ID } from '@/lib/settings-d1';

/**
 * Renders children only when the current site has a linked sales channel.
 * Otherwise shows a message to enable e-commerce in Settings.
 */
export function StoreGuard({ children }: { children: React.ReactNode }) {
  const { apiKey, siteId } = useStore();
  const effectiveSiteId = siteId || GLOBAL_SITE_ID;

  const { data: settings } = useQuery({
    queryKey: ['settings', effectiveSiteId],
    queryFn: async () => {
      const res = await fetch(`/api/settings?siteId=${encodeURIComponent(effectiveSiteId)}`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<{ store?: { medusaSalesChannelId?: string } }>;
    },
    enabled: !!effectiveSiteId,
  });

  const hasChannel = !!settings?.store?.medusaSalesChannelId;

  if (hasChannel) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-10 text-center max-w-md mx-auto mt-12">
      <Store className="h-12 w-12 text-amber-600 dark:text-amber-500 mb-4" />
      <h2 className="text-lg font-semibold mb-2">电商模块未启用</h2>
      <p className="text-sm text-muted-foreground mb-6">
        当前站点未关联销售渠道。请先在 Settings → Ecommerce 中「Create & link sales channel」后再使用订单、商品等功能。
      </p>
      <Button asChild>
        <Link href="/settings" className="gap-2">
          <Settings className="h-4 w-4" />
          前往设置
        </Link>
      </Button>
    </div>
  );
}
