'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  FileText, 
  Files, 
  Image as ImageIcon, 
  Settings, 
  LogOut,
  BookOpen,
  Globe,
  Server,
  Store,
  ShoppingBag,
  Package,
  ChevronRight,
  ChevronDown,
  Plus,
  List,
  Users,
  FolderTree,
  Tags,
  MapPin,
  Truck,
  Building2
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { SiteSwitcher } from '@/components/site-switcher';
import { GLOBAL_SITE_ID } from '@/lib/settings-d1';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  subItems?: { name: string; href: string; icon?: any }[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const overviewGroup: NavGroup = {
  label: 'Overview',
  items: [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  ]
};

const contentGroup: NavGroup = {
  label: 'Content',
  items: [
    { 
      name: 'Posts', 
      href: '/posts', 
      icon: FileText,
      subItems: [
        { name: 'All Posts', href: '/posts', icon: List },
        { name: 'New Post', href: '/posts/new', icon: Plus },
      ]
    },
    { 
      name: 'Pages', 
      href: '/site-pages', 
      icon: Files,
      subItems: [
        { name: 'All Pages', href: '/site-pages', icon: List },
        { name: 'New Page', href: '/site-pages/new', icon: Plus },
      ]
    },
    { name: 'Media', href: '/media', icon: ImageIcon },
    {
      name: 'Metadata',
      href: '/authors',
      icon: Users,
      subItems: [
        { name: 'Authors', href: '/authors', icon: Users },
        { name: 'Categories', href: '/categories', icon: FolderTree },
        { name: 'Tags', href: '/tags', icon: Tags },
      ],
    },
  ]
};

const storeNavGroup: NavGroup = {
  label: 'Store',
  items: [
    { name: 'Orders', href: '/orders', icon: Package },
    { name: 'Products', href: '/products', icon: ShoppingBag },
    { name: 'Regions', href: '/regions', icon: MapPin },
    { name: 'Stock Locations', href: '/stock-locations', icon: Building2 },
    { name: 'Shipping Options', href: '/shipping-options', icon: Truck },
    { name: 'Store Content', href: '/store-content', icon: Store },
  ],
};

const configGroup: NavGroup = {
  label: 'Configuration',
  items: [
    { name: 'Settings', href: '/settings', icon: Settings },
  ]
};

function SidebarItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  
  // Check if main item is active (exact match)
  const isMainActive = pathname === item.href;
  
  // Check if any sub-item is active
  const isSubActive = item.subItems?.some(sub => pathname === sub.href || pathname.startsWith(sub.href));
  
  // Check if active (main or sub)
  const isActive = isMainActive || isSubActive;
  
  const hasSubItems = item.subItems && item.subItems.length > 0;

  // Auto-open if active or if previously opened (could persist state if needed)
  React.useEffect(() => {
    if (isActive && hasSubItems) {
      setIsOpen(true);
    }
  }, [isActive, hasSubItems]);

  if (hasSubItems) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
            isActive ? "bg-gray-100 text-primary" : "text-muted-foreground hover:bg-gray-100"
          )}
        >
          <div className="flex items-center gap-3">
             {/* @ts-expect-error Lucide Icon type mismatch */}
             <item.icon className="h-4 w-4" />
             <span className="font-medium">{item.name}</span>
          </div>
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {isOpen && (
          <div className="pl-9 space-y-1 relative">
            {/* 1.25rem = 20px, aligning with center of parent icon (12px padding + 8px half-width) */}
            <div className="absolute left-[1.25rem] top-0 bottom-0 w-px bg-gray-200" />
            {item.subItems?.map((sub) => {
               const isChildActive = pathname === sub.href;
               return (
                 <Link
                   key={sub.href}
                   href={sub.href}
                   className={cn(
                     "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
                     isChildActive ? "text-primary font-medium bg-gray-50" : "text-muted-foreground hover:bg-gray-50"
                   )}
                 >
                   {sub.icon && <sub.icon className="h-3.5 w-3.5" />}
                   {sub.name}
                 </Link>
               );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
        isActive ? "bg-gray-100 text-primary" : "text-muted-foreground hover:bg-gray-100"
      )}
    >
      {/* @ts-expect-error Lucide Icon type mismatch */}
      <item.icon className="h-4 w-4" />
      <span className="font-medium">{item.name}</span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { apiKey, siteId } = useStore();
  const logout = useStore((state) => state.logout);
  const effectiveSiteId = siteId || GLOBAL_SITE_ID;

  const { data: settings } = useQuery({
    queryKey: ['settings', effectiveSiteId],
    queryFn: async () => {
      const res = await fetch(`/api/settings?siteId=${encodeURIComponent(effectiveSiteId)}`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<{ store?: { medusaSalesChannelId?: string } }>;
    },
    enabled: !!apiKey && !!effectiveSiteId,
  });

  const hasSalesChannel = !!settings?.store?.medusaSalesChannelId;
  
  // Construct nav groups: Overview, Content, [Store], Configuration
  const navGroups: NavGroup[] = [
    overviewGroup,
    contentGroup,
    ...(hasSalesChannel ? [storeNavGroup] : []),
    configGroup
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Cookie cleanup failed — still proceed with client-side logout
    }
    logout();
    router.push('/login');
  };

  return (
    <div className="flex h-full w-64 flex-col border-r bg-gray-50/40">
      <div className="flex h-14 items-center border-b px-4">
        <SiteSwitcher />
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid items-start px-4 text-sm font-medium gap-1">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label} className={cn("mb-6", groupIndex === 0 && "mb-2")}>
              {group.label !== 'Overview' && (
                <h4 className="mb-2 px-4 text-xs font-bold text-muted-foreground/70 tracking-wider uppercase">
                  {group.label}
                </h4>
              )}
              <div className="grid gap-1">
                {group.items.map((item) => (
                  <SidebarItem key={item.name} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t p-4 space-y-2 bg-white">
         <Link
            href="/sites"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary text-muted-foreground hover:bg-gray-100",
              pathname === '/sites' && "bg-gray-100 text-primary"
            )}
          >
            {/* @ts-expect-error Lucide Icon type mismatch */}
            <Globe className="h-4 w-4" />
            <span className="font-medium">All Sites</span>
          </Link>
         <Link
            href="/global-settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary text-muted-foreground hover:bg-gray-100",
              pathname === '/global-settings' && "bg-gray-100 text-primary"
            )}
          >
            {/* @ts-expect-error Lucide Icon type mismatch */}
            <Server className="h-4 w-4" />
            <span className="font-medium">Global Settings</span>
          </Link>
         <Link
            href="/openapi"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary text-muted-foreground hover:bg-gray-100",
              pathname === '/openapi' && "bg-gray-100 text-primary"
            )}
          >
            {/* @ts-expect-error Lucide Icon type mismatch */}
            <BookOpen className="h-4 w-4" />
            <span className="font-medium">API</span>
          </Link>
        <Button variant="ghost" className="w-full justify-start gap-3 px-3 text-muted-foreground hover:text-primary hover:bg-red-50 hover:text-red-600" onClick={handleLogout}>
          {/* @ts-expect-error Lucide Icon type mismatch */}
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
