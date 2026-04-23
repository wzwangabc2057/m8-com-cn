'use client';

import { MetaManager } from '@/components/meta-manager';

export default function AuthorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Authors</h1>
        <p className="text-muted-foreground mt-1">
          Manage authors for blog posts. Synced from migration or added manually.
        </p>
      </div>
      <MetaManager type="authors" />
    </div>
  );
}
