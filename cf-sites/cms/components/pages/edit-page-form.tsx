'use client';

import { useStore } from '@/lib/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { useState, useEffect, useRef } from 'react';
import type { Post } from '@/lib/types';
import { ArrowLeft, Loader2, Image as ImageIcon } from 'lucide-react';

/** Resolve cover image src for preview in CMS: /site-assets/... -> proxy URL */
function coverPreviewSrc(coverImage: string | undefined, siteId: string): string {
  if (!coverImage) return '';
  if (coverImage.startsWith('/site-assets/')) {
    const key = `sites/${siteId}/assets${coverImage.replace('/site-assets', '')}`;
    return `/api/proxy?key=${encodeURIComponent(key)}`;
  }
  return coverImage;
}
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function EditPageForm({ slug }: { slug: string }) {
  const router = useRouter();
  const { apiKey, siteId } = useStore();
  const queryClient = useQueryClient();
  
  const isNew = slug === 'new';

  const [post, setPost] = useState<Partial<Post>>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    status: 'draft',
    type: 'page',
  });

  const { data: fetchedPost, isLoading } = useQuery({
    queryKey: ['page', siteId, slug],
    queryFn: async () => {
      const res = await axios.get(`/api/posts/${slug}?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data.post as Post;
    },
    enabled: !!siteId && !!slug && !isNew,
  });

  useEffect(() => {
    if (fetchedPost) {
      setPost(fetchedPost);
    }
  }, [fetchedPost]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Post>) => {
      const url = isNew ? `/api/posts?siteId=${siteId}` : `/api/posts/${slug}?siteId=${siteId}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const payload = {
        ...data,
        type: 'page',
        slug: data.slug || data.title?.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '') || 'untitled',
        publishedAt: data.publishedAt || new Date().toISOString(),
      };

      await axios(url, {
        method,
        headers: { Authorization: `Bearer ${apiKey}` },
        data: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', siteId] });
      router.push('/pages');
    },
  });

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`/api/assets?siteId=${siteId}`, formData, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.data.publicUrl || res.data.url;
  };

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !siteId || !apiKey) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post<{ success?: boolean; publicUrl?: string }>(
        `/api/assets?siteId=${siteId}`,
        formData,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      if (res.data?.publicUrl) {
        setPost((prev) => ({ ...prev, coverImage: res.data!.publicUrl }));
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const previewSrc = coverPreviewSrc(post.coverImage, siteId ?? '');

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/pages">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{isNew ? 'New Page' : 'Edit Page'}</h1>
        </div>
        <div className="flex items-center gap-2">
           <Select 
             value={post.status || 'draft'} 
             onValueChange={(val) => setPost({ ...post, status: val as any })}
           >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => saveMutation.mutate(post)} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Page
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="Page Title"
              className="text-xl font-bold h-12"
              value={post.title}
              onChange={(e) => setPost({ ...post, title: e.target.value })}
            />
          </div>
          
          <TiptapEditor 
            value={post.content || ''} 
            onChange={(content) => setPost({ ...post, content })}
            onImageUpload={handleImageUpload}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg border space-y-4">
            <h3 className="font-medium">Page Settings</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug</label>
              <Input 
                value={post.slug} 
                onChange={(e) => setPost({ ...post, slug: e.target.value })}
                placeholder="about" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (SEO)</label>
              <Textarea 
                value={post.excerpt} 
                onChange={(e) => setPost({ ...post, excerpt: e.target.value })}
                rows={3}
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
                  onChange={(e) => setPost({ ...post, coverImage: e.target.value })}
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
                  src={previewSrc}
                  alt="Featured"
                  className="w-full h-24 object-cover rounded-md border bg-gray-50 mt-2"
                  onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
