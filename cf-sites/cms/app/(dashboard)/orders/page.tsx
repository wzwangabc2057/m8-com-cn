'use client';

import { OrderList } from '@/components/orders/order-list';
import { StoreGuard } from '@/components/store-guard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function OrdersPage() {
  return (
    <StoreGuard>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <Link href="/orders/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Order
            </Button>
          </Link>
        </div>
        <OrderList />
      </div>
    </StoreGuard>
  );
}
