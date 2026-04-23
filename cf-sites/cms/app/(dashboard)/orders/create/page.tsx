'use client';

import { DraftOrderForm } from '@/components/orders/draft-order-form';
import { StoreGuard } from '@/components/store-guard';

export default function CreateOrderPage() {
  return (
    <StoreGuard>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Create Order</h1>
        <DraftOrderForm />
      </div>
    </StoreGuard>
  );
}
