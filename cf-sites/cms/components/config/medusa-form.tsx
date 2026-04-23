'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { SiteConfig } from '@/lib/types';

interface MedusaFormProps {
  config: SiteConfig;
  onChange: (config: SiteConfig) => void;
  /** Effective backend URL from server (env or saved), for display only. */
  effectiveBackendUrl?: string;
}

export function MedusaSettingsForm({ config, onChange, effectiveBackendUrl = '' }: MedusaFormProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleTokenChange = (value: string) => {
    setTokenInput(value);
    onChange({
      ...config,
      medusa: {
        ...config.medusa,
        adminApiToken: value.trim() || undefined,
        backendUrl: config.medusa?.backendUrl,
      },
    });
  };

  const handleClearToken = () => {
    setTokenInput('');
    onChange({
      ...config,
      medusa: { ...config.medusa, adminApiToken: undefined },
    });
  };

  const handleLogin = async () => {
    if (!email || !password) return;

    setIsLoading(true);
    try {
      const res = await axios.post('/api/medusa/auth', { email, password });

      if (res.data.success && res.data.token) {
        toast({
          title: 'Success',
          description: 'Logged in to Medusa & Token saved successfully.',
        });
        handleTokenChange(res.data.token);
        queryClient.invalidateQueries({ queryKey: ['global-settings'] });
        setEmail('');
        setPassword('');
      } else {
        toast({
          title: 'Error',
          description: res.data.message || 'Login failed',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message || 'Failed to connect',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasToken = !!config.medusa?.adminApiToken;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Medusa Connection</CardTitle>
        <CardDescription>
          Configure the connection to your Medusa backend. Paste a Secret API Key (sk_...) or get a token by logging in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Backend URL</Label>
          <Input
            value={effectiveBackendUrl}
            disabled
            className="bg-muted font-mono"
            placeholder="Set MEDUSA_BACKEND_URL in env or .dev.vars"
          />
          <p className="text-[0.8rem] text-muted-foreground">
            From environment (e.g. wrangler.toml / .dev.vars). Shown for reference.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-token">API Token</Label>
          <Input
            id="api-token"
            type="password"
            autoComplete="off"
            value={tokenInput}
            onChange={(e) => handleTokenChange(e.target.value)}
            placeholder={hasToken ? 'Token saved — paste a new one to replace' : 'Paste Secret API Key (sk_...) or JWT'}
            className="font-mono text-sm"
          />
          <p className="text-[0.8rem] text-muted-foreground">
            From Medusa Admin: Settings → Developer → Secret API Keys. Or use the login below to get a JWT.
          </p>
          {hasToken && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearToken}
              className="text-destructive hover:text-destructive"
            >
              Clear Token
            </Button>
          )}
        </div>

        <div className="rounded-md border p-4 bg-slate-50 space-y-4">
          <h4 className="font-medium text-sm">Or get token by login</h4>
          <div className="grid gap-2">
            <Label htmlFor="email">Admin Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@medusa.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button
            onClick={handleLogin}
            disabled={isLoading || !email || !password}
            className="w-full"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect & Get Token
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
