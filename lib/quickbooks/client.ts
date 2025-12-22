import OAuthClient from "intuit-oauth";

/**
 * QuickBooks Online API Client
 *
 * Handles authentication, token management, and API requests
 * to QuickBooks Online API v3
 */

interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
  redirectUri: string;
  realmId: string;
}

interface TokenStorage {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
  created_at: number;
}

export class QuickBooksClient {
  private oauthClient: OAuthClient;
  private config: QuickBooksConfig;
  private tokens: TokenStorage | null = null;

  constructor(config?: Partial<QuickBooksConfig>) {
    // Load configuration from environment variables
    this.config = {
      clientId: config?.clientId || process.env.QUICKBOOKS_CLIENT_ID || "",
      clientSecret:
        config?.clientSecret || process.env.QUICKBOOKS_CLIENT_SECRET || "",
      environment:
        (config?.environment as "sandbox" | "production") ||
        (process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production") ||
        "sandbox",
      redirectUri:
        config?.redirectUri ||
        process.env.QUICKBOOKS_REDIRECT_URI ||
        "http://localhost:3000/api/quickbooks/callback",
      realmId: config?.realmId || process.env.QUICKBOOKS_REALM_ID || "",
    };

    // Initialize OAuth client
    this.oauthClient = new OAuthClient({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      environment: this.config.environment,
      redirectUri: this.config.redirectUri,
    });
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  getAuthorizationUrl(): string {
    return this.oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state: "testState", // In production, use a secure random state
    });
  }

  /**
   * Exchange authorization code for access tokens
   */
  async createToken(authCode: string): Promise<void> {
    const authResponse = await this.oauthClient.createToken(authCode);
    this.tokens = {
      access_token: authResponse.token.access_token,
      refresh_token: authResponse.token.refresh_token,
      expires_in: authResponse.token.expires_in,
      x_refresh_token_expires_in: authResponse.token.x_refresh_token_expires_in,
      token_type: authResponse.token.token_type,
      created_at: Date.now(),
    };

    // Store tokens securely (database, encrypted environment, etc.)
    // TODO: Implement secure token storage
  }

  /**
   * Set tokens from storage
   */
  setTokens(tokens: TokenStorage): void {
    this.tokens = tokens;
    this.oauthClient.setToken(tokens);
  }

  /**
   * Check if access token is expired
   */
  isAccessTokenExpired(): boolean {
    if (!this.tokens) return true;

    const expirationTime =
      this.tokens.created_at + this.tokens.expires_in * 1000;
    return Date.now() >= expirationTime;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.tokens) {
      throw new Error("No tokens available to refresh");
    }

    try {
      const authResponse = await this.oauthClient.refresh();
      this.tokens = {
        access_token: authResponse.token.access_token,
        refresh_token: authResponse.token.refresh_token,
        expires_in: authResponse.token.expires_in,
        x_refresh_token_expires_in:
          authResponse.token.x_refresh_token_expires_in,
        token_type: authResponse.token.token_type,
        created_at: Date.now(),
      };

      // Update stored tokens
      // TODO: Implement token update in storage
    } catch (error) {
      console.error("Token refresh failed:", error);
      throw new Error("Failed to refresh access token");
    }
  }

  /**
   * Make authenticated API request to QuickBooks
   */
  async makeApiRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    data?: unknown
  ): Promise<T> {
    // Ensure we have valid tokens
    if (this.isAccessTokenExpired()) {
      await this.refreshAccessToken();
    }

    const baseUrl =
      this.config.environment === "sandbox"
        ? `https://sandbox-quickbooks.api.intuit.com/v3/company/${this.config.realmId}`
        : `https://quickbooks.api.intuit.com/v3/company/${this.config.realmId}`;

    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.tokens?.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `QuickBooks API error: ${response.status} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Get company information (useful for testing connection)
   */
  async getCompanyInfo() {
    return this.makeApiRequest("/companyinfo/" + this.config.realmId, "GET");
  }

  /**
   * Query QuickBooks entities
   */
  async query<T>(queryString: string): Promise<T> {
    const encodedQuery = encodeURIComponent(queryString);
    return this.makeApiRequest(`/query?query=${encodedQuery}`, "GET");
  }

  /**
   * Check if client is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.realmId
    );
  }
}

/**
 * Get singleton QuickBooks client instance
 */
let qbClientInstance: QuickBooksClient | null = null;

export function getQuickBooksClient(): QuickBooksClient {
  if (!qbClientInstance) {
    qbClientInstance = new QuickBooksClient();
  }
  return qbClientInstance;
}
