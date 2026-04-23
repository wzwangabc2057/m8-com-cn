'use client';

import Link from 'next/link';
import { useStoreI18n } from '@/providers/store-i18n-provider';
import type { ProductPrice } from '@/lib/storefront-product';
import { ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  handle: string;
  title: string;
  thumbnail?: string | null;
  price?: ProductPrice | null;
}

export function ProductCard({ handle, title, thumbnail, price }: ProductCardProps) {
  const { formatPrice } = useStoreI18n();

  return (
    <Link
      href={`/products/${handle}`}
      className="group flex flex-col transition-all duration-300 relative"
    >
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100/50 mb-4 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-500">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <span className="text-slate-400 text-4xl font-bold opacity-50">
              {title.charAt(0)}
            </span>
          </div>
        )}
        
        {/* Quick Add Overlay (Desktop only) */}
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 translate-y-full opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100 hidden md:block">
          <div className="bg-white/95 backdrop-blur-sm text-slate-900 font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-black/5 flex items-center justify-center gap-2 hover:bg-slate-900 hover:text-white transition-colors duration-300">
            <ShoppingCart className="w-4 h-4" />
            <span className="text-sm tracking-wide">View Details</span>
          </div>
        </div>
      </div>

      {/* Product Info */}
      <div className="flex flex-col px-1">
        <h3 className="font-medium text-slate-900 text-base sm:text-lg leading-tight line-clamp-2 mb-1.5 transition-colors group-hover:text-blue-600">
          {title}
        </h3>
        
        <div className="mt-1 flex items-center">
          {price ? (
            <p className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
              {formatPrice(price.amount, price.currency_code)}
            </p>
          ) : (
            <p className="text-sm sm:text-base text-slate-400 font-medium">Coming soon</p>
          )}
        </div>
      </div>
    </Link>
  );
}
