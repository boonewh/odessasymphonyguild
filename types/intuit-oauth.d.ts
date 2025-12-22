declare module "intuit-oauth" {
  export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    environment: "sandbox" | "production";
    redirectUri: string;
  }

  export interface TokenResponse {
    token: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      x_refresh_token_expires_in: number;
      token_type: string;
    };
  }

  export interface AuthorizeUriOptions {
    scope: string[];
    state?: string;
  }

  export default class OAuthClient {
    constructor(config: OAuthConfig);

    static scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      TimeTracking: string;
      Benefits: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
      OpenId: string;
      Intuit_name: string;
    };

    authorizeUri(options: AuthorizeUriOptions): string;
    createToken(authCode: string): Promise<TokenResponse>;
    refresh(): Promise<TokenResponse>;
    setToken(token: any): void;
  }
}
