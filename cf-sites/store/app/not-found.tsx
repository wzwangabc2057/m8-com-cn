import Link from 'next/link';
import { getStoreConfigContext } from '@/lib/config';
import { resolveStoreMessages } from '@/lib/i18n';

export const runtime = 'edge';

export default async function NotFoundPage() {
  const { language } = await getStoreConfigContext();
  const messages = resolveStoreMessages(language);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--color-heading)' }}>
        {messages.pageNotFoundTitle}
      </h1>
      <p className="mb-6" style={{ color: 'var(--color-text-muted)' }}>
        {messages.pageNotFoundDescription}
      </p>
      <Link
        href="/store"
        className="inline-block px-6 py-3 rounded-xl text-white font-medium"
        style={{ background: 'var(--color-primary)' }}
      >
        {messages.backToStore}
      </Link>
    </div>
  );
}
