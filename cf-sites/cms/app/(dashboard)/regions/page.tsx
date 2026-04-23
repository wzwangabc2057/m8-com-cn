'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import axios from 'axios';
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
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { StoreGuard } from '@/components/store-guard';

export default function RegionsPage() {
  const { apiKey } = useStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const pageSize = 20;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['medusa-regions', page, search],
    queryFn: async () => {
      const res = await axios.get('/api/medusa/regions', {
        params: { limit: pageSize, offset: page * pageSize, q: search || undefined },
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data;
    },
    enabled: !!apiKey,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm('Are you sure you want to delete this region?')) throw new Error('Cancelled');
      await axios.delete(`/api/medusa/regions/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medusa-regions'] });
      toast({ title: 'Deleted', description: 'Region deleted successfully.' });
    },
    onError: (err: any) => {
      if (err?.message === 'Cancelled') return;
      toast({ title: 'Error', description: err?.response?.data?.error ?? err?.message ?? 'Delete failed', variant: 'destructive' });
    },
  });

  const regions = data?.regions || [];
  const count = data?.count || 0;

  return (
    <StoreGuard>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Regions</h1>
        <RegionsList
          regions={regions}
          isLoading={isLoading}
          isError={isError}
          error={error}
          search={search}
          setSearch={setSearch}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          count={count}
          onEdit={setEditingId}
          onDelete={(id) => deleteMutation.mutate(id)}
          onCreateClick={() => setIsCreateOpen(true)}
        />
        <RegionFormSheet
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSuccess={() => {
            setIsCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: ['medusa-regions'] });
          }}
          apiKey={apiKey!}
        />
        <RegionFormSheet
          id={editingId ?? undefined}
          open={!!editingId}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['medusa-regions'] });
          }}
          apiKey={apiKey!}
        />
      </div>
    </StoreGuard>
  );
}

function RegionsList({
  regions,
  isLoading,
  isError,
  error,
  search,
  setSearch,
  page,
  setPage,
  pageSize,
  count,
  onEdit,
  onDelete,
  onCreateClick,
}: {
  regions: any[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  search: string;
  setSearch: (v: string) => void;
  page: number;
  setPage: (v: number) => void;
  pageSize: number;
  count: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateClick: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search regions..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          New Region
        </Button>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Countries</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-destructive">
                  {(error as any)?.response?.data?.error ?? (error as Error)?.message ?? 'Failed to load regions.'}
                </TableCell>
              </TableRow>
            ) : regions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No regions found.
                </TableCell>
              </TableRow>
            ) : (
              regions.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.currency_code?.toUpperCase()}</TableCell>
                  <TableCell>
                    {r.countries?.map((c: any) => c.iso_2 || c.country_code || c).join(', ') || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(r.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => onDelete(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={regions.length < pageSize} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function RegionFormSheet({
  id,
  open,
  onOpenChange,
  onSuccess,
  apiKey,
}: {
  id?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  apiKey: string;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('');
  const [countriesStr, setCountriesStr] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = !!id;

  const { data: regionData } = useQuery({
    queryKey: ['medusa-region', id],
    queryFn: async () => {
      const res = await axios.get(`/api/medusa/regions/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
      return res.data;
    },
    enabled: !!id && open,
  });

  useEffect(() => {
    if (regionData?.region) {
      const r = regionData.region;
      setName(r.name || '');
      setCurrencyCode(r.currency_code || '');
      const countries = r.countries?.map((c: any) => c.iso_2 || c.country_code || c).filter(Boolean) || [];
      setCountriesStr(countries.join(', '));
    } else if (!id) {
      setName('');
      setCurrencyCode('');
      setCountriesStr('');
    }
  }, [regionData, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const countries = countriesStr.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (isEdit) {
        await axios.put(`/api/medusa/regions/${id}`, { name, currency_code: currencyCode, countries }, { headers: { Authorization: `Bearer ${apiKey}` } });
      } else {
        await axios.post('/api/medusa/regions', { name, currency_code: currencyCode, countries }, { headers: { Authorization: `Bearer ${apiKey}` } });
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.response?.data?.error ?? err?.message ?? 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Region' : 'Create Region'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thailand" required />
          </div>
          <div>
            <Label htmlFor="currency">Currency Code</Label>
            <Input id="currency" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} placeholder="e.g. thb" required />
          </div>
          <div>
            <Label htmlFor="countries">Countries (ISO 2, comma-separated)</Label>
            <Input id="countries" value={countriesStr} onChange={(e) => setCountriesStr(e.target.value)} placeholder="e.g. th, us" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? 'Update' : 'Create'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
