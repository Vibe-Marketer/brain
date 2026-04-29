import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorToastMessage } from '@/lib/user-friendly-errors';
import { RiMailLine, RiArrowLeftLine } from '@remixicon/react';

const emailSchema = z.string().email('Invalid email address').max(255);

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = emailSchema.safeParse(email);
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(validation.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSent(true);
      toast.success('Reset link sent! Check your email.');
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
              {sent ? 'Check your email' : 'Reset your password'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              {sent
                ? `We sent a password reset link to ${email}`
                : 'Enter your email and we’ll send you a reset link'}
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Didn&rsquo;t receive it? Check your spam folder, or{' '}
                  <button
                    type="button"
                    className="text-foreground font-medium hover:underline"
                    onClick={() => setSent(false)}
                    disabled={loading}
                  >
                    try again
                  </button>
                </p>
              </div>
              <Button asChild variant="hollow" className="w-full h-10 text-sm font-medium">
                <Link to="/login">
                  <RiArrowLeftLine className="mr-2 h-4 w-4" />
                  Back to sign in
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <RiMailLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 text-sm font-medium bg-foreground text-background hover:bg-foreground/90"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>

              <Button asChild variant="ghost" className="w-full h-10 text-sm">
                <Link to="/login">
                  <RiArrowLeftLine className="mr-2 h-4 w-4" />
                  Back to sign in
                </Link>
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
