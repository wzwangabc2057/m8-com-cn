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

export default function StockLocationsPage() {
  const { apiKey, siteId } = useStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const pageSize = 20;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['medusa-stock-locations', siteId, page, search],
    queryFn: async () => {
      const res = await axios.get('/api/medusa/stock-locations', {
        params: { limit: pageSize, offset: page * pageSize, q: search || undefined, siteId: siteId || undefined },
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data;
    },
    enabled: !!apiKey,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm('Are you sure you want to delete this stock location?')) throw new Error('Cancelled');
      await axios.delete(`/api/medusa/stock-locations/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medusa-stock-locations'] });
      toast({ title: 'Deleted', description: 'Stock location deleted successfully.' });
    },
    onError: (err: any) => {
      if (err?.message === 'Cancelled') return;
      toast({ title: 'Error', description: err?.response?.data?.error ?? err?.message ?? 'Delete failed', variant: 'destructive' });
    },
  });

  const stockLocations = data?.stock_locations || [];
  const count = data?.count || 0;

  return (
    <StoreGuard>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Stock Locations</h1>
        <StockLocationsList
          stockLocations={stockLocations}
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
        <StockLocationFormSheet
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSuccess={() => {
            setIsCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: ['medusa-stock-locations'] });
          }}
          apiKey={apiKey!}
        />
        <StockLocationFormSheet
          id={editingId ?? undefined}
          open={!!editingId}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['medusa-stock-locations'] });
          }}
          apiKey={apiKey!}
        />
      </div>
    </StoreGuard>
  );
}

function StockLocationsList({
  stockLocations,
  isLoading,
  isError,
  error,
  search,
  setSearch,
  page,
  setPage,
  pageSize,
  onEdit,
  onDelete,
  onCreateClick,
}: {
  stockLocations: any[];
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
          <Input placeholder="Search stock locations..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          New Stock Location
        </Button>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Sales Channels</TableHead>
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
                  {(error as any)?.response?.data?.error ?? (error as Error)?.message ?? 'Failed to load stock locations.'}
                </TableCell>
              </TableRow>
            ) : stockLocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No stock locations found.
                </TableCell>
              </TableRow>
            ) : (
              stockLocations.map((sl: any) => (
                <TableRow key={sl.id}>
                  <TableCell className="font-medium">{sl.name}</TableCell>
                  <TableCell>
                    {sl.address
                      ? [sl.address.address_1, sl.address.city, sl.address.country_code].filter(Boolean).join(', ')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {sl.sales_channels?.length ? sl.sales_channels.map((sc: any) => sc.name).join(', ') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(sl.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => onDelete(sl.id)}>
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
        <Button variant="outline" size="sm" disabled={stockLocations.length < pageSize} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function StockLocationFormSheet({
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
  const [address1, setAddress1] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = !!id;

  const { data: slData } = useQuery({
    queryKey: ['medusa-stock-location', id],
    queryFn: async () => {
      const res = await axios.get(`/api/medusa/stock-locations/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
      return res.data;
    },
    enabled: !!id && open,
  });

  useEffect(() => {
    if (slData?.stock_location) {
      const sl = slData.stock_location;
      setName(sl.name || '');
      const addr = sl.address || {};
      setAddress1(addr.address_1 || '');
      setCountryCode(addr.country_code || '');
      setCity(addr.city || '');
      setPostalCode(addr.postal_code || '');
    } else if (!id) {
      setName('');
      setAddress1('');
      setCountryCode('');
      setCity('');
      setPostalCode('');
    }
  }, [slData, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        address: { address_1: address1, country_code: countryCode.toLowerCase(), city: city || undefined, postal_code: postalCode || undefined },
      };
      if (isEdit) {
        await axios.put(`/api/medusa/stock-locations/${id}`, payload, { headers: { Authorization: `Bearer ${apiKey}` } });
      } else {
        await axios.post('/api/medusa/stock-locations', payload, { headers: { Authorization: `Bearer ${apiKey}` } });
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
          <SheetTitle>{isEdit ? 'Edit Stock Location' : 'Create Stock Location'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Warehouse" required />
          </div>
          <div>
            <Label htmlFor="address1">Address Line 1</Label>
            <Input id="address1" value={address1} onChange={(e) => setAddress1(e.target.value)} placeholder="Street address" />
          </div>
          <div>
            <Label htmlFor="country">Country Code (ISO 2)</Label>
            <Input id="country" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} placeholder="e.g. th" required />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          </div>
          <div>
            <Label htmlFor="postal">Postal Code</Label>
            <Input id="postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal code" />
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
