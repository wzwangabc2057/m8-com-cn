'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useStore } from '@/lib/store';
import { useRouter, usePathname } from 'next/navigation';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();
  const pathname = usePathname();
  const logout = useStore((state) => state.logout);

  useEffect(() => {
    // Add a response interceptor to handle 401 errors globally
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // If we get a 401 from API, clear store and redirect to login
          // We check pathname to avoid redirect loops if the login page itself triggers a 401 (unlikely)
          if (pathname && !pathname.startsWith('/login')) {
            logout();
            router.push(`/login?from=${encodeURIComponent(pathname)}`);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [logout, router, pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
