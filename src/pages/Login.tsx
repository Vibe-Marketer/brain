import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorToastMessage } from '@/lib/user-friendly-errors';
import { RiGoogleFill, RiMailLine, RiLockLine } from '@remixicon/react';

const authSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72)
});

type AuthMode = 'signin' | 'signup';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<AuthMode>('signin');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = authSchema.safeParse({ email, password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      const { data: { user, session }, error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      if (user) {
        if (session) {
          toast.success('Account created successfully!');
          navigate('/');
        } else {
          toast.success('Account created! Please check your email to confirm your account.');
          setEmail('');
          setPassword('');
        }
      }
    } catch (error: unknown) {
      toast.error(getErrorToastMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = authSchema.safeParse({ email, password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password
      });

      if (error) throw error;

      toast.success('Signed in successfully!');
      navigate('/');
    } catch (error: unknown) {
      toast.error(getErrorToastMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error('Please enter your email address first');
      return;
    }

    const emailValidation = z.string().email('Invalid email address').max(255).safeParse(email);
    if (!emailValidation.success) {
      toast.error(emailValidation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: emailValidation.data,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
      toast.success('Magic link sent! Check your email.');
    } catch (error: unknown) {
      toast.error(getErrorToastMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;
    } catch (error: unknown) {
      toast.error(getErrorToastMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = mode === 'signin' ? handleSignIn : handleSignUp;

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setMagicLinkSent(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-lg px-8 py-10">
          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-8">
            <img
              src="/cv-play-button.svg"
              alt="CallVault"
              className="h-12 w-auto mb-4"
            />
            <h1 className="text-xl font-semibold text-foreground">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === 'signin'
                ? 'Sign in to your CallVault account'
                : 'Get started with CallVault'}
            </p>
          </div>

          {/* Google OAuth */}
          <Button
            type="button"
            variant="hollow"
            className="w-full h-10 text-sm font-medium"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <RiGoogleFill className="mr-2 h-4 w-4" />
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-muted-foreground">
                or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
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

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
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
                  disabled={loading}
                  className="pl-9"
                />
              </div>
              {mode === 'signup' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 6 characters
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-sm font-medium bg-foreground text-background hover:bg-foreground/90"
              disabled={loading}
            >
              {loading
                ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
                : (mode === 'signin' ? 'Sign in' : 'Create account')}
            </Button>
          </form>

          {/* Magic Link (sign in only) */}
          {mode === 'signin' && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground">or</span>
                </div>
              </div>

              {magicLinkSent ? (
                <div className="text-center space-y-2 rounded-lg border border-border p-4">
                  <p className="text-sm font-medium">Check your email</p>
                  <p className="text-xs text-muted-foreground">
                    We sent a magic link to <strong>{email}</strong>
                  </p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => setMagicLinkSent(false)}
                    disabled={loading}
                  >
                    Didn't receive it? Try again
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="hollow"
                  className="w-full h-10 text-sm font-medium"
                  onClick={handleMagicLink}
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send me a magic link'}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Mode switcher - outside the card */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={switchMode}
                className="text-foreground font-medium hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={switchMode}
                className="text-foreground font-medium hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
