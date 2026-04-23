'use client';

import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const apiKey = useStore((state) => state.apiKey);
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand persist to finish hydration from localStorage
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    // If already hydrated (e.g. store was created before component mounted)
    if (useStore.persist.hasHydrated()) {
      setHydrated(true);
    }

    return unsub;
  }, []);

  // Redirect to login when hydrated and no apiKey
  useEffect(() => {
    if (hydrated && !apiKey) {
      router.push('/login');
    }
  }, [apiKey, router, hydrated]);

  // Show nothing until hydration completes (prevents flash)
  if (!hydrated) return null;

  // After hydration, if no key, show nothing (redirect is in progress)
  if (!apiKey) return null;

  return <>{children}</>;
}
