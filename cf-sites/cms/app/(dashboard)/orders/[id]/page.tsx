'use client';

import { use } from 'react';
import { OrderDetails } from '@/components/orders/order-details';
import { StoreGuard } from '@/components/store-guard';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const runtime = 'edge';

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <StoreGuard>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Order Details</h1>
        </div>
        <OrderDetails id={id} />
      </div>
    </StoreGuard>
  );
}
