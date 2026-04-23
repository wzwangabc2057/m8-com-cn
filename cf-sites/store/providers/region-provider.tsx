'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface Region {
  id: string;
  name: string;
  currency_code: string;
}

interface RegionContextType {
  region: Region | null;
  setRegion: (region: Region) => void;
  regions: Region[];
}

const RegionContext = createContext<RegionContextType | null>(null);

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = useState<Region | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);

  useEffect(() => {
    // TODO: Fetch regions from Medusa on mount
    // For now, use a default region
    const defaultRegion: Region = {
      id: 'reg_default',
      name: 'Default',
      currency_code: 'cny',
    };
    setRegionState(defaultRegion);
    setRegions([defaultRegion]);
  }, []);

  const setRegion = (r: Region) => {
    setRegionState(r);
    // Persist region choice in cookie
    document.cookie = `region=${r.id};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  };

  return (
    <RegionContext value={{ region, setRegion, regions }}>
      {children}
    </RegionContext>
  );
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error('useRegion must be used within RegionProvider');
  return ctx;
}
