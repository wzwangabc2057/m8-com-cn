'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { SeoConfig } from '@/lib/types';
import { Settings } from 'lucide-react';

interface SeoSettingsProps {
  seo?: SeoConfig;
  onChange: (seo: SeoConfig) => void;
}

export function SeoSettings({ seo, onChange }: SeoSettingsProps) {
  const [form, setForm] = useState<SeoConfig>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (seo) {
      setForm(seo);
    }
  }, [seo]);

  const handleSave = () => {
    onChange(form);
    setOpen(false);
  };

  const handleChange = (key: keyof SeoConfig, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          SEO Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>SEO Configuration</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Meta Title</label>
              <span className="text-xs text-muted-foreground">
                {(form.title || '').length}/60
              </span>
            </div>
            <Input
              value={form.title || ''}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Custom title for search engines"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Meta Description</label>
              <span className="text-xs text-muted-foreground">
                {(form.description || '').length}/160
              </span>
            </div>
            <Textarea
              value={form.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Custom description for search results"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Canonical URL</label>
            <Input
              value={form.canonical || ''}
              onChange={(e) => handleChange('canonical', e.target.value)}
              placeholder="https://example.com/original-post"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use the default URL.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">OG Image URL</label>
            <Input
              value={form.ogImage || ''}
              onChange={(e) => handleChange('ogImage', e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              Custom image for social sharing cards.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="noindex"
              checked={form.noindex || false}
              onChange={(e) => handleChange('noindex', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="noindex" className="text-sm font-medium">
              Noindex (Hide from search engines)
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save SEO Settings</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
