import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorToastMessage } from '@/lib/user-friendly-errors';
import { RiLockLine, RiArrowLeftLine } from '@remixicon/react';

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(72);

type TokenState = 'checking' | 'valid' | 'invalid';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenState, setTokenState] = useState<TokenState>('checking');

  useEffect(() => {
    const onAuth = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTokenState('valid');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setTokenState('valid');
      } else {
        const hasRecoveryHash = window.location.hash.includes('type=recovery');
        if (!hasRecoveryHash) {
          setTokenState('invalid');
        }
      }
    });

    const fallback = setTimeout(() => {
      setTokenState((s) => (s === 'checking' ? 'invalid' : s));
    }, 4000);

    return () => {
      onAuth.data.subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = passwordSchema.safeParse(password);
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: validation.data,
      });

      if (error) throw error;

      toast.success('Password updated. Redirecting to your library...');
      setTimeout(() => navigate('/'), 1200);
    } catch (error: unknown) {
      toast.error(getErrorToastMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card shadow-lg px-8 py-10">
          <div className="flex flex-col items-center mb-8">
            <img
              src="/cv-play-button.svg"
              alt="CallVault"
              className="h-12 w-auto mb-4"
            />
            <h1 className="text-xl font-semibold text-foreground">
              {tokenState === 'invalid' ? 'Reset link expired' : 'Set a new password'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              {tokenState === 'invalid'
                ? 'Request a fresh reset link to continue'
                : 'Pick something you’ll remember this time'}
            </p>
          </div>

          {tokenState === 'invalid' ? (
            <div className="space-y-4">
              <Button asChild className="w-full h-10 text-sm font-medium bg-foreground text-background hover:bg-foreground/90">
                <Link to="/forgot-password">Request new reset link</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full h-10 text-sm">
                <Link to="/login">
                  <RiArrowLeftLine className="mr-2 h-4 w-4" />
                  Back to sign in
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  New password
                </Label>
                <div className="relative">
                  <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading || tokenState === 'checking'}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 8 characters with letters, numbers, and a symbol
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm font-medium">
                  Confirm password
                </Label>
                <div className="relative">
                  <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading || tokenState === 'checking'}
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 text-sm font-medium bg-foreground text-background hover:bg-foreground/90"
                disabled={loading || tokenState === 'checking'}
              >
                {loading ? 'Updating...' : tokenState === 'checking' ? 'Verifying link...' : 'Update password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
