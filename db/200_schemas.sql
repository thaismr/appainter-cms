CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

create schema app_public;
create schema app_private;

grant usage on schema app_public to appainter_visitor;

-- This allows inserts without granting permission to the serial primary key column.
alter default privileges for role appainter in schema app_public grant usage, select on sequences to appainter_visitor;
