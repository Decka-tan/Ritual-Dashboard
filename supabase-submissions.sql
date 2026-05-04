create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  description text,
  creator_handle text,
  creator_name text,
  creator_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  preview_url text,
  preview_status text not null default 'pending',
  created_at timestamptz default now(),
  approved_at timestamptz,
  rejected_at timestamptz
);

create index if not exists submissions_status_created_at_idx on submissions (status, created_at desc);

alter table submissions enable row level security;

-- Server-side Vercel API uses the service role key and bypasses RLS.
-- Keep public browser access closed; all reads/writes go through /api/*.
