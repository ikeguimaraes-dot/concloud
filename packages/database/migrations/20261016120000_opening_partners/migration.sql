alter table concloud."OpeningLead"
  add column if not exists partners jsonb not null default '[]'::jsonb;

update concloud."OpeningLead"
set partners=jsonb_build_array(jsonb_build_object('name',name,'cpf',cpf,'percentage',100))
where partners='[]'::jsonb;

alter table concloud."OpeningLead"
  add constraint "OpeningLead_partners_check" check (
    jsonb_typeof(partners) = 'array' and jsonb_array_length(partners) between 1 and 21
  );

create or replace function concloud.submit_opening_lead(
  p_name text, p_cpf text, p_email text, p_phone text, p_activity text,
  p_zip_code text, p_address_type text, p_city text, p_state text,
  p_plan text, p_auth_user_id uuid, p_token_hash text, p_partners jsonb
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, concloud
as $$
declare v_id uuid;
declare v_total numeric;
begin
  select sum((partner->>'percentage')::numeric) into v_total
  from jsonb_array_elements(p_partners) partner;
  if length(trim(p_name)) < 3
    or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    or p_cpf !~ '^[0-9]{11}$' or length(p_token_hash) <> 64
    or jsonb_typeof(p_partners) <> 'array'
    or jsonb_array_length(p_partners) not between 1 and 21
    or abs(coalesce(v_total, 0) - 100) > 0.001
    or exists (
      select 1 from jsonb_array_elements(p_partners) partner
      where length(trim(partner->>'name')) < 3
        or partner->>'cpf' !~ '^[0-9]{11}$'
        or (partner->>'percentage')::numeric <= 0
    ) then
    raise exception 'invalid opening registration';
  end if;

  select id into v_id
  from concloud."OpeningLead"
  where cpf=p_cpf and lower(email)=lower(trim(p_email))
    and ("authUserId" is null or "authUserId"=p_auth_user_id)
  limit 1;
  if v_id is null then
    select id into v_id from concloud."OpeningLead"
    where "draftTokenHash"=p_token_hash and status='DRAFT' limit 1;
  end if;
  if v_id is null then
    insert into concloud."OpeningLead"
      (name,cpf,email,phone,activity,"zipCode","addressType",city,state,plan,"authUserId",
       status,"draftTokenHash","funnelStep","lastActivityAt",partners)
    values
      (trim(p_name),p_cpf,lower(trim(p_email)),trim(p_phone),trim(p_activity),trim(p_zip_code),
       p_address_type,trim(p_city),trim(p_state),p_plan,p_auth_user_id,'NEW',p_token_hash,5,
       current_timestamp,p_partners)
    returning id into v_id;
  else
    update concloud."OpeningLead" set
      name=trim(p_name),cpf=p_cpf,email=lower(trim(p_email)),phone=trim(p_phone),
      activity=trim(p_activity),"zipCode"=trim(p_zip_code),"addressType"=p_address_type,
      city=trim(p_city),state=trim(p_state),plan=p_plan,"authUserId"=p_auth_user_id,
      status='NEW',"funnelStep"=5,"lastActivityAt"=current_timestamp,partners=p_partners
    where id=v_id;
  end if;
  return v_id;
end;
$$;

alter table concloud."OpeningLeadDocument" drop constraint if exists "OpeningLeadDocument_kind_check";
update concloud."OpeningLeadDocument"
set kind='socio-1-' || kind
where kind in ('identidade','titulo','estado-civil','endereco-socio');
alter table concloud."OpeningLeadDocument" add constraint "OpeningLeadDocument_kind_check" check (
  kind in ('iptu','endereco-empresa')
  or kind ~ '^socio-[1-9][0-9]*-(identidade|titulo|estado-civil|endereco-socio)$'
);

drop function if exists concloud.get_opening_lead_document_status(uuid,uuid);
create function concloud.get_opening_lead_document_status(
  p_lead_id uuid, p_auth_user_id uuid
) returns table (kind text, "submittedAt" timestamptz, partners jsonb)
language sql security definer stable
set search_path = pg_catalog, concloud
as $$
  select d.kind, l."documentsSubmittedAt", l.partners
  from concloud."OpeningLead" l
  left join concloud."OpeningLeadDocument" d on d."openingLeadId"=l.id
  where l.id=p_lead_id and l."authUserId"=p_auth_user_id and l."paymentStatus"='PAID'
$$;

create or replace function concloud.save_opening_lead_document(
  p_lead_id uuid, p_auth_user_id uuid, p_kind text, p_filename text,
  p_mime text, p_size integer, p_bucket text, p_object_key text
) returns void
language plpgsql security definer
set search_path = pg_catalog, concloud
as $$
declare v_partner_count integer;
declare v_partner_number integer;
begin
  select jsonb_array_length(partners) into v_partner_count from concloud."OpeningLead" where id=p_lead_id;
  if p_kind like 'socio-%' then v_partner_number := (regexp_match(p_kind, '^socio-([0-9]+)-'))[1]::integer; end if;
  if not (p_kind in ('iptu','endereco-empresa') or
          (p_kind ~ '^socio-[1-9][0-9]*-(identidade|titulo|estado-civil|endereco-socio)$'
           and v_partner_number <= v_partner_count))
     or p_mime not in ('application/pdf','image/png','image/jpeg')
     or p_size <= 0 or p_size > 10485760
     or p_object_key not like 'opening-leads/' || p_lead_id::text || '/%'
     or length(p_filename) > 255 then raise exception 'invalid opening document'; end if;
  if not exists (select 1 from concloud."OpeningLead" where id=p_lead_id and "authUserId"=p_auth_user_id and "paymentStatus"='PAID')
    then raise exception 'opening lead not authorized'; end if;
  insert into concloud."OpeningLeadDocument" ("openingLeadId",kind,filename,mime,size,bucket,"objectKey")
  values (p_lead_id,p_kind,p_filename,p_mime,p_size,p_bucket,p_object_key)
  on conflict ("openingLeadId",kind) do update set filename=excluded.filename,mime=excluded.mime,
    size=excluded.size,bucket=excluded.bucket,"objectKey"=excluded."objectKey","uploadedAt"=current_timestamp;
end;
$$;

create or replace function concloud.complete_opening_lead_documents(
  p_lead_id uuid, p_auth_user_id uuid
) returns timestamptz
language plpgsql security definer
set search_path = pg_catalog, concloud
as $$
declare submitted_at timestamptz;
declare required_count integer;
begin
  if not exists (select 1 from concloud."OpeningLead" where id=p_lead_id and "authUserId"=p_auth_user_id and "paymentStatus"='PAID')
    then raise exception 'opening lead not authorized'; end if;
  select jsonb_array_length(partners) * 4 + 2 into required_count from concloud."OpeningLead" where id=p_lead_id;
  if (select count(distinct kind) from concloud."OpeningLeadDocument" where "openingLeadId"=p_lead_id) <> required_count
    then raise exception 'opening documents incomplete'; end if;
  update concloud."OpeningLead" set "documentsSubmittedAt"=coalesce("documentsSubmittedAt",current_timestamp)
  where id=p_lead_id returning "documentsSubmittedAt" into submitted_at;
  return submitted_at;
end;
$$;

revoke all on function concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text,text,uuid,text,jsonb) from public;
grant execute on function concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text,text,uuid,text,jsonb) to concloud_runtime;
revoke all on function concloud.get_opening_lead_document_status(uuid,uuid) from public;
grant execute on function concloud.get_opening_lead_document_status(uuid,uuid) to concloud_runtime;
