'use client';

import { ProductList } from '@/components/products/product-list';
import { StoreGuard } from '@/components/store-guard';

export default function ProductsPage() {
  return (
    <StoreGuard>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <ProductList />
      </div>
    </StoreGuard>
  );
}
