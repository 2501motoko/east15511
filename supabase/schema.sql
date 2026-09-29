-- Run once in the Supabase SQL Editor for a new project.
create extension if not exists pgcrypto;

create table if not exists public.member_invites (
  email text primary key,
  role text not null default 'member' check (role in ('admin', 'member')),
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now()
);

alter table public.member_invites
  add constraint member_invites_created_by_fkey
  foreign key (created_by) references public.members(id) on delete set null;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid not null references public.members(id),
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  title text not null,
  file_name text not null,
  object_key text not null unique,
  content_type text not null,
  size integer not null,
  uploader_id uuid not null references public.members(id),
  created_at timestamptz not null default now()
);
create index if not exists resources_course_created on public.resources(course_id, created_at desc);

create table if not exists public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ddl', 'activity')),
  title text not null,
  course_id uuid references public.courses(id),
  item_date date not null,
  due_time time,
  start_time time,
  end_time time,
  location text,
  notes text,
  is_public boolean not null default true,
  owner_id uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  check ((kind = 'ddl' and course_id is not null) or (kind = 'activity' and course_id is null))
);
create index if not exists calendar_date_kind on public.calendar_items(item_date, kind);

create table if not exists public.duty_rota (
  id uuid primary key default gen_random_uuid(),
  duty_date date not null unique,
  garbage_member_id uuid references public.members(id),
  sweep_member_id uuid references public.members(id),
  garbage_done boolean not null default false,
  sweep_done boolean not null default false,
  garbage_done_by uuid references public.members(id),
  sweep_done_by uuid references public.members(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.sport_logs (
  id uuid primary key default gen_random_uuid(),
  activity_type text,
  duration_minutes integer check (duration_minutes between 1 and 1440),
  activity_date date not null,
  is_public boolean not null default true,
  owner_id uuid not null references public.members(id),
  created_at timestamptz not null default now()
);
create index if not exists sport_logs_date on public.sport_logs(activity_date desc);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  caption text,
  memory_date date,
  file_name text not null,
  object_key text not null unique,
  content_type text not null,
  size integer not null,
  uploader_id uuid not null references public.members(id),
  created_at timestamptz not null default now()
);
create index if not exists memories_date on public.memories(memory_date desc);

create table if not exists public.tea_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  zone text not null default 'academic' check (zone in ('academic', 'life')),
  description text,
  tags text[] not null default '{}',
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

alter table public.member_invites enable row level security;
alter table public.members enable row level security;
alter table public.courses enable row level security;
alter table public.resources enable row level security;
alter table public.calendar_items enable row level security;
alter table public.duty_rota enable row level security;
alter table public.sport_logs enable row level security;
alter table public.memories enable row level security;
alter table public.tea_topics enable row level security;
alter table public.tea_posts enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('course-files', 'course-files', false, 26214400, array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','text/plain','text/markdown','application/zip','application/x-zip-compressed']),
  ('dorm-photos', 'dorm-photos', false, 26214400, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
