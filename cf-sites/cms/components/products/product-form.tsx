import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { ProductImages } from './product-images';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ProductOptions } from './product-options';
import { ProductVariants } from './product-variants';
import { useToast } from '@/components/ui/use-toast';

interface ProductFormProps {
  id?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function generateCombinations(options: { title: string; values: string[] }[]): { value: string }[][] {
  if (options.length === 0) return [];
  if (options.length === 1) return options[0].values.map(v => [{ value: v }]);

  const [first, ...rest] = options;
  const restCombinations = generateCombinations(rest);
  
  const result: { value: string }[][] = [];
  
  first.values.forEach(val => {
    restCombinations.forEach(combo => {
      result.push([{ value: val }, ...combo]);
    });
  });
  
  return result;
}

export function ProductForm({ id, onSuccess, onCancel }: ProductFormProps) {
  const { apiKey, siteId } = useStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!id;

  const [form, setForm] = useState({
    title: '',
    handle: '',
    description: '',
    status: 'draft',
    images: [] as string[],
    thumbnail: '',
    // Options and Variants
    options: [] as { title: string; values: string[] }[],
    variants: [] as any[],
    // Simple mode (no options)
    inventory_quantity: 0,
    price: 0,
  });

  // Fetch product if editing
  const { data: product, isLoading: isLoadingProduct } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await axios.get(`/api/products/${id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data.product;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (product) {
      // Map Medusa product structure to form state
      const isSimple = product.variants?.length === 1 && product.options?.length <= 1 && product.options?.[0]?.title === 'Default Option';
      
      setForm({
        title: product.title,
        handle: product.handle,
        description: product.description || '',
        status: product.status,
        images: product.images?.map((img: any) => img.url) || [],
        thumbnail: product.thumbnail || '',
        options: isSimple ? [] : product.options?.map((opt: any) => ({
          title: opt.title,
          values: opt.values?.map((v: any) => v.value) || []
        })) || [],
        variants: product.variants || [],
        inventory_quantity: product.variants?.[0]?.inventory_quantity || 0,
        price: (product.variants?.[0]?.prices?.[0]?.amount || 0) / 100,
      });
    }
  }, [product]);

  const handleOptionsChange = (newOptions: any[]) => {
    // Regenerate variants
    const combinations = generateCombinations(newOptions);
    const newVariants = combinations.map(combo => {
      const title = combo.map(c => c.value).join(' / ');
      const existing = form.variants.find((v: any) => v.title === title);
      
      // Preserve pricing/inventory from simple mode if migrating
      const basePrice = form.price;
      const baseInventory = form.inventory_quantity;
      
      return existing || {
          title,
          options: combo,
          prices: [{ amount: basePrice ? Math.round(basePrice * 100) : 0, currency_code: 'usd' }],
          inventory_quantity: baseInventory || 0,
          sku: '',
      };
    });
    
    setForm(prev => ({ ...prev, options: newOptions, variants: newVariants }));
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // Prepare payload for Medusa
      const payload: any = {
        title: data.title,
        handle: data.handle || undefined,
        description: data.description || undefined,
        status: data.status,
        images: data.images,
        thumbnail: data.thumbnail,
      };

      // Handle variants logic
      if (data.options.length === 0) {
        // Simple Mode
        if (!isEdit) {
           payload.options = [{ title: 'Default Option', values: ['Default Value'] }];
           payload.variants = [{
             title: 'Default Variant',
             prices: [{
               amount: Math.round(Number(data.price) * 100),
               currency_code: 'usd',
             }],
             options: { 'Default Option': 'Default Value' }
           }];
        } else {
           // For simple edit, API might need to update variant separately if not supported in update payload
        }
      } else {
        // Advanced Mode
        if (!isEdit) {
           payload.options = data.options.map((o: any) => ({ title: o.title, values: o.values }));
           payload.variants = data.variants.map((v: any) => {
             const variantOptions: Record<string, string> = {};
             v.options.forEach((opt: any, index: number) => {
               const optionTitle = data.options[index]?.title;
               if (optionTitle) {
                 variantOptions[optionTitle] = opt.value;
               }
             });
             
             return {
               title: v.title,
               prices: v.prices,
               sku: v.sku,
               options: variantOptions,
             };
           });
        } else {
           // Editing with variants - risky via this payload, but attempting.
           // Ideally we would sync options and variants properly.
           // Assuming API ignores variants for update if not supported.
        }
      }

      const url = isEdit ? `/api/products/${id}` : '/api/products';
      const submitUrl = siteId ? `${url}?siteId=${encodeURIComponent(siteId)}` : url;
      
      await axios.post(submitUrl, payload, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      toast({ title: isEdit ? 'Product updated' : 'Product created', description: 'Saved successfully.' });
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Save failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  if (isEdit && isLoadingProduct) {
    return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-1">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="variants">Variants</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4 py-4">
            {/* General Fields */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="handle" className="text-right">Handle</Label>
              <Input id="handle" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="auto-generated" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
              <div className="col-span-3">
                <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="proposed">Proposed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Simple Mode Inventory/Price - Only show if no options */}
            {form.options.length === 0 && (
              <Card className="bg-slate-50 border-dashed">
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="price" className="text-right">Price (USD)</Label>
                    <Input id="price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="inventory" className="text-right">Inventory</Label>
                    <Input id="inventory" type="number" value={form.inventory_quantity} onChange={(e) => setForm({ ...form, inventory_quantity: Number(e.target.value) })} className="col-span-3" />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="media" className="py-4">
            <ProductImages 
              images={form.images}
              thumbnail={form.thumbnail}
              onChange={(images, thumbnail) => setForm({ ...form, images, thumbnail })}
            />
          </TabsContent>

          <TabsContent value="variants" className="py-4 space-y-6">
             <div className="space-y-4">
                <h3 className="text-lg font-medium">Options</h3>
                <ProductOptions options={form.options} onChange={handleOptionsChange} />
             </div>
             <div className="space-y-4">
                <h3 className="text-lg font-medium">Variants</h3>
                <ProductVariants variants={form.variants} onChange={(v) => setForm({ ...form, variants: v })} />
             </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <Button variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.title}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
