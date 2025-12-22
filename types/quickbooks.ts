export interface QuickBooksCustomer {
  Id?: string;
  DisplayName: string;
  GivenName: string;
  FamilyName: string;
  PrimaryEmailAddr: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
}

export interface QuickBooksInvoice {
  Id?: string;
  CustomerRef: {
    value: string;
  };
  Line: Array<{
    Amount: number;
    Description: string;
    DetailType: 'SalesItemLineDetail';
    SalesItemLineDetail: {
      ItemRef: {
        value: string;
        name: string;
      };
      UnitPrice: number;
      Qty: number;
    };
  }>;
  DueDate?: string;
  TxnDate?: string;
}

export interface QuickBooksOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
}

export interface QuickBooksCompanyInfo {
  CompanyName: string;
  CompanyAddr: {
    City: string;
    Country: string;
    Line1: string;
    PostalCode: string;
    CountrySubDivisionCode: string;
  };
  Email: {
    Address: string;
  };
}