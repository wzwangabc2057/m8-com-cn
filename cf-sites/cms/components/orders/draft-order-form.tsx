'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductPicker } from '@/components/products/product-picker';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function DraftOrderForm() {
  const { apiKey } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [regionId, setRegionId] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        email,
        items: items.map(item => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
        })),
        region_id: regionId,
        // shipping_methods: [] // Optional if not calculating shipping yet
      };
      
      const res = await axios.post('/api/draft-orders', payload, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data;
    },
    onSuccess: () => {
      router.push('/orders');
    },
  });

  const handleAddItem = (variantId: string, quantity: number, product: any, variant: any) => {
    setItems(prev => [...prev, {
      variant_id: variantId,
      quantity,
      title: product.title,
      variant_title: variant.title,
      unit_price: variant.prices?.[0]?.amount || 0,
      thumbnail: product.thumbnail,
    }]);
    setIsProductPickerOpen(false);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create Draft Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Customer Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="region">Region ID</Label>
              <Input
                id="region"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                placeholder="reg_..."
              />
              <p className="text-xs text-muted-foreground">Required for currency and tax settings.</p>
            </div>
          </div>

          <div className="border rounded-md p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Items</h3>
              <Button size="sm" variant="outline" onClick={() => setIsProductPickerOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>
            
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No items added</div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-4">
                       {item.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.thumbnail} alt={item.title} className="w-12 h-12 object-cover rounded" />
                       )}
                       <div>
                         <div className="font-medium">{item.title}</div>
                         <div className="text-sm text-muted-foreground">{item.variant_title}</div>
                       </div>
                    </div>
                    <div className="flex items-center gap-6">
                       <div className="text-sm">
                         {item.quantity} x {(item.unit_price / 100).toFixed(2)}
                       </div>
                       <div className="font-medium w-20 text-right">
                         {((item.quantity * item.unit_price) / 100).toFixed(2)}
                       </div>
                       <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                         <Trash2 className="h-4 w-4 text-red-500" />
                       </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-4 font-bold text-lg">
                   <span>Total: {(total / 100).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || items.length === 0 || !email || !regionId}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Order
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProductPicker
        open={isProductPickerOpen}
        onOpenChange={setIsProductPickerOpen}
        onSelect={handleAddItem}
      />
    </div>
  );
}
