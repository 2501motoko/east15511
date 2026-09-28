-- Run once in SQL Editor for an already-deployed database to add 学术茶楼.
create table if not exists public.tea_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text,
  owner_id uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tea_topics_updated on public.tea_topics(updated_at desc);

create table if not exists public.tea_posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.tea_topics(id) on delete cascade,
  parent_id uuid references public.tea_posts(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 5000),
  owner_id uuid not null references public.members(id),
  created_at timestamptz not null default now()
);
create index if not exists tea_posts_topic_created on public.tea_posts(topic_id, created_at);
create index if not exists tea_posts_parent on public.tea_posts(parent_id);

alter table public.tea_topics enable row level security;
alter table public.tea_posts enable row level security;
