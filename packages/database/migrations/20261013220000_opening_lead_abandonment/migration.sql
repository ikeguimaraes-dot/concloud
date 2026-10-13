alter table concloud."OpeningLead"
  alter column activity drop not null,
  alter column "zipCode" drop not null,
  alter column "addressType" drop not null,
  alter column city drop not null,
  alter column state drop not null,
  alter column plan drop not null,
  add column "draftTokenHash" text,
  add column "funnelStep" integer not null default 1,
  add column "lastActivityAt" timestamp(3) not null default current_timestamp,
  add column "marketingConsent" boolean not null default false,
  add column "marketingConsentAt" timestamp(3),
  add column "adminNotifiedAt" timestamp(3),
  add column "recoveryEmail1At" timestamp(3),
  add column "recoveryEmail2At" timestamp(3);

alter table concloud."OpeningLead" drop constraint if exists "OpeningLead_status_check";
alter table concloud."OpeningLead"
  add constraint "OpeningLead_status_check"
  check (status in ('DRAFT','NEW','CONTACTED','QUALIFIED','CLOSED'));

create unique index "OpeningLead_draftTokenHash_key"
  on concloud."OpeningLead" ("draftTokenHash") where "draftTokenHash" is not null;
create index "OpeningLead_abandonment_idx"
  on concloud."OpeningLead" (status,"lastActivityAt")
  where status='DRAFT';

