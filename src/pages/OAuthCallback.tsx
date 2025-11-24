import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { completeFathomOAuth } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RiLoader2Line, RiCheckboxCircleLine, RiCloseCircleLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setErrorMessage(`Authorization failed: ${error}`);
        toast.error(`OAuth error: ${error}`);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setErrorMessage('Missing authorization code or state parameter');
        return;
      }

      try {
        const result = await completeFathomOAuth(code, state);

        if (result.error) {
          throw new Error(result.error);
        }

        setStatus('success');
        toast.success('Successfully connected to Fathom!');

        // Redirect to settings after successful OAuth
        setTimeout(() => {
          navigate('/settings');
        }, 2000);
      } catch (error: any) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setErrorMessage(error?.message || 'Failed to complete OAuth authorization');
        toast.error('Failed to connect to Fathom');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Fathom OAuth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            {status === 'loading' && (
              <>
                <RiLoader2Line className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground text-center">
                  Completing authorization...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <RiCheckboxCircleLine className="h-12 w-12 text-success" />
                <div className="text-center space-y-2">
                  <p className="font-semibold">Successfully Connected!</p>
                  <p className="text-sm text-muted-foreground">
                    Redirecting to settings...
                  </p>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <RiCloseCircleLine className="h-12 w-12 text-destructive" />
                <div className="text-center space-y-2">
                  <p className="font-semibold text-destructive">Connection Failed</p>
                  <p className="text-sm text-muted-foreground">
                    {errorMessage}
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/settings')}
                  variant="hollow"
                  className="mt-4"
                >
                  Return to Settings
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
