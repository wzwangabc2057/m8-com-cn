import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/providers/providers';
import { StoreNavbar } from '@/components/layout/store-navbar';
import { StoreFooter } from '@/components/layout/store-footer';
import { getStoreConfigContext } from '@/lib/config';
import { resolveStoreLanguage } from '@/lib/i18n';

export const metadata: Metadata = {
  title: {
    default: 'Store',
    template: '%s | Store',
  },
  description: 'Browse our products and shop online.',
};

export const runtime = 'edge';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { language } = await getStoreConfigContext();
  const htmlLang = resolveStoreLanguage(language);

  return (
    <html lang={htmlLang}>
      <body className="flex flex-col min-h-screen">
        <Providers language={htmlLang}>
          <StoreNavbar />
          <main className="flex-1">{children}</main>
          <StoreFooter />
        </Providers>
      </body>
    </html>
  );
}
