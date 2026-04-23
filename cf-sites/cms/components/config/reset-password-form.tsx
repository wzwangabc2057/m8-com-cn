'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, KeyRound } from 'lucide-react';
import { useStore } from '@/lib/store';

export function ResetPasswordForm() {
  const { apiKey } = useStore();
  const { toast } = useToast();
  
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      await axios.put('/api/medusa/users', { password }, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      toast({ title: 'Password updated', description: 'Your admin password has been successfully reset.' });
      setPassword('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to reset password';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    if (!confirm('Are you sure you want to reset the password for the current API Token user?')) return;
    mutation.mutate();
  };

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Reset Admin Password
        </CardTitle>
        <CardDescription>
          Reset the password for the user associated with the current API Token (likely the root admin).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new secure password"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" variant="secondary" disabled={mutation.isPending || !password}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
