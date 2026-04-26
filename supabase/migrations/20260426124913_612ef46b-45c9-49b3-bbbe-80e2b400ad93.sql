
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  post_number serial unique,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  category text not null default 'Announcements',
  tags text[] not null default '{}',
  featured boolean not null default false,
  published boolean not null default true,
  image_url text,
  views_count integer not null default 0,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  read_time_minutes integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

drop policy if exists "Public read published blog posts" on public.blog_posts;
create policy "Public read published blog posts"
  on public.blog_posts for select
  using (published = true);

create or replace function public.increment_blog_post_views(post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.blog_posts set views_count = views_count + 1 where id = post_id;
$$;

create or replace function public.get_post_by_number(p_post_number integer)
returns setof public.blog_posts
language sql
stable
security definer
set search_path = public
as $$
  select * from public.blog_posts where post_number = p_post_number and published = true limit 1;
$$;

insert into public.blog_posts (title, excerpt, content, category, tags, featured, read_time_minutes)
select 'fan.site Launching April 2026',
       'The countdown is on. Our decentralized creator platform launches Spring 2026.',
       E'We are thrilled to announce that fan.site is targeting an April 2026 launch.\n\nUltra-low fees (as low as 1%), end-to-end encryption, censorship-resistant infrastructure, and instant 24/7/365 settlement.\n\nTGE will follow the app launch.',
       'Announcements', ARRAY['launch','roadmap','fans'], true, 4
where not exists (select 1 from public.blog_posts);
