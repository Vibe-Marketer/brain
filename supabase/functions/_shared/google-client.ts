/**
 * Google API client utility with retry logic.
 * Follows the same pattern as FathomClient for consistency.
 */

export interface GoogleFetchOptions extends RequestInit {
  maxRetries?: number;
  baseDelay?: number;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export class GoogleClient {
  private static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch with exponential backoff retry logic.
   * Handles 429 rate limiting and network errors.
   *
   * @param url - The URL to fetch
   * @param options - Fetch options with optional retry configuration
   * @returns The fetch Response
   */
  static async fetchWithRetry(url: string, options: GoogleFetchOptions = {}): Promise<Response> {
    const {
      maxRetries = 5,
      baseDelay = 1000,
      ...fetchOptions
    } = options;

    let lastError: unknown;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch(url, fetchOptions);

        // Success or client error (4xx except 429) - return immediately
        if (response.status !== 429 && response.status !== 503) {
          return response;
        }

        // Handle 429 (rate limited) or 503 (service unavailable)
        const jitter = Math.random() * 1000;

        // Check for Retry-After header (Google APIs often provide this)
        const retryAfter = response.headers.get('Retry-After');
        let delayTime: number;

        if (retryAfter) {
          // Retry-After can be seconds or HTTP date
          const retrySeconds = parseInt(retryAfter, 10);
          delayTime = (isNaN(retrySeconds) ? baseDelay : retrySeconds * 1000) + jitter;
        } else {
          // Exponential backoff with jitter
          delayTime = (Math.pow(2, attempt) * baseDelay) + jitter;
        }

        console.warn(
          `[GoogleClient] Rate limited (${response.status}) on ${url}. ` +
          `Retrying in ${delayTime.toFixed(0)}ms (Attempt ${attempt + 1}/${maxRetries})`
        );

        await this.delay(delayTime);
      } catch (error) {
        console.warn(
          `[GoogleClient] Network error on ${url}: ${error}. ` +
          `Retrying... (Attempt ${attempt + 1}/${maxRetries})`
        );
        lastError = error;

        const jitter = Math.random() * 1000;
        const delayTime = (Math.pow(2, attempt) * baseDelay) + jitter;
        await this.delay(delayTime);
      }
    }

    if (response) {
      return response; // Return the last rate-limited response if we exhausted retries
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
  }

  /**
   * Make an authenticated request to a Google API.
   *
   * @param url - The API endpoint URL
   * @param accessToken - OAuth access token
   * @param options - Additional fetch options
   * @returns The fetch Response
   */
  static async fetchWithAuth(
    url: string,
    accessToken: string,
    options: GoogleFetchOptions = {}
  ): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    return this.fetchWithRetry(url, {
      ...options,
      headers,
    });
  }

  /**
   * Exchange authorization code for tokens.
   *
   * @param code - The authorization code from OAuth callback
   * @param clientId - Google OAuth client ID
   * @param clientSecret - Google OAuth client secret
   * @param redirectUri - The redirect URI used in the authorization request
   * @returns The token response
   */
  static async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<GoogleTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const response = await this.fetchWithRetry('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Token exchange failed: ${errorData.error_description || errorData.error || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Refresh an expired access token using a refresh token.
   *
   * @param refreshToken - The refresh token
   * @param clientId - Google OAuth client ID
   * @param clientSecret - Google OAuth client secret
   * @returns The new token response (may not include refresh_token)
   */
  static async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<GoogleTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await this.fetchWithRetry('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Token refresh failed: ${errorData.error_description || errorData.error || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Get the user's profile information from Google.
   *
   * @param accessToken - OAuth access token
   * @returns User info including email
   */
  static async getUserInfo(accessToken: string): Promise<{ email: string; name?: string }> {
    const response = await this.fetchWithAuth(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      accessToken
    );

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if an access token is expired or about to expire.
   *
   * @param expiresAt - Token expiration timestamp (in seconds)
   * @param bufferSeconds - Buffer time before expiration to consider token expired
   * @returns True if token is expired or will expire within buffer
   */
  static isTokenExpired(expiresAt: number, bufferSeconds = 300): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= (expiresAt - bufferSeconds);
  }
}
