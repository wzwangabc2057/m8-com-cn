'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useStore } from '@/lib/store';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, CreditCard, User, Truck, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { FulfillmentModal } from './fulfillment-modal';
import Link from 'next/link';

interface OrderDetailsProps {
  id: string;
}

export function OrderDetails({ id }: OrderDetailsProps) {
  const { apiKey } = useStore();
  const queryClient = useQueryClient();
  const [isFulfillmentModalOpen, setIsFulfillmentModalOpen] = useState(false);
  const [selectedFulfillmentId, setSelectedFulfillmentId] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await axios.get(`/api/orders/${id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data.order;
    },
    enabled: !!apiKey,
  });

  const fulfillMutation = useMutation({
    mutationFn: async () => {
      // Fulfill all unfulfilled items
      const items = order.items
        .filter((item: any) => item.quantity > (item.fulfilled_quantity || 0))
        .map((item: any) => ({
          item_id: item.id,
          quantity: item.quantity - (item.fulfilled_quantity || 0),
        }));
      
      if (!items.length) return;

      await axios.post(`/api/orders/${id}`, {
        action: 'fulfill',
        items,
        no_notification: false,
      }, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const shipmentMutation = useMutation({
    mutationFn: async (trackingNumbers: string[]) => {
      if (!selectedFulfillmentId) return;

      await axios.post(`/api/orders/${id}`, {
        action: 'ship',
        fulfillment_id: selectedFulfillmentId,
        tracking_numbers: trackingNumbers,
        no_notification: false,
      }, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      setIsFulfillmentModalOpen(false);
      setSelectedFulfillmentId(null);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const captureMutation = useMutation({
    mutationFn: async () => {
      await axios.post(`/api/orders/${id}`, {
        action: 'capture',
      }, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  }

  if (!order) {
    return <div className="p-8 text-center">Order not found</div>;
  }

  const unfulfilledItems = order.items.filter((item: any) => (item.quantity - (item.fulfilled_quantity || 0)) > 0);
  const fulfilledItemsCount = order.items.reduce((acc: number, item: any) => acc + (item.fulfilled_quantity || 0), 0);
  const totalItemsCount = order.items.reduce((acc: number, item: any) => acc + item.quantity, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Order #{order.display_id}</CardTitle>
                <CardDescription>
                  Placed on {format(new Date(order.created_at), 'MMMM d, yyyy h:mm a')}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant={order.payment_status === 'captured' ? 'default' : 'secondary'}>
                  {order.payment_status}
                </Badge>
                <Badge variant={order.fulfillment_status === 'fulfilled' ? 'default' : 'outline'}>
                  {order.fulfillment_status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-4">
                    {item.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnail} alt={item.title} className="w-12 h-12 object-cover rounded" />
                    )}
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-muted-foreground">{item.variant?.title}</div>
                      <div className="text-xs text-muted-foreground">SKU: {item.variant?.sku}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div>{(item.unit_price / 100).toFixed(2)} x {item.quantity}</div>
                    <div className="font-medium">{(item.total / 100).toFixed(2)}</div>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-4 font-bold text-lg">
                <span>Total</span>
                <span>{(order.total / 100).toFixed(2)} {order.currency_code.toUpperCase()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fulfillment Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Fulfillment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.fulfillments?.length > 0 ? (
              order.fulfillments.map((fulfillment: any) => (
                <div key={fulfillment.id} className="border rounded p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Fulfillment #{fulfillment.display_id || fulfillment.id.slice(0, 8)}</span>
                    <Badge variant={fulfillment.shipped_at ? 'default' : 'secondary'}>
                      {fulfillment.shipped_at ? 'Shipped' : 'Pending Shipment'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    Items: {fulfillment.items?.length}
                  </div>
                  {!fulfillment.shipped_at && (
                    <Button 
                      size="sm" 
                      onClick={() => {
                        setSelectedFulfillmentId(fulfillment.id);
                        setIsFulfillmentModalOpen(true);
                      }}
                    >
                      <Truck className="mr-2 h-4 w-4" />
                      Mark as Shipped
                    </Button>
                  )}
                  {fulfillment.tracking_numbers?.length > 0 && (
                     <div className="text-sm">
                       Tracking: {fulfillment.tracking_numbers.join(', ')}
                     </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground text-sm">No fulfillments yet.</div>
            )}
            
            {unfulfilledItems.length > 0 && (
              <Button 
                onClick={() => fulfillMutation.mutate()} 
                disabled={fulfillMutation.isPending}
                className="w-full"
              >
                {fulfillMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Fulfillment for {unfulfilledItems.length} items
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Payment Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                 <span>Subtotal</span>
                 <span>{(order.subtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                 <span>Shipping</span>
                 <span>{(order.shipping_total / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                 <span>Tax</span>
                 <span>{(order.tax_total / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                 <span>Total</span>
                 <span>{(order.total / 100).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
             {order.payment_status === 'awaiting' && (
               <Button 
                 onClick={() => captureMutation.mutate()} 
                 disabled={captureMutation.isPending}
                 className="w-full"
               >
                 Capture Payment
               </Button>
             )}
          </CardFooter>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Customer Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="font-medium">{order.customer?.first_name} {order.customer?.last_name}</div>
            <div className="text-muted-foreground">{order.email}</div>
            <div className="pt-2 border-t mt-2">
              <div className="font-medium mb-1">Shipping Address</div>
              <div>{order.shipping_address?.address_1}</div>
              {order.shipping_address?.address_2 && <div>{order.shipping_address?.address_2}</div>}
              <div>{order.shipping_address?.city}, {order.shipping_address?.province} {order.shipping_address?.postal_code}</div>
              <div>{order.shipping_address?.country_code?.toUpperCase()}</div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline (Simplified) */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" /> Timeline
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-3">
                    <div className="mt-1"><CheckCircle className="h-4 w-4 text-green-500" /></div>
                    <div>
                        <div className="text-sm font-medium">Order Placed</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'MMM d, h:mm a')}</div>
                    </div>
                </div>
                {order.fulfillments?.map((f: any) => (
                    <div key={f.id} className="flex gap-3">
                        <div className="mt-1"><Truck className="h-4 w-4 text-blue-500" /></div>
                        <div>
                            <div className="text-sm font-medium">Fulfillment Created</div>
                            <div className="text-xs text-muted-foreground">{format(new Date(f.created_at), 'MMM d, h:mm a')}</div>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
      </div>

      <FulfillmentModal
        open={isFulfillmentModalOpen}
        onOpenChange={setIsFulfillmentModalOpen}
        onSubmit={(tracking) => shipmentMutation.mutate(tracking)}
        isLoading={shipmentMutation.isPending}
      />
    </div>
  );
}
