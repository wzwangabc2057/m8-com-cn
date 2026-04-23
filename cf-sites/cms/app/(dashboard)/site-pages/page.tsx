'use client';

export const runtime = 'edge';

import { PostList } from '@/components/post-list';

export default function PagesPage() {
  return (
    <div className="space-y-6">
      <PostList type="page" />
    </div>
  );
}
