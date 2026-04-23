'use client';

import { useState } from 'react';
import { useStoreI18n } from '@/providers/store-i18n-provider';

export default function AccountPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { messages } = useStoreI18n();

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-extrabold mb-8 text-center" style={{ color: 'var(--color-heading)' }}>
        {messages.loginTitle}
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          // TODO: Integrate Medusa auth
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            {messages.email}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border text-sm"
            style={{ borderColor: 'var(--color-border)' }}
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
            {messages.password}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border text-sm"
            style={{ borderColor: 'var(--color-border)' }}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl text-white font-medium text-sm"
          style={{ background: 'var(--color-primary)' }}
        >
          {messages.login}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        {messages.noAccount}{' '}
        <a href="#" className="font-medium" style={{ color: 'var(--color-primary)' }}>{messages.register}</a>
      </p>
    </div>
  );
}
