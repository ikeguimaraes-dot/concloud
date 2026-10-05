create table concloud."OpeningLead" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  activity text not null,
  "zipCode" text not null,
  "addressType" text not null check ("addressType" in ('residencial', 'orientacao')),
  city text not null,
  state text not null,
  plan text not null check (plan in ('essencial', 'gestao', 'proximo')),
  status text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED')),
  "createdAt" timestamp(3) not null default current_timestamp
);

alter table concloud."OpeningLead" enable row level security;
alter table concloud."OpeningLead" force row level security;
revoke all on concloud."OpeningLead" from public, anon, authenticated, concloud_runtime;

create or replace function concloud.submit_opening_lead(
  p_name text, p_email text, p_phone text, p_activity text, p_zip_code text,
  p_address_type text, p_city text, p_state text, p_plan text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, concloud
as $$
declare v_id uuid;
begin
  if length(trim(p_name)) < 3 or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'invalid opening lead';
  end if;
  insert into concloud."OpeningLead" (name,email,phone,activity,"zipCode","addressType",city,state,plan)
  values (trim(p_name),lower(trim(p_email)),trim(p_phone),trim(p_activity),trim(p_zip_code),p_address_type,trim(p_city),trim(p_state),p_plan)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text) from public;
grant execute on function concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text) to concloud_runtime;
grant select, update on concloud."OpeningLead" to concloud_runtime;
