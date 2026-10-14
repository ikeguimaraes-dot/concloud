alter table concloud."OpeningLead"
  add column if not exists "documentsNotifiedAt" timestamptz;

create or replace function concloud.get_opening_lead_profile(p_auth_user_id uuid)
returns table (
  id uuid, name text, cpf text, email text, phone text, activity text,
  "zipCode" text, "addressType" text, city text, state text, plan text,
  "paymentStatus" text, "documentsSubmittedAt" timestamptz,
  "documentsNotifiedAt" timestamptz, documents jsonb
)
language sql security definer stable
set search_path = pg_catalog, concloud
as $$
  select l.id,l.name,l.cpf,l.email,l.phone,l.activity,l."zipCode",l."addressType",
         l.city,l.state,l.plan,l."paymentStatus",l."documentsSubmittedAt",
         l."documentsNotifiedAt",
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'kind',d.kind,'filename',d.filename,'mime',d.mime,'size',d.size,
               'uploadedAt',d."uploadedAt"
             ) order by d."uploadedAt"
           ) filter (where d.id is not null),
           '[]'::jsonb
         ) as documents
  from concloud."OpeningLead" l
  left join concloud."OpeningLeadDocument" d on d."openingLeadId"=l.id
  where l."authUserId"=p_auth_user_id and l.status='NEW'
  group by l.id
  order by l."createdAt" desc
  limit 1
$$;

create or replace function concloud.mark_opening_lead_documents_notified(
  p_lead_id uuid, p_auth_user_id uuid
) returns void
language sql security definer
set search_path = pg_catalog, concloud
as $$
  update concloud."OpeningLead"
  set "documentsNotifiedAt"=coalesce("documentsNotifiedAt",current_timestamp)
  where id=p_lead_id and "authUserId"=p_auth_user_id
    and "documentsSubmittedAt" is not null
$$;

revoke all on function concloud.get_opening_lead_profile(uuid) from public;
revoke all on function concloud.mark_opening_lead_documents_notified(uuid,uuid) from public;
grant execute on function concloud.get_opening_lead_profile(uuid) to concloud_runtime;
grant execute on function concloud.mark_opening_lead_documents_notified(uuid,uuid) to concloud_runtime;
