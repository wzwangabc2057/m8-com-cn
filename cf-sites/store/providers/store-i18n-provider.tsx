'use client';

import { createContext, useContext, useMemo } from 'react';
import { formatPrice, resolveStoreLanguage, resolveStoreMessages, type StoreMessages } from '@/lib/i18n';

interface StoreI18nContextValue {
  language: string;
  messages: StoreMessages;
  formatPrice: (amount: number, currencyCode?: string | null) => string;
}

const StoreI18nContext = createContext<StoreI18nContextValue | null>(null);

export function StoreI18nProvider({
  children,
  language,
}: {
  children: React.ReactNode;
  language?: string;
}) {
  const value = useMemo<StoreI18nContextValue>(() => {
    const resolvedLanguage = resolveStoreLanguage(language);
    const messages = resolveStoreMessages(resolvedLanguage);

    return {
      language: resolvedLanguage,
      messages,
      formatPrice: (amount, currencyCode) => formatPrice(amount, resolvedLanguage, currencyCode),
    };
  }, [language]);

  return <StoreI18nContext.Provider value={value}>{children}</StoreI18nContext.Provider>;
}

export function useStoreI18n() {
  const context = useContext(StoreI18nContext);

  if (!context) {
    throw new Error('useStoreI18n must be used within a StoreI18nProvider');
  }

  return context;
}
