'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useStore } from '@/lib/store';
import { Loader2, Search } from 'lucide-react';

interface ProductPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (variantId: string, quantity: number, product: any, variant: any) => void;
}

export function ProductPicker({ open, onOpenChange, onSelect }: ProductPickerProps) {
  const { apiKey, siteId } = useStore();
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['products', siteId, search],
    queryFn: async () => {
      const res = await axios.get('/api/products', {
        params: { limit: 10, q: search, siteId: siteId || undefined },
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data;
    },
    enabled: open && !!apiKey,
  });

  const products = data?.products || [];

  const handleAdd = (variant: any, product: any) => {
    const qty = quantities[variant.id] || 1;
    onSelect(variant.id, qty, product, variant);
    setQuantities(prev => ({ ...prev, [variant.id]: 1 }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Products</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : (
            <div className="space-y-4">
              {products.map((product: any) => (
                <div key={product.id} className="border rounded p-4">
                  <div className="flex items-center gap-4 mb-2">
                    {product.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.thumbnail} alt={product.title} className="w-10 h-10 object-cover rounded" />
                    )}
                    <div className="font-medium">{product.title}</div>
                  </div>
                  <div className="space-y-2">
                    {product.variants?.map((variant: any) => (
                      <div key={variant.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                        <div>
                          <div>{variant.title}</div>
                          <div className="text-xs text-muted-foreground">SKU: {variant.sku} | In Stock: {variant.inventory_quantity}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 font-medium text-right">
                             {(variant.prices?.[0]?.amount / 100).toFixed(2)} USD
                          </div>
                          <Input
                             type="number"
                             min="1"
                             className="w-16 h-8"
                             value={quantities[variant.id] || 1}
                             onChange={(e) => setQuantities(prev => ({ ...prev, [variant.id]: parseInt(e.target.value) || 1 }))}
                          />
                          <Button size="sm" onClick={() => handleAdd(variant, product)}>Add</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
