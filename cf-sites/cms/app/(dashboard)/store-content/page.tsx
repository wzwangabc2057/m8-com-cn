'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import axios from 'axios';
import { StoreGuard } from '@/components/store-guard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { StoreContent, StoreContentType, StoreContentStatus } from '@/lib/types';

const typeLabels: Record<StoreContentType, string> = {
  banner: 'Banner',
  promo: 'Promo',
};
const statusLabels: Record<StoreContentStatus, string> = {
  active: 'Active',
  draft: 'Draft',
};

export default function StoreContentPage() {
  const { apiKey, siteId } = useStore();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<StoreContent | null>(null);
  const [open, setOpen] = useState(false);

  const { data: list, isLoading } = useQuery({
    queryKey: ['store-content', siteId],
    queryFn: async () => {
      const res = await axios.get(`/api/store-content?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return (res.data.items || []) as StoreContent[];
    },
    enabled: !!siteId && !!apiKey,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<StoreContent> & { title: string }) => {
      const url = payload.id
        ? `/api/store-content/${payload.id}?siteId=${siteId}`
        : `/api/store-content?siteId=${siteId}`;
      const method = payload.id ? 'PUT' : 'POST';
      await axios({
        method,
        url,
        data: payload,
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-content', siteId] });
      setOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm('Are you sure you want to delete this content?')) return;
      await axios.delete(`/api/store-content/${id}?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-content', siteId] });
    },
  });

  const openCreate = () => {
    setEditing({
      id: '',
      type: 'banner',
      title: '',
      sortOrder: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setOpen(true);
  };

  const openEdit = (row: StoreContent) => {
    setEditing({ ...row });
    setOpen(true);
  };

  if (!siteId) {
    return (
      <div className="rounded-lg border bg-card p-6 text-muted-foreground">
        Please select a site to manage Store Content.
      </div>
    );
  }

  return (
    <StoreGuard>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Store Content</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Manage homepage banners, promos, and featured content for the Storefront.
      </p>

      <div className="rounded-md border bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !list?.length ? (
          <div className="py-12 text-center text-muted-foreground">
            No content found. Click &quot;New&quot; to add Banner or Promo.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{typeLabels[item.type]}</TableCell>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {item.link || '—'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        item.status === 'active'
                          ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800'
                          : 'rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600'
                      }
                    >
                      {statusLabels[item.status]}
                    </span>
                  </TableCell>
                  <TableCell>{item.sortOrder}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit' : 'New'} Store Content</DialogTitle>
          </DialogHeader>
          {editing && (
            <StoreContentForm
              initial={editing}
              onSubmit={(data) => saveMutation.mutate(data)}
              onCancel={() => setOpen(false)}
              saving={saveMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
    </StoreGuard>
  );
}

function StoreContentForm({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial: StoreContent;
  onSubmit: (data: Partial<StoreContent> & { title: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    type: initial.type,
    title: initial.title,
    subtitle: initial.subtitle ?? '',
    link: initial.link ?? '',
    imageUrl: initial.imageUrl ?? '',
    startAt: initial.startAt ?? '',
    endAt: initial.endAt ?? '',
    sortOrder: initial.sortOrder,
    status: initial.status,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit({
      ...initial,
      ...form,
      subtitle: form.subtitle || undefined,
      link: form.link || undefined,
      imageUrl: form.imageUrl || undefined,
      startAt: form.startAt || undefined,
      endAt: form.endAt || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">Type</label>
        <Select
          value={form.type}
          onValueChange={(v) => setForm((p) => ({ ...p, type: v as StoreContentType }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="banner">Banner</SelectItem>
            <SelectItem value="promo">Promo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Title *</label>
        <Input
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="e.g. Spring Sale"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Subtitle</label>
        <Input
          value={form.subtitle}
          onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
          placeholder="Optional"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Link</label>
        <Input
          value={form.link}
          onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
          placeholder="https://..."
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1 block">Image URL</label>
        <Input
          value={form.imageUrl}
          onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
          placeholder="https://..."
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Start Time</label>
          <Input
            type="datetime-local"
            value={form.startAt ? form.startAt.slice(0, 16) : ''}
            onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">End Time</label>
          <Input
            type="datetime-local"
            value={form.endAt ? form.endAt.slice(0, 16) : ''}
            onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
          />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Sort Order</label>
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))}
          />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Status</label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm((p) => ({ ...p, status: v as StoreContentStatus }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}
