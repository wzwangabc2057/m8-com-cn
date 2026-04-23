
'use client';

export const runtime = 'edge';

import { useStore } from '@/lib/store';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { useState, useEffect, useRef } from 'react';
import type { Post } from '@/lib/types';
import { ArrowLeft, Loader2, Save, Calendar, User, Tag, Globe, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

/** Resolve cover image src for preview in CMS: /site-assets/... -> proxy URL */
function coverPreviewSrc(coverImage: string | undefined, siteId: string): string {
  if (!coverImage) return '';
  if (coverImage.startsWith('/site-assets/')) {
    const key = `sites/${siteId}/assets${coverImage.replace('/site-assets', '')}`;
    return `/api/proxy?key=${encodeURIComponent(key)}`;
  }
  return coverImage;
}

function MediaBlock({
  post,
  setPost,
  siteId,
  apiKey,
}: {
  post: Partial<Post>;
  setPost: (p: Partial<Post> | ((prev: Partial<Post>) => Partial<Post>)) => void;
  siteId: string;
  apiKey: string;
}) {
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

  const previewSrc = coverPreviewSrc(post.coverImage, siteId);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
        <ImageIcon className="h-4 w-4" /> Media
      </h3>
      <div className="bg-white p-3 rounded-lg border shadow-sm">
        <div className="grid gap-2">
          <div className="flex gap-2">
            <Input
              value={post.coverImage || ''}
              onChange={(e) => setPost({ ...post, coverImage: e.target.value })}
              placeholder="Cover Image URL"
              className="h-8 text-sm flex-1"
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
              className="h-8 shrink-0"
              disabled={!siteId || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
            </Button>
          </div>
          {post.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt="Cover"
              className="w-full h-32 object-cover rounded-md border bg-gray-50"
              onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function EditPostPage({ params }: { params: Promise<{ slug: string }> }) {
  // In Next.js 15, params is a Promise
  const [slug, setSlug] = useState<string>('');
  
  useEffect(() => {
    params.then(p => setSlug(p.slug));
  }, [params]);

  const router = useRouter();
  const { apiKey, siteId } = useStore();
  const queryClient = useQueryClient();
  
  const isNew = slug === 'new';

  // Local state for form
  const [post, setPost] = useState<Partial<Post>>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    status: 'draft',
    type: 'post',
    author: '',
    categories: [],
    tags: [],
    seo: {
      title: '',
      description: '',
    }
  });

  // Fetch post data
  const { data: fetchedPost, isLoading } = useQuery({
    queryKey: ['post', siteId, slug],
    queryFn: async () => {
      const res = await axios.get(`/api/posts/${slug}?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data.post as Post;
    },
    enabled: !!siteId && !!slug && !isNew,
  });

  // Sync fetched data
  useEffect(() => {
    if (fetchedPost) {
      setPost({
        ...fetchedPost,
        // Ensure arrays are initialized
        categories: fetchedPost.categories || [],
        tags: fetchedPost.tags || [],
        seo: fetchedPost.seo || { title: '', description: '' },
      });
    }
  }, [fetchedPost]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Post>) => {
      const url = isNew ? `/api/posts?siteId=${siteId}` : `/api/posts/${slug}?siteId=${siteId}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const payload = {
        ...data,
        // Auto-generate slug from title if missing
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
      if (isNew) {
        router.push('/posts');
      } else {
        // Optional: show toast
      }
    },
  });

  // Image upload handler for Tiptap
  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`/api/assets?siteId=${siteId}`, formData, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.data.publicUrl || res.data.url; // Use clean /site-assets/ URL
  };

  if (isLoading || !slug) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden -m-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white border-b px-6 py-3 flex-shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/posts">
            <Button variant="ghost" size="icon" className="-ml-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex flex-col">
             <span className="text-sm font-semibold">
               {isNew ? 'New Post' : 'Edit Post'}
             </span>
             <span className="text-xs text-muted-foreground flex items-center gap-1">
               {post.status === 'published' ? <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> : post.status === 'archived' ? <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> : <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
               {post.status === 'published' ? 'Published' : post.status === 'archived' ? 'Archived' : 'Draft'}
             </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => saveMutation.mutate(post)} disabled={saveMutation.isPending} size="sm">
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Editor (Scrollable) */}
        <div className="flex-1 overflow-y-auto relative bg-white">
          <div className="max-w-3xl mx-auto py-10 px-8 min-h-full">
             <Input
               placeholder="Post Title"
               className="text-3xl font-bold h-auto px-0 border-none shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40 mb-4"
               value={post.title}
               onChange={(e) => setPost({ ...post, title: e.target.value })}
             />
             <TiptapEditor 
               value={post.content || ''} 
               onChange={(content) => setPost({ ...post, content })}
               onImageUpload={handleImageUpload}
               siteId={siteId ?? undefined}
             />
          </div>
        </div>

        {/* Right Column: Meta (Scrollable, Fixed Width) */}
        <div className="w-[350px] border-l bg-gray-50/50 overflow-y-auto p-6 flex-shrink-0 custom-scrollbar hidden lg:block">
          <div className="space-y-6">
            {/* Publishing */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" /> Publishing
              </h3>
              <div className="grid gap-3 bg-white p-3 rounded-lg border shadow-sm">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select 
                    value={post.status || 'draft'} 
                    onValueChange={(val) => setPost({ ...post, status: val as any })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived（下线，不参与定时发布）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Slug</Label>
                  <Input 
                    value={post.slug} 
                    onChange={(e) => setPost({ ...post, slug: e.target.value })}
                    placeholder="url-slug" 
                    className="h-8 text-sm"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Author</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={post.author || ''} 
                      onChange={(e) => setPost({ ...post, author: e.target.value })}
                      placeholder="Author Name"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input 
                    type="datetime-local"
                    value={post.publishedAt ? post.publishedAt.slice(0, 16) : ''}
                    onChange={(e) => setPost({ ...post, publishedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Taxonomy */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Tag className="h-4 w-4" /> Taxonomy
              </h3>
              <div className="grid gap-3 bg-white p-3 rounded-lg border shadow-sm">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Categories</Label>
                  <Input 
                    value={post.categories?.join(', ') || ''} 
                    onChange={(e) => setPost({ ...post, categories: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Tech, News"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Tags</Label>
                  <Input 
                    value={post.tags?.join(', ') || ''} 
                    onChange={(e) => setPost({ ...post, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="react, nextjs"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Media */}
            <MediaBlock
              post={post}
              setPost={setPost}
              siteId={siteId ?? ''}
              apiKey={apiKey ?? ''}
            />

            {/* Excerpt */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Excerpt</h3>
              <div className="bg-white p-3 rounded-lg border shadow-sm">
                <Textarea 
                  value={post.excerpt} 
                  onChange={(e) => setPost({ ...post, excerpt: e.target.value })}
                  rows={3}
                  placeholder="Summary..."
                  className="min-h-[80px] text-sm resize-none"
                />
              </div>
            </div>

            {/* SEO */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">SEO</h3>
              <div className="grid gap-3 bg-white p-3 rounded-lg border shadow-sm">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Meta Title</Label>
                  <Input 
                    value={post.seo?.title || ''} 
                    onChange={(e) => setPost({ ...post, seo: { ...post.seo, title: e.target.value } })}
                    placeholder="SEO Title"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Meta Description</Label>
                  <Textarea 
                    value={post.seo?.description || ''} 
                    onChange={(e) => setPost({ ...post, seo: { ...post.seo, description: e.target.value } })}
                    rows={2}
                    placeholder="SEO Description"
                    className="min-h-[60px] text-sm resize-none"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
