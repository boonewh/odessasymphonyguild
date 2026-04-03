-- QuickBooks OAuth token storage
-- Tokens are stored AES-encrypted per Intuit's security requirements
-- Run this in the Supabase SQL Editor

create table public.qb_tokens (
  id              uuid primary key default gen_random_uuid(),
  realm_id        text not null unique,       -- QB company ID (encrypted)
  access_token    text not null,              -- AES-encrypted
  refresh_token   text not null,              -- AES-encrypted
  token_type      text not null default 'bearer',
  expires_at      timestamptz not null,       -- when access token expires
  refresh_expires_at timestamptz not null,   -- when refresh token expires (100 days)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Only one active token set needed at a time (one QB company)
-- The unique constraint on realm_id handles this

-- Row level security — tokens should NEVER be accessible from the client
alter table public.qb_tokens enable row level security;

-- No client-side access at all — only server-side service role can read/write
-- (no policies = no access from anon/authenticated keys)
