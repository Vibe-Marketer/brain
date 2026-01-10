export interface ZoomFetchOptions extends RequestInit {
  maxRetries?: number;
  baseDelay?: number;
}

export interface ZoomApiErrorResponse {
  code?: number;
  message?: string;
}

export class ZoomClient {
  static readonly BASE_URL = 'https://api.zoom.us/v2';
  static readonly OAUTH_URL = 'https://zoom.us/oauth';

  private static async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async fetchWithRetry(url: string, options: ZoomFetchOptions = {}): Promise<Response> {
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

        if (response.status !== 429) {
          return response;
        }

        // Handle 429 rate limit
        const jitter = Math.random() * 1000;
        const delayTime = (Math.pow(2, attempt) * baseDelay) + jitter;

        console.warn(`[ZoomClient] Rate limited (429) on ${url}. Retrying in ${delayTime.toFixed(0)}ms (Attempt ${attempt + 1}/${maxRetries})`);

        await this.delay(delayTime);
      } catch (error) {
        console.warn(`[ZoomClient] Network error on ${url}: ${error}. Retrying... (Attempt ${attempt + 1}/${maxRetries})`);
        lastError = error;

        const jitter = Math.random() * 1000;
        const delayTime = (Math.pow(2, attempt) * baseDelay) + jitter;
        await this.delay(delayTime);
      }
    }

    if (response) {
      return response; // Return the last 429 response if we exhausted retries
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
  }

  /**
   * Makes an authenticated API request to Zoom with retry logic.
   * Automatically prepends the base URL if the path doesn't start with http.
   */
  static async apiRequest(
    path: string,
    accessToken: string,
    options: ZoomFetchOptions = {}
  ): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.BASE_URL}${path}`;

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Content-Type', 'application/json');

    return this.fetchWithRetry(url, {
      ...options,
      headers,
    });
  }

  /**
   * Exchanges an authorization code for access and refresh tokens.
   */
  static async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<Response> {
    const tokenUrl = `${this.OAUTH_URL}/token`;
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    return this.fetchWithRetry(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  }

  /**
   * Refreshes an access token using a refresh token.
   */
  static async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<Response> {
    const tokenUrl = `${this.OAUTH_URL}/token`;
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    return this.fetchWithRetry(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  }

  /**
   * Generates the OAuth authorization URL for user consent.
   */
  static generateAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    state: string
  ): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });

    return `${this.OAUTH_URL}/authorize?${params.toString()}`;
  }
}
