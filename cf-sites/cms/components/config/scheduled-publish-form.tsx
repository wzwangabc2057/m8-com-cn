'use client';

import { SiteConfig } from '@/lib/types';
import { Input } from '@/components/ui/input';

const DEFAULT_POSTS_PER_DAY = 10;

export function ScheduledPublishForm({
  config,
  onChange,
}: {
  config: SiteConfig;
  onChange: (c: SiteConfig) => void;
}) {
  const publish = (config as { publish?: { postsPerDay?: number } }).publish;
  const postsPerDay = publish?.postsPerDay ?? DEFAULT_POSTS_PER_DAY;

  const setPostsPerDay = (value: number) => {
    const next = Math.max(0, Math.min(999, value));
    onChange({
      ...config,
      publish: { ...publish, postsPerDay: next },
    } as SiteConfig);
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-background">
      <h3 className="font-medium">Scheduled Publish</h3>
      <p className="text-sm text-muted-foreground">
        The scheduled job will automatically publish up to <strong>N</strong> drafts daily, ordered by &quot;updated time ascending&quot;. Requires configuring Cloudflare Pages or external Cron to call <code className="text-xs bg-muted px-1 rounded">/api/cron/scheduled-publish</code> with <code className="text-xs bg-muted px-1 rounded">CRON_SECRET</code>.
      </p>
      <div className="space-y-2">
        <label className="text-sm font-medium">Daily Publish Count</label>
        <Input
          type="number"
          min={0}
          max={999}
          value={postsPerDay}
          onChange={(e) => setPostsPerDay(parseInt(e.target.value, 10) || 0)}
        />
        <p className="text-xs text-muted-foreground">
          Default {DEFAULT_POSTS_PER_DAY} posts. Set to 0 to disable scheduled publishing for this site.
        </p>
      </div>
    </div>
  );
}