create or replace function concloud.save_opening_lead_draft(
  p_token_hash text, p_name text, p_cpf text, p_email text, p_phone text,
  p_step integer, p_activity text, p_zip_code text, p_address_type text,
  p_city text, p_state text, p_plan text, p_marketing_consent boolean
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, concloud
as $$
declare v_id uuid;
begin
  if length(p_token_hash) <> 64 or length(trim(p_name)) < 3
    or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    or p_cpf !~ '^[0-9]{11}$' or p_step not between 1 and 4 then
    raise exception 'invalid opening draft';
  end if;

  select id into v_id from concloud."OpeningLead"
  where "draftTokenHash"=p_token_hash
     or (cpf=p_cpf and status='DRAFT' and "authUserId" is null)
  order by ("draftTokenHash"=p_token_hash) desc limit 1;

  if v_id is null then
    insert into concloud."OpeningLead"
      (name,cpf,email,phone,activity,"zipCode","addressType",city,state,plan,status,
       "draftTokenHash","funnelStep","lastActivityAt","marketingConsent","marketingConsentAt")
    values
      (trim(p_name),p_cpf,lower(trim(p_email)),trim(p_phone),nullif(trim(p_activity),''),
       nullif(trim(p_zip_code),''),nullif(p_address_type,''),nullif(trim(p_city),''),
       nullif(trim(p_state),''),nullif(p_plan,''),'DRAFT',p_token_hash,p_step,current_timestamp,
       p_marketing_consent,case when p_marketing_consent then current_timestamp end)
    returning id into v_id;
  else
    update concloud."OpeningLead" set
      name=trim(p_name), email=lower(trim(p_email)), phone=trim(p_phone),
      activity=coalesce(nullif(trim(p_activity),''),activity),
      "zipCode"=coalesce(nullif(trim(p_zip_code),''),"zipCode"),
      "addressType"=coalesce(nullif(p_address_type,''),"addressType"),
      city=coalesce(nullif(trim(p_city),''),city), state=coalesce(nullif(trim(p_state),''),state),
      plan=coalesce(nullif(p_plan,''),plan), "draftTokenHash"=p_token_hash,
      "funnelStep"=greatest("funnelStep",p_step), "lastActivityAt"=current_timestamp,
      "marketingConsent"=p_marketing_consent,
      "marketingConsentAt"=case when p_marketing_consent then coalesce("marketingConsentAt",current_timestamp) end,
      "adminNotifiedAt"=null
    where id=v_id;
  end if;
  return v_id;
end;
$$;

drop function if exists concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text,text,uuid);
create or replace function concloud.submit_opening_lead(
  p_name text, p_cpf text, p_email text, p_phone text, p_activity text,
  p_zip_code text, p_address_type text, p_city text, p_state text,
  p_plan text, p_auth_user_id uuid, p_token_hash text
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, concloud
as $$
declare v_id uuid;
begin
  if length(trim(p_name)) < 3
    or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    or p_cpf !~ '^[0-9]{11}$' or length(p_token_hash) <> 64 then
    raise exception 'invalid opening registration';
  end if;
  update concloud."OpeningLead" set
    name=trim(p_name),cpf=p_cpf,email=lower(trim(p_email)),phone=trim(p_phone),
    activity=trim(p_activity),"zipCode"=trim(p_zip_code),"addressType"=p_address_type,
    city=trim(p_city),state=trim(p_state),plan=p_plan,"authUserId"=p_auth_user_id,
    status='NEW',"funnelStep"=4,"lastActivityAt"=current_timestamp
  where "draftTokenHash"=p_token_hash and status='DRAFT'
  returning id into v_id;
  if v_id is null then
    insert into concloud."OpeningLead"
      (name,cpf,email,phone,activity,"zipCode","addressType",city,state,plan,"authUserId",
       status,"draftTokenHash","funnelStep","lastActivityAt")
    values
      (trim(p_name),p_cpf,lower(trim(p_email)),trim(p_phone),trim(p_activity),trim(p_zip_code),
       p_address_type,trim(p_city),trim(p_state),p_plan,p_auth_user_id,'NEW',p_token_hash,4,current_timestamp)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function concloud.get_abandoned_opening_leads()
returns table (id uuid,name text,email text,phone text,"funnelStep" integer,"lastActivityAt" timestamp,
  "marketingConsent" boolean,"adminNotifiedAt" timestamp,"recoveryEmail1At" timestamp,"recoveryEmail2At" timestamp)
language sql security definer stable
set search_path = pg_catalog, concloud
as $$
  select l.id,l.name,l.email,l.phone,l."funnelStep",l."lastActivityAt",l."marketingConsent",
         l."adminNotifiedAt",l."recoveryEmail1At",l."recoveryEmail2At"
  from concloud."OpeningLead" l
  where l.status='DRAFT' and l."lastActivityAt" < current_timestamp - interval '1 hour'
  order by l."lastActivityAt" asc limit 200
$$;

create or replace function concloud.mark_opening_lead_followup(
  p_id uuid, p_admin_notified boolean, p_recovery_number integer
) returns void
language plpgsql security definer
set search_path = pg_catalog, concloud
as $$
begin
  update concloud."OpeningLead" set
    "adminNotifiedAt"=case when p_admin_notified then current_timestamp else "adminNotifiedAt" end,
    "recoveryEmail1At"=case when p_recovery_number=1 then current_timestamp else "recoveryEmail1At" end,
    "recoveryEmail2At"=case when p_recovery_number=2 then current_timestamp else "recoveryEmail2At" end
  where id=p_id and status='DRAFT';
end;
$$;

revoke all on function concloud.save_opening_lead_draft(text,text,text,text,text,integer,text,text,text,text,text,text,boolean) from public;
revoke all on function concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text,text,uuid,text) from public;
revoke all on function concloud.get_abandoned_opening_leads() from public;
revoke all on function concloud.mark_opening_lead_followup(uuid,boolean,integer) from public;
grant execute on function concloud.save_opening_lead_draft(text,text,text,text,text,integer,text,text,text,text,text,text,boolean) to concloud_runtime;
grant execute on function concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text,text,uuid,text) to concloud_runtime;
grant execute on function concloud.get_abandoned_opening_leads() to concloud_runtime;
grant execute on function concloud.mark_opening_lead_followup(uuid,boolean,integer) to concloud_runtime;
