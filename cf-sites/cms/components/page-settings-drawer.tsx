'use client';

import { useState, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Settings, Image as ImageIcon, Loader2 } from "lucide-react"
import type { Post, SeoConfig } from "@/lib/types"
import { useStore } from '@/lib/store';
import axios from 'axios';

interface PageSettingsDrawerProps {
  post: Partial<Post>;
  onChange: (post: Partial<Post>) => void;
}

function coverPreviewSrc(coverImage: string | undefined, siteId: string): string {
  if (!coverImage) return '';
  if (coverImage.startsWith('/site-assets/')) {
    const key = `sites/${siteId}/assets${coverImage.replace('/site-assets', '')}`;
    return `/api/proxy?key=${encodeURIComponent(key)}`;
  }
  return coverImage;
}

export function PageSettingsDrawer({ post, onChange }: PageSettingsDrawerProps) {
  const { siteId, apiKey } = useStore();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const seo = post.seo || {};

  const handleSeoChange = (key: keyof SeoConfig, value: any) => {
    onChange({ ...post, seo: { ...seo, [key]: value } });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !siteId || !apiKey) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post<{ publicUrl?: string }>(
        `/api/assets?siteId=${siteId}`,
        formData,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (res.data?.publicUrl) {
        onChange({ ...post, coverImage: res.data.publicUrl });
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Settings & SEO
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Page Settings</SheetTitle>
          <SheetDescription>
            Configure URL, Metadata and SEO options.
          </SheetDescription>
        </SheetHeader>
        
        <div className="grid gap-6 py-6">
          {/* General Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">General</h4>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug (URL Path)</label>
              <Input 
                value={post.slug || ''} 
                onChange={(e) => onChange({ ...post, slug: e.target.value })} 
                placeholder="about-us"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Excerpt / Description</label>
              <Textarea 
                value={post.excerpt || ''} 
                onChange={(e) => onChange({ ...post, excerpt: e.target.value })} 
                rows={3}
                placeholder="Brief summary of the page."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Featured Image
              </label>
              <p className="text-xs text-muted-foreground">用于 preload 和 SEO og:image</p>
              <div className="flex gap-2">
                <Input
                  value={post.coverImage || ''}
                  onChange={(e) => onChange({ ...post, coverImage: e.target.value })}
                  placeholder="封面图 URL"
                  className="flex-1"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!siteId || uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : '上传'}
                </Button>
              </div>
              {post.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreviewSrc(post.coverImage, siteId ?? '')}
                  alt="Featured"
                  className="w-full h-20 object-cover rounded-md border bg-gray-50 mt-2"
                  onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                />
              )}
            </div>
          </div>

          {/* SEO Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">SEO & Social</h4>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Meta Title</label>
                <span className="text-xs text-muted-foreground">{(seo.title || '').length}/60</span>
              </div>
              <Input
                value={seo.title || ''}
                onChange={(e) => handleSeoChange('title', e.target.value)}
                placeholder="Custom title for search engines"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Meta Description</label>
                <span className="text-xs text-muted-foreground">{(seo.description || '').length}/160</span>
              </div>
              <Textarea
                value={seo.description || ''}
                onChange={(e) => handleSeoChange('description', e.target.value)}
                placeholder="Custom description for search results"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Canonical URL</label>
              <Input
                value={seo.canonical || ''}
                onChange={(e) => handleSeoChange('canonical', e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">OG Image URL</label>
              <Input
                value={seo.ogImage || ''}
                onChange={(e) => handleSeoChange('ogImage', e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="noindex"
                checked={seo.noindex || false}
                onChange={(e) => handleSeoChange('noindex', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="noindex" className="text-sm font-medium">
                Noindex (Hide from search engines)
              </label>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
