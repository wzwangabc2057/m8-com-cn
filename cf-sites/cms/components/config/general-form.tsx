'use client';

import { SiteConfig } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';

type ProxyRule = { pathPrefix: string; target: string };
type ProxyValue = ProxyRule | ProxyRule[] | undefined;

function ProxyRulesEditor({ proxy, onChange }: { proxy: ProxyValue; onChange: (p: ProxyValue) => void }) {
  const rules: ProxyRule[] = Array.isArray(proxy) ? proxy : proxy ? [proxy] : [];

  const updateRule = (i: number, field: 'pathPrefix' | 'target', value: string) => {
    const next = [...rules];
    next[i] = { ...next[i], [field]: value };
    onChange(next.length ? next : undefined);
  };

  const addRule = () => {
    onChange([...rules, { pathPrefix: '', target: '' }]);
  };

  const removeRule = (i: number) => {
    const next = rules.filter((_, j) => j !== i);
    onChange(next.length ? next : undefined);
  };

  return (
    <div className="space-y-3">
      {rules.map((r, i) => (
        <div key={i} className="flex gap-2 items-end">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Input
              value={r.pathPrefix}
              onChange={(e) => updateRule(i, 'pathPrefix', e.target.value)}
              placeholder="/sys"
            />
            <Input
              value={r.target}
              onChange={(e) => updateRule(i, 'target', e.target.value)}
              placeholder="http://156.254.5.245:8093"
            />
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => removeRule(i)} className="shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRule} className="gap-2">
        <Plus className="h-4 w-4" /> Add rule
      </Button>
    </div>
  );
}

export function GeneralSettingsForm({ config, onChange }: { config: SiteConfig, onChange: (c: SiteConfig) => void }) {
  return (
    <div className="space-y-4 bg-white p-4 rounded-lg border">
      <div className="space-y-2">
        <label className="text-sm font-medium">CMS Display Name</label>
        <Input 
          value={config.displayName || ''} 
          onChange={(e) => onChange({ ...config, displayName: e.target.value || undefined })} 
          placeholder="e.g. AI Football Test, Main Site (leave empty to use Site Name)"
        />
        <p className="text-xs text-muted-foreground">Used only for CMS site switcher and list, to distinguish multiple sites.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Site Name</label>
        <Input 
          value={config.name || ''} 
          onChange={(e) => onChange({ ...config, name: e.target.value })} 
          placeholder="My Awesome Blog"
        />
        <p className="text-xs text-muted-foreground">The name of your site, used in the header and SEO title.</p>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea 
          value={config.description || ''} 
          onChange={(e) => onChange({ ...config, description: e.target.value })} 
          placeholder="A blog about..."
          rows={2}
        />
        <p className="text-xs text-muted-foreground">Used for SEO meta description.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Blog List Title</label>
        <Input 
          value={config.blog?.title || ''} 
          onChange={(e) => onChange({ ...config, blog: { ...config.blog, title: e.target.value || undefined } })} 
          placeholder="Blog (leave empty to show 'Blog', can be 'News', 'Articles', etc.)"
        />
        <p className="text-xs text-muted-foreground">Displayed as the main title in the Hero section of the /blog page.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Language</label>
          <Input 
            value={config.language || 'zh-CN'} 
            onChange={(e) => onChange({ ...config, language: e.target.value })} 
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Posts Per Page</label>
          <Input 
            type="number"
            value={config.postsPerPage || 10} 
            onChange={(e) => onChange({ ...config, postsPerPage: parseInt(e.target.value) || 10 })} 
          />
        </div>
      </div>
      <div className="space-y-4 pt-4 border-t">
        <h4 className="text-sm font-medium">Cloudflare Settings</h4>
        <div className="space-y-2">
          <label className="text-sm font-medium">Zone ID</label>
          <Input 
            value={config.zoneId || ''} 
            onChange={(e) => onChange({ ...config, zoneId: e.target.value })} 
            placeholder="e.g. 023e105f4ecef8ad9ca31a8372d0c353"
          />
          <p className="text-xs text-muted-foreground">
            Required for analytics. Find this in your Cloudflare Dashboard Overview page.
          </p>
        </div>
        <div className="flex items-center justify-between border rounded-lg p-4 bg-slate-50">
          <div className="space-y-0.5">
            <label className="text-sm font-medium">Image Resizing</label>
            <p className="text-xs text-muted-foreground">
              Enable if this domain has <a href="https://developers.cloudflare.com/images/image-resizing/" target="_blank" rel="noreferrer" className="underline">Cloudflare Image Resizing</a> activated (requires Pro plan or Images subscription). When enabled, all images will be dynamically resized and converted to WebP/AVIF to save bandwidth and improve performance.
            </p>
          </div>
          {/* @ts-expect-error Radix Primitive type mismatch */}
          <Switch 
            checked={!!config.imageResizing} 
            onCheckedChange={(checked) => onChange({ ...config, imageResizing: checked })}
          />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h4 className="text-sm font-medium">Reverse Proxy</h4>
        <p className="text-xs text-muted-foreground">
          Proxy requests by path prefix to upstream servers. Supports multiple rules (first match wins).
        </p>
        <ProxyRulesEditor proxy={config.proxy} onChange={(proxy) => onChange({ ...config, proxy })} />
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h4 className="text-sm font-medium">Search engine verification (HTML tag)</h4>
        <p className="text-xs text-muted-foreground">
          Paste the <strong>content</strong> value from the meta tag (e.g. from GSC &quot;HTML tag&quot; method). It will be output as <code className="bg-muted px-1 rounded">&lt;meta name=&quot;google-site-verification&quot; content=&quot;...&quot;&gt;</code> in the site head.
        </p>
        <div className="space-y-2">
          <label className="text-sm font-medium">Google Search Console</label>
          <Input 
            value={config.seo?.googleVerification || ''} 
            onChange={(e) => onChange({ ...config, seo: { ...config.seo, googleVerification: e.target.value || undefined } })} 
            placeholder="e.g. xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Bing Webmaster Tools</label>
          <Input 
            value={config.seo?.bingVerification || ''} 
            onChange={(e) => onChange({ ...config, seo: { ...config.seo, bingVerification: e.target.value || undefined } })} 
            placeholder="e.g. xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </div>
      </div>
    </div>
  );
}
