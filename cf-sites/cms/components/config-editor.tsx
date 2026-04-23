'use client';

import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function ConfigEditor() {
  const { siteId, apiKey } = useStore();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleRebuild = async () => {
    if (!confirm('This will rescan all posts from R2 and rebuild the D1 database index. Continue?')) return;
    
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/rebuild?siteId=${siteId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${apiKey}` 
        },
      });
      const data = await res.json() as any;
      if (data.success) {
        setMsg(`Success! Scanned ${data.scanned} files, indexed ${data.indexed} posts.`);
      } else {
        setMsg(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!siteId) return <div>Please select a site to manage configuration.</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Maintenance</h2>
        <div className="flex items-center gap-4">
          <Button onClick={handleRebuild} disabled={loading}>
            {loading ? 'Rebuilding...' : 'Rebuild Index (Sync R2 → D1)'}
          </Button>
          {msg && <span className="text-sm text-gray-600">{msg}</span>}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Use this if your post list looks empty or out of sync with your files.
        </p>
      </div>
    </div>
  );
}
