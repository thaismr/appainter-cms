-- App Contents

create table app_public.categories (
  id serial primary key,
  language text not null default 'en-en',
  slug text not null check(length(slug) < 30 and slug ~ '^([a-z0-9]-?)+$') unique,
  name text not null check(length(name) > 0),
  description text not null default ''
);
create index categories_by_language_index on app_public.categories(language);
alter table app_public.categories enable row level security;

comment on table app_public.categories is
  E'A subject-based grouping of pages.';
comment on column app_public.categories.language is
  E'The language this `Category` belongs to.';
comment on column app_public.categories.slug is
  E'An URL-safe alias for the `Category`.';
comment on column app_public.categories.name is
  E'The name of the `Category` (indicates its subject matter).';
comment on column app_public.categories.description is
  E'A brief description of the `Category` including it''s purpose.';

create policy select_all on app_public.categories for select using (true);
create policy insert_admin on app_public.categories for insert with check (app_public.current_user_is_admin());
create policy update_admin on app_public.categories for update using (app_public.current_user_is_admin());
create policy delete_admin on app_public.categories for delete using (app_public.current_user_is_admin());
grant select on app_public.categories to appainter_visitor;
grant insert(language, slug, name, description) on app_public.categories to appainter_visitor;
grant update(language, slug, name, description) on app_public.categories to appainter_visitor;
grant delete on app_public.categories to appainter_visitor;

--------------------------------------------------------------------------------

create table app_public.pages (
  id serial,
  category_id int not null references app_public.categories on delete cascade,
  author_id varchar not null default app_public.current_user_id() references app_public.users on delete cascade,
  slug text not null check(length(slug) < 30 and slug ~ '^([a-z0-9]-?)+$') unique,
  title text not null check(length(title) > 0),
  body text not null default '',
  fields json default '{}'::json,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, category_id, author_id)
);
-- Order pages by most recently updated
create index pages_newest_index on app_public.pages(updated_at desc);
alter table app_public.pages enable row level security;
create trigger _100_timestamps
  before insert or update on app_public.pages
  for each row
  execute procedure app_private.tg__update_timestamps();

comment on table app_public.pages is
  E'An individual page within a Category.';
comment on column app_public.pages.category_id is
  E'The `Category` of the `Page`.';
comment on column app_public.pages.author_id is
  E'@omit create,update\nThe `Author` of the `Page`.';
comment on column app_public.pages.slug is
  E'The unique slug of the `Page`.';
comment on column app_public.pages.title is
  E'The title of the `Page`.';
comment on column app_public.pages.body is
  E'The main body of the `Page`.';
comment on column app_public.pages.fields is
  E'Extra fields for this `Page`.';
comment on column app_public.pages.created_at is
  E'@omit create,update';
comment on column app_public.pages.updated_at is
  E'@omit create,update';

create policy select_all on app_public.pages for select using (true);
create policy insert_admin on app_public.pages for insert with check (app_public.current_user_is_admin());
create policy update_admin on app_public.pages for update using (app_public.current_user_is_admin());
create policy delete_admin on app_public.pages for delete using (app_public.current_user_is_admin());
grant select on app_public.pages to appainter_visitor;
grant insert(category_id, slug, title, body, fields) on app_public.pages to appainter_visitor;
grant update(category_id, slug, title, body, fields) on app_public.pages to appainter_visitor;
grant delete on app_public.pages to appainter_visitor;

create function app_public.pages_body_summary(
  t app_public.pages,
  max_length int = 50
)
returns text
language sql
stable
set search_path from current
as $$
  select case
    when length(t.body) > max_length
    then left(t.body, max_length - 3) || '...'
    else t.body
    end;
$$;

--------------------------------------------------------------------------------

-- create table app_public.fields (
--   id serial,
--   page_id int not null references app_public.pages on delete cascade,
--   body json DEFAULT '{}'::json NOT NULL,
--   primary key (id, page_id)
-- );
-- alter table app_public.fields enable row level security;
--
-- comment on table app_public.fields is
--   E'An individual field within a Page.';
-- comment on column app_public.fields.id is
--   E'@omit create,update';
-- comment on column app_public.fields.page_id is
--   E'@omit update';
-- comment on column app_public.fields.body is
--   E'The body of the `Field`, which belongs to a Page.';
--
-- create policy select_all on app_public.fields for select using (true);
-- create policy insert_admin on app_public.fields for insert with check (app_public.current_user_is_admin());
-- create policy update_admin on app_public.fields for update using (app_public.current_user_is_admin());
-- create policy delete_admin on app_public.fields for delete using (app_public.current_user_is_admin());
-- grant select on app_public.fields to appainter_visitor;
-- grant insert(page_id, body) on app_public.fields to appainter_visitor;
-- grant update(page_id, body) on app_public.fields to appainter_visitor;
-- grant delete on app_public.fields to appainter_visitor;


create table app_public.messages (
  id serial primary key,
  email citext not null check(email ~ '[^@]+@[^@]+\.[^@]+'),
  subject text not null check(length(subject) > 0),
  body text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table app_public.messages enable row level security;
create trigger _100_timestamps
  before insert or update on app_public.messages
  for each row
  execute procedure app_private.tg__update_timestamps();

comment on table app_public.messages is
  E'An individual contact message.';
comment on table app_public.messages.email is
  E'The reply-to email.';
comment on column app_public.messages.subject is
  E'The subject of this message.';
comment on column app_public.messages.body is
  E'The body of the contact message.';

create policy select_admin on app_public.messages for select using (app_public.current_user_is_admin());
create policy insert_all on app_public.messages for insert with check (true);
create policy update_admin on app_public.messages for update using (app_public.current_user_is_admin());
create policy delete_admin on app_public.messages for delete using (app_public.current_user_is_admin());
grant select on app_public.messages to appainter_visitor;
grant insert(email, subject, body) on app_public.messages to appainter_visitor;
grant update(is_read) on app_public.messages to appainter_visitor;
grant delete on app_public.messages to appainter_visitor;
