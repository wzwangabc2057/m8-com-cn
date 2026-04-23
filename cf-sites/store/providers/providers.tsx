'use client';

import { QueryProvider } from './query-provider';
import { CartProvider } from './cart-provider';
import { RegionProvider } from './region-provider';
import { StoreI18nProvider } from './store-i18n-provider';
import { ToastProvider } from './toast-provider';

/**
 * Combined providers wrapper for the store app.
 */
export function Providers({
  children,
  language,
}: {
  children: React.ReactNode;
  language?: string;
}) {
  return (
    <QueryProvider>
      <StoreI18nProvider language={language}>
        <RegionProvider>
          <CartProvider>
            <ToastProvider>{children}</ToastProvider>
          </CartProvider>
        </RegionProvider>
      </StoreI18nProvider>
    </QueryProvider>
  );
}
