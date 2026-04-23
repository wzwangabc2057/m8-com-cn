'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import type { Post } from '@/lib/types';
import { ArrowLeft } from 'lucide-react';
import { SeoSettings } from './seo-settings';

interface PostEditorProps {
  slug?: string;
  onBack: () => void;
}

export function PostEditor({ slug, onBack }: PostEditorProps) {
  const { apiKey, siteId } = useStore();
  const queryClient = useQueryClient();
  const isNew = !slug;

  const [form, setForm] = useState<Partial<Post>>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    author: '',
    categories: [],
    tags: [],
    seo: {},
  });

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', siteId, slug],
    queryFn: async () => {
      const res = await axios.get(`/api/posts/${slug}?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data.post as Post;
    },
    enabled: !!siteId && !isNew,
  });

  useEffect(() => {
    if (post) {
      setForm(post);
    }
  }, [post]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Post>) => {
      const url = isNew ? `/api/posts?siteId=${siteId}` : `/api/posts/${slug}?siteId=${siteId}`;
      const method = isNew ? 'POST' : 'PUT';
      
      // Ensure required fields
      const payload = {
        ...data,
        publishedAt: data.publishedAt || new Date().toISOString(),
        categories: Array.isArray(data.categories) ? data.categories : [],
        tags: Array.isArray(data.tags) ? data.tags : [],
      };

      await axios(url, {
        method,
        headers: { Authorization: `Bearer ${apiKey}` },
        data: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', siteId] });
      onBack();
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={onBack} size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-bold">{isNew ? 'New Post' : 'Edit Post'}</h2>
        <div className="flex-1" />
        <SeoSettings
          seo={form.seo}
          onChange={(seo) => setForm({ ...form, seo })}
        />
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input 
              value={form.title} 
              onChange={(e) => setForm({ ...form, title: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Slug</label>
            <Input 
              value={form.slug} 
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              disabled={!isNew}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Excerpt</label>
          <Textarea 
            value={form.excerpt} 
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })} 
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Content (HTML/Markdown)</label>
          <Textarea 
            value={form.content} 
            onChange={(e) => setForm({ ...form, content: e.target.value })} 
            className="font-mono min-h-[400px]"
          />
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onBack}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
