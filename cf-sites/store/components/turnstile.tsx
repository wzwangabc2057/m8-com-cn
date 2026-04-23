'use client';

import { useEffect, useRef, useState } from 'react';

interface TurnstileProps {
  onVerify: (token: string) => void;
  onAvailabilityChange?: (enabled: boolean) => void;
  siteKey?: string;
}

/**
 * Cloudflare Turnstile invisible CAPTCHA component.
 */
export function Turnstile({ onVerify, onAvailabilityChange, siteKey }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const [resolvedSiteKey, setResolvedSiteKey] = useState<string>(siteKey || '');

  useEffect(() => {
    if (siteKey) {
      setResolvedSiteKey(siteKey);
      onAvailabilityChange?.(true);
      return;
    }

    let cancelled = false;
    fetch('/api/turnstile/config')
      .then((res) => res.json() as Promise<{ enabled?: boolean; siteKey?: string | null }>)
      .then((data) => {
        if (cancelled) return;
        const key = data.siteKey?.trim() || '';
        setResolvedSiteKey(key);
        onAvailabilityChange?.(!!key && !!data.enabled);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedSiteKey('');
        onAvailabilityChange?.(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onAvailabilityChange, siteKey]);

  useEffect(() => {
    if (loadedRef.current) return;
    if (!resolvedSiteKey) return;
    loadedRef.current = true;

    // Load Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      if (containerRef.current && (window as any).turnstile) {
        (window as any).turnstile.render(containerRef.current, {
          sitekey: resolvedSiteKey,
          callback: onVerify,
          theme: 'light',
          size: 'normal',
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup not strictly necessary since turnstile manages its own lifecycle
    };
  }, [onVerify, resolvedSiteKey]);

  return <div ref={containerRef} className="mt-2" />;
}
