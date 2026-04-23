'use client';

export const runtime = 'edge';

import { useStore } from '@/lib/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import type { Post } from '@/lib/types';
import { ArrowLeft, Loader2, Eye } from 'lucide-react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageSettingsDrawer } from '@/components/page-settings-drawer';

export default function EditPagePage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>('');
  
  useEffect(() => {
    params.then(p => setSlug(p.slug));
  }, [params]);

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

  // Fetch Site Config and base URL (from bound domain) for Custom CSS and Preview
  const { data: configData } = useQuery({
    queryKey: ['config', siteId],
    queryFn: async () => {
      const res = await axios.get(`/api/config?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data as { config: typeof res.data.config; siteBaseUrl?: string };
    },
    enabled: !!siteId,
  });
  const config = configData?.config;
  const siteBaseUrl = configData?.siteBaseUrl ?? config?.url ?? '';

  const { data: fetchedPost, isLoading } = useQuery({
    queryKey: ['page', siteId, slug],
    queryFn: async () => {
      const res = await axios.get(`/api/pages/${slug}?siteId=${siteId}`, {
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
      const url = isNew ? `/api/pages?siteId=${siteId}` : `/api/pages/${slug}?siteId=${siteId}`;
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
      router.push('/site-pages');
    },
  });

  if (isLoading || !slug) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  // Construct Preview HTML (prefer bound domain from API, fallback to legacy config.url)
  const siteUrl = siteBaseUrl ? siteBaseUrl.replace(/\/$/, '') + '/' : '';
  
  const previewHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${siteUrl ? `<base href="${siteUrl}">` : ''}
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 1rem; }
          /* Reset basics */
          * { box-sizing: border-box; }
          /* Inject Custom CSS from Config */
          ${config?.customCss || ''}
        </style>
        <!-- Optional: Inject Tailwind CDN if user uses it, though customCss is preferred -->
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>
        ${post.content || ''}
      </body>
    </html>
  `;

  const previewUrl = siteUrl && post.slug ? `${siteUrl}${post.slug}` : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/site-pages">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{isNew ? 'New Page' : 'Edit Page'}</h1>
        </div>
        <div className="flex items-center gap-2">
           {previewUrl && (
             <Button variant="ghost" asChild>
               <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                 <Eye className="mr-2 h-4 w-4" />
                 Open Link
               </a>
             </Button>
           )}
           <PageSettingsDrawer post={post} onChange={setPost} />
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

      <div className="w-full">
        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="edit">Edit HTML</TabsTrigger>
            <TabsTrigger value="preview">Live Preview</TabsTrigger>
          </TabsList>
          
          <TabsContent value="edit">
            <div className="space-y-4">
              <Input
                placeholder="Page Title"
                className="text-xl font-bold h-12"
                value={post.title}
                onChange={(e) => setPost({ ...post, title: e.target.value })}
              />
              <div className="border rounded-md overflow-hidden bg-gray-50">
                <div className="bg-gray-100 px-4 py-2 border-b text-xs text-gray-500 flex justify-between">
                  <span>HTML Source</span>
                  <span>{post.content?.length || 0} chars</span>
                </div>
                <Textarea
                  className="font-mono text-sm min-h-[600px] border-none focus-visible:ring-0 p-4"
                  value={post.content || ''}
                  onChange={(e) => setPost({ ...post, content: e.target.value })}
                  placeholder="<html><body><h1>Hello World</h1></body></html>"
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview">
            {!siteUrl && (
              <div className="bg-yellow-100 text-yellow-800 p-2 text-xs mb-2 rounded border border-yellow-200">
                Warning: "Site URL" is not set in Settings. Relative images and links may break.
              </div>
            )}
            <div className="border rounded-md overflow-hidden bg-white h-[700px] shadow-sm">
              <div className="bg-gray-100 px-4 py-2 border-b text-xs text-gray-500 flex justify-between items-center">
                <span>Preview Frame</span>
                <span className="bg-blue-100 text-blue-800 px-2 rounded">Applied Custom CSS</span>
              </div>
              <iframe 
                srcDoc={previewHtml} 
                className="w-full h-full border-none bg-white" 
                title="Page Preview"
                sandbox="allow-scripts allow-same-origin" 
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
