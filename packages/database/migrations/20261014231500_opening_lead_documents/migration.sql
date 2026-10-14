alter table concloud."OpeningLead"
  add column if not exists "documentsSubmittedAt" timestamptz;

create table if not exists concloud."OpeningLeadDocument" (
  id uuid primary key default gen_random_uuid(),
  "openingLeadId" uuid not null references concloud."OpeningLead"(id) on delete restrict,
  kind text not null check (kind in (
    'identidade', 'titulo', 'estado-civil', 'endereco-socio', 'iptu', 'endereco-empresa'
  )),
  filename text not null,
  mime text not null check (mime in ('application/pdf', 'image/png', 'image/jpeg')),
  size integer not null check (size > 0 and size <= 10485760),
  bucket text not null,
  "objectKey" text not null unique,
  "uploadedAt" timestamptz not null default current_timestamp,
  unique ("openingLeadId", kind)
);

alter table concloud."OpeningLeadDocument" enable row level security;
alter table concloud."OpeningLeadDocument" force row level security;
revoke all on table concloud."OpeningLeadDocument" from public, anon, authenticated, concloud_runtime;

create or replace function concloud.get_opening_lead_document_status(
  p_lead_id uuid, p_auth_user_id uuid
) returns table (kind text, "submittedAt" timestamptz)
language sql security definer stable
set search_path = pg_catalog, concloud
as $$
  select d.kind, l."documentsSubmittedAt"
  from concloud."OpeningLead" l
  left join concloud."OpeningLeadDocument" d on d."openingLeadId"=l.id
  where l.id=p_lead_id
    and l."authUserId"=p_auth_user_id
    and l."paymentStatus"='PAID'
$$;

create or replace function concloud.save_opening_lead_document(
  p_lead_id uuid, p_auth_user_id uuid, p_kind text, p_filename text,
  p_mime text, p_size integer, p_bucket text, p_object_key text
) returns void
language plpgsql security definer
set search_path = pg_catalog, concloud
as $$
begin
  if p_kind not in ('identidade','titulo','estado-civil','endereco-socio','iptu','endereco-empresa')
     or p_mime not in ('application/pdf','image/png','image/jpeg')
     or p_size <= 0 or p_size > 10485760
     or p_object_key not like 'opening-leads/' || p_lead_id::text || '/%'
     or length(p_filename) > 255 then
    raise exception 'invalid opening document';
  end if;
  if not exists (
    select 1 from concloud."OpeningLead"
    where id=p_lead_id and "authUserId"=p_auth_user_id and "paymentStatus"='PAID'
  ) then
    raise exception 'opening lead not authorized';
  end if;
  insert into concloud."OpeningLeadDocument"
    ("openingLeadId",kind,filename,mime,size,bucket,"objectKey")
  values (p_lead_id,p_kind,p_filename,p_mime,p_size,p_bucket,p_object_key)
  on conflict ("openingLeadId",kind) do update set
    filename=excluded.filename, mime=excluded.mime, size=excluded.size,
    bucket=excluded.bucket, "objectKey"=excluded."objectKey", "uploadedAt"=current_timestamp;
end;
$$;

create or replace function concloud.complete_opening_lead_documents(
  p_lead_id uuid, p_auth_user_id uuid
) returns timestamptz
language plpgsql security definer
set search_path = pg_catalog, concloud
as $$
declare submitted_at timestamptz;
begin
  if not exists (
    select 1 from concloud."OpeningLead"
    where id=p_lead_id and "authUserId"=p_auth_user_id and "paymentStatus"='PAID'
  ) then
    raise exception 'opening lead not authorized';
  end if;
  if (select count(distinct kind) from concloud."OpeningLeadDocument" where "openingLeadId"=p_lead_id) <> 6 then
    raise exception 'opening documents incomplete';
  end if;
  update concloud."OpeningLead"
  set "documentsSubmittedAt"=coalesce("documentsSubmittedAt",current_timestamp)
  where id=p_lead_id
  returning "documentsSubmittedAt" into submitted_at;
  return submitted_at;
end;
$$;

revoke all on function concloud.get_opening_lead_document_status(uuid,uuid) from public;
revoke all on function concloud.save_opening_lead_document(uuid,uuid,text,text,text,integer,text,text) from public;
revoke all on function concloud.complete_opening_lead_documents(uuid,uuid) from public;
grant execute on function concloud.get_opening_lead_document_status(uuid,uuid) to concloud_runtime;
grant execute on function concloud.save_opening_lead_document(uuid,uuid,text,text,text,integer,text,text) to concloud_runtime;
grant execute on function concloud.complete_opening_lead_documents(uuid,uuid) to concloud_runtime;
