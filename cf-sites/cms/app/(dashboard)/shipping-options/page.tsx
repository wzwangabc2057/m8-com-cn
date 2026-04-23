'use client';

import { useState } from 'react';
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
import { Loader2, Search, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { StoreGuard } from '@/components/store-guard';

export default function ShippingOptionsPage() {
  const { apiKey } = useStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['medusa-shipping-options', page, search],
    queryFn: async () => {
      const res = await axios.get('/api/medusa/shipping-options', {
        params: { limit: pageSize, offset: page * pageSize, q: search || undefined },
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data;
    },
    enabled: !!apiKey,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!confirm('Are you sure you want to delete this shipping option?')) throw new Error('Cancelled');
      await axios.delete(`/api/medusa/shipping-options/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medusa-shipping-options'] });
      toast({ title: 'Deleted', description: 'Shipping option deleted successfully.' });
    },
    onError: (err: any) => {
      if (err?.message === 'Cancelled') return;
      toast({ title: 'Error', description: err?.response?.data?.error ?? err?.message ?? 'Delete failed', variant: 'destructive' });
    },
  });

  const shippingOptions = data?.shipping_options || [];
  const count = data?.count || 0;

  return (
    <StoreGuard>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Shipping Options</h1>
        <p className="text-muted-foreground text-sm">
          Shipping options are created within service zones of stock location fulfillment sets. Use Medusa Admin or create service zones first, then add shipping options via the Medusa API.
        </p>
        <div className="space-y-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search shipping options..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price Type</TableHead>
                  <TableHead>Service Zone</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                      {(error as any)?.response?.data?.error ?? (error as Error)?.message ?? 'Failed to load shipping options.'}
                    </TableCell>
                  </TableRow>
                ) : shippingOptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No shipping options found.
                    </TableCell>
                  </TableRow>
                ) : (
                  shippingOptions.map((so: any) => (
                    <TableRow key={so.id}>
                      <TableCell className="font-medium">{so.name}</TableCell>
                      <TableCell>{so.price_type || '-'}</TableCell>
                      <TableCell>{so.service_zone?.name || so.service_zone_id || '-'}</TableCell>
                      <TableCell>{so.shipping_profile?.name || so.shipping_profile_id || '-'}</TableCell>
                      <TableCell>
                        {so.prices?.length
                          ? so.prices.map((p: any) => `${p.amount ?? p.calculated_amount ?? 0} ${(p.currency_code || '').toUpperCase()}`).join(', ')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(so.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
            <Button variant="outline" size="sm" disabled={shippingOptions.length < pageSize} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </StoreGuard>
  );
}
