import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';
import { getErrorToastMessage } from '@/lib/user-friendly-errors';
import { RiGoogleFill, RiMailLine, RiLockLine, RiArrowLeftLine, RiArrowRightLine } from '@remixicon/react';

const authSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72)
});

type AuthMode = 'signin' | 'signup';

function formatPlanName(plan: string): string {
  const lower = plan.toLowerCase();
  if (lower === 'free') return 'Free';
  if (lower === 'pro') return 'Pro';
  if (lower === 'team') return 'Team';
  return plan;
}

function getPostLoginRedirect(): string {
  const pendingToken = sessionStorage.getItem('pendingShareToken');
  if (pendingToken) {
    sessionStorage.removeItem('pendingShareToken');
    return `/s/${pendingToken}`;
  }
  // Phase 31: pendingNext stashed before external pricing redirect so post-payment
  // return path can still honor an originating next= param.
  const pendingNext = sessionStorage.getItem('pendingNext');
  if (pendingNext) {
    sessionStorage.removeItem('pendingNext');
    if (pendingNext.startsWith('/')) return pendingNext;
  }
  // Support ?next= parameter for OAuth consent redirects and other flows
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next && next.startsWith('/')) {
    return next;
  }
  return '/';
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Phase 31: when the marketing pricing site finishes Polar checkout, it redirects
  // back here with ?signup=true&plan={tier}&email={email}. Use those params to
  // initialize signup-completion mode and prefill the email.
  const signupParam = searchParams.get('signup') === 'true';
  const planParam = searchParams.get('plan');
  const emailParam = searchParams.get('email');
  const initialMode: AuthMode = signupParam ? 'signup' : 'signin';

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(emailParam ?? '');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [signupConfirmEmail, setSignupConfirmEmail] = useState<string | null>(null);

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
          // Phase 31: immediate-session path — locked UI-SPEC copy
          toast.success('Account created — welcome to CallVault!');
          navigate(getPostLoginRedirect());
        } else {
          // Phase 31: email-confirm-pending — full-screen confirmation screen
          // replaces the toast (gold-standard pattern from ForgotPassword.tsx)
          setSignupConfirmEmail(validation.data.email);
        }
      }
    } catch (error: unknown) {
      setSignupConfirmEmail(null);
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
      navigate(getPostLoginRedirect());
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
      // Note: sessionStorage.pendingShareToken (set by SharedCallView before redirect) survives the OAuth
      // round-trip and is consumed by ProtectedRoute.tsx / getPostLoginRedirect() after the user lands back on '/'.
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

  const handleSignUpCtaClick = () => {
    // Preserve any pending share token / next param via sessionStorage so the
    // marketing-site → app round-trip preserves the user's intended destination.
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next) sessionStorage.setItem('pendingNext', next);
    window.location.href = 'https://callvaultai.com/pricing?ref=app';
  };

  const switchToSignin = () => {
    setMode('signin');
    setMagicLinkSent(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-lg px-8 py-10">
          {signupConfirmEmail !== null ? (
            <>
              {/* Phase 31: Email-confirmation screen — mirrors ForgotPassword.tsx pattern */}
              <div className="flex flex-col items-center mb-8">
                <img
                  src="/cv-play-button.svg"
                  alt="CallVault"
                  className="h-12 w-auto mb-4"
                />
                <h1 className="text-xl font-semibold text-foreground">
                  Check your email
                </h1>
                <p className="text-sm text-muted-foreground mt-1 text-center">
                  We sent a confirmation link to {signupConfirmEmail}. Click the link to activate your account.
                </p>
              </div>
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Didn&rsquo;t receive it? Check your spam folder, or{' '}
                    <button
                      type="button"
                      className="text-foreground font-medium hover:underline"
                      onClick={() => setSignupConfirmEmail(null)}
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
            </>
          ) : (
            <>
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
                    : (signupParam && planParam)
                      ? `You're on the ${formatPlanName(planParam)} plan. Set a password to finish.`
                      : 'Set a password to finish setting up your account.'}
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
                    <RiMailLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    {mode === 'signin' && (
                      <Link
                        to="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <RiLockLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
            </>
          )}
        </div>

        {/* Mode switcher - outside the card. Hidden during confirmation screen. */}
        {signupConfirmEmail === null && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === 'signin' ? (
              <>
                Don&rsquo;t have an account?{' '}
                <button
                  type="button"
                  onClick={handleSignUpCtaClick}
                  className="text-foreground font-medium hover:underline inline-flex items-center"
                >
                  Sign up
                  <RiArrowRightLine className="ml-1 h-4 w-4 text-vibe-orange" aria-hidden="true" />
                  <span aria-hidden="true" className="ml-1 text-foreground">view plans</span>
                  <span className="sr-only">view plans</span>
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={switchToSignin}
                  className="text-foreground font-medium hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
