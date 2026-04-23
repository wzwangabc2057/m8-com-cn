'use client';

import { MetaManager } from '@/components/meta-manager';

export default function TagsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
        <p className="text-muted-foreground mt-1">
          Manage post tags. Synced from migration or added manually.
        </p>
      </div>
      <MetaManager type="tags" />
    </div>
  );
}
