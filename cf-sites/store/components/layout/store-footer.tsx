'use client';

import Link from 'next/link';
import { useStoreI18n } from '@/providers/store-i18n-provider';

/**
 * Store footer - visually consistent with the blog's footer.
 */
export function StoreFooter() {
  const year = new Date().getFullYear();
  const { messages } = useStoreI18n();

  return (
    <footer
      className="py-10 px-6 mt-auto"
      style={{ background: 'var(--color-nav-bg)', color: 'var(--color-text-faint)' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Top section */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 pb-6 border-b border-white/10 mb-6">
          <div>
            <p className="text-white font-semibold text-lg">{messages.storeBrand}</p>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">
              {messages.footerTagline}
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/" className="text-slate-400 text-sm hover:text-white transition-colors">
              {messages.blog}
            </Link>
            <Link href="/store" className="text-slate-400 text-sm hover:text-white transition-colors">
              {messages.products}
            </Link>
            <Link href="/cart" className="text-slate-400 text-sm hover:text-white transition-colors">
              {messages.cart}
            </Link>
            <Link href="/account" className="text-slate-400 text-sm hover:text-white transition-colors">
              {messages.account}
            </Link>
          </nav>
        </div>

        {/* Bottom section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            {messages.footerCopyright(year)}
          </p>
          <p className="text-slate-600 text-xs">
            {messages.footerPoweredBy}
          </p>
        </div>
      </div>
    </footer>
  );
}
