create table if not exists public.duty_weekly_schedule (
  weekday smallint primary key check (weekday between 0 and 6),
  member_username text not null,
  updated_at timestamptz not null default now()
);

insert into public.duty_weekly_schedule (weekday, member_username) values
  (0, '刘佳'), (1, '王为钧'), (3, '谢俞淇'), (5, '赵英')
on conflict (weekday) do nothing;

alter table public.duty_weekly_schedule enable row level security;
