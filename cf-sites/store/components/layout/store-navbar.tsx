'use client';

import Link from 'next/link';
import { ShoppingCart, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/providers/cart-provider';
import { useStoreI18n } from '@/providers/store-i18n-provider';

/**
 * Store navigation bar - visually consistent with the blog's header.
 * Uses the same colors, spacing, and design language.
 */
export function StoreNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemCount } = useCart();
  const { messages } = useStoreI18n();

  return (
    <header
      className="sticky top-0 z-50 px-6 text-white"
      style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between h-16">
        {/* Logo - links to blog home */}
        <div className="flex-1 flex justify-start">
          <Link href="/" className="text-white text-xl font-bold tracking-tight flex items-center gap-2.5 no-underline hover:text-slate-200 transition-colors">
            <span>{messages.storeBrand}</span>
          </Link>
        </div>

        {/* Desktop nav - Centered */}
        <nav className="hidden md:flex flex-1 justify-center gap-6" aria-label={messages.navAria}>
          <Link href="/" className="text-slate-300 text-sm font-medium transition-all duration-200 hover:text-white">
            {messages.blog}
          </Link>
          <Link href="/store" className="text-slate-300 text-sm font-medium transition-all duration-200 hover:text-white">
            {messages.products}
          </Link>
          <Link href="/account" className="text-slate-300 text-sm font-medium transition-all duration-200 hover:text-white">
            {messages.account}
          </Link>
        </nav>

        {/* Actions - Right Aligned */}
        <div className="flex flex-1 justify-end items-center gap-3">
          {/* Cart icon */}
          <Link
            href="/cart"
            className="relative inline-flex items-center text-slate-300 hover:text-white transition-colors"
            aria-label={messages.cartAriaLabel(itemCount)}
          >
            <ShoppingCart className="w-5 h-5" />
            {itemCount > 0 && (
              <span
                aria-live="polite"
                aria-atomic="true"
                className="absolute -top-1.5 -right-2 text-white text-[11px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
                style={{ background: 'var(--color-primary)' }}
              >
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-white p-2 -mr-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={messages.toggleMenu}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden flex flex-col pb-4 border-t border-white/10 mt-2 pt-3 gap-1" aria-label={messages.mobileNavAria}>
          <Link href="/" className="text-slate-300 text-base font-medium px-3 py-2.5 rounded-lg transition-colors hover:text-white hover:bg-white/10" onClick={() => setMobileOpen(false)}>
            {messages.blog}
          </Link>
          <Link href="/store" className="text-slate-300 text-base font-medium px-3 py-2.5 rounded-lg transition-colors hover:text-white hover:bg-white/10" onClick={() => setMobileOpen(false)}>
            {messages.products}
          </Link>
          <Link href="/cart" className="text-slate-300 text-base font-medium px-3 py-2.5 rounded-lg transition-colors hover:text-white hover:bg-white/10" onClick={() => setMobileOpen(false)}>
            {messages.cartWithCount(itemCount)}
          </Link>
          <Link href="/account" className="text-slate-300 text-base font-medium px-3 py-2.5 rounded-lg transition-colors hover:text-white hover:bg-white/10" onClick={() => setMobileOpen(false)}>
            {messages.account}
          </Link>
        </nav>
      )}
    </header>
  );
}
