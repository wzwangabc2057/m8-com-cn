'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import axios from 'axios';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit2, Search, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { PostSummary } from '@/lib/types';
import Link from 'next/link';

const PAGE_SIZE = 20;

interface PostListProps {
  type?: 'post' | 'page';
}

export function PostList({ type = 'post' }: PostListProps) {
  const { apiKey, siteId } = useStore();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Debounce search: 300ms after user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['posts', siteId, type, page, debouncedSearch, statusFilter],
    queryFn: async () => {
      const endpoint = type === 'page' ? '/api/pages' : '/api/posts';
      const params = new URLSearchParams({
        siteId: siteId!,
        page: String(page),
        limit: String(PAGE_SIZE),
        search: debouncedSearch,
        status: statusFilter,
      });
      const res = await axios.get(`${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data as { posts?: PostSummary[]; pages?: PostSummary[]; total: number; page: number; limit: number };
    },
    enabled: !!siteId,
    placeholderData: keepPreviousData,
  });

  const items = type === 'page' ? (data?.pages || []) : (data?.posts || []);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
      const endpoint = type === 'page' ? '/api/pages' : '/api/posts';
      await axios.delete(`${endpoint}/${slug}?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', siteId, type] });
    },
  });

  // Full-page loading only on initial load; during search/filter show inline
  if (isLoading && items.length === 0) return <div className="p-8 text-center text-muted-foreground">Loading {type}s...</div>;

  const editBaseUrl = type === 'page' ? '/site-pages' : '/posts';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold capitalize tracking-tight">{type}s</h2>
        <Link href={`${editBaseUrl}/new`}>
          <Button>New {type === 'page' ? 'Page' : 'Post'}</Button>
        </Link>
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${type}s...`}
            className="pl-9 pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            autoComplete="off"
          />
          {isFetching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </form>

      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50%]">Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                  No {type}s found.
                </TableCell>
              </TableRow>
            ) : items.map((post: PostSummary) => (
              <TableRow key={post.slug}>
                <TableCell>
                  <div className="flex flex-col">
                    <Link href={`${editBaseUrl}/${post.slug}`} className="font-medium hover:underline text-base">
                      {post.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">{post.slug}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${post.status === 'published' ? 'bg-green-100 text-green-800'
                      : post.status === 'archived' ? 'bg-gray-100 text-gray-600'
                      : 'bg-yellow-100 text-yellow-800'}`}>
                    {post.status === 'archived' ? 'Archived' : (post.status || 'draft')}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`${editBaseUrl}/${post.slug}`}>
                      <Button variant="ghost" size="icon" title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(post.slug)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {total > 0
            ? `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, total)} of ${total} ${type}${total !== 1 ? 's' : ''}`
            : `No ${type}s`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
