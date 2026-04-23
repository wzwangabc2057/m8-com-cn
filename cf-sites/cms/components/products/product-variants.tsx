'use client';

import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Variant {
  title: string;
  prices: { amount: number; currency_code: string }[];
  inventory_quantity: number;
  sku?: string;
  options: { value: string }[];
}

interface ProductVariantsProps {
  variants: Variant[];
  onChange: (variants: Variant[]) => void;
}

export function ProductVariants({ variants, onChange }: ProductVariantsProps) {
  const updateVariant = (index: number, updates: Partial<Variant>) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], ...updates };
    onChange(newVariants);
  };

  const updatePrice = (index: number, amount: number) => {
    const newVariants = [...variants];
    const currentPrice = newVariants[index].prices?.[0] || { currency_code: 'usd', amount: 0 };
    
    newVariants[index].prices = [{ 
      ...currentPrice, 
      amount: Math.round(amount * 100),
    }];
    onChange(newVariants);
  };

  if (variants.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">Add options to generate variants.</div>;
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variant</TableHead>
            <TableHead>Price (USD)</TableHead>
            <TableHead>Inventory</TableHead>
            <TableHead>SKU</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((variant, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{variant.title}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  className="w-24 h-8"
                  value={(variant.prices?.[0]?.amount || 0) / 100}
                  onChange={(e) => updatePrice(index, parseFloat(e.target.value) || 0)}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  className="w-24 h-8"
                  value={variant.inventory_quantity}
                  onChange={(e) => updateVariant(index, { inventory_quantity: parseInt(e.target.value) || 0 })}
                />
              </TableCell>
              <TableCell>
                <Input
                  className="w-32 h-8"
                  value={variant.sku || ''}
                  onChange={(e) => updateVariant(index, { sku: e.target.value })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
