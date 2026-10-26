alter table concloud."OpeningLead" drop constraint "OpeningLead_plan_check";
alter table concloud."OpeningLead" add constraint "OpeningLead_plan_check"
  check (plan in ('mei', 'essencial', 'gestao', 'proximo'));
alter table concloud."OpeningLead" add constraint "OpeningLead_mei_partners_check"
  check (plan <> 'mei' or jsonb_array_length(partners) = 1);

create function concloud.get_opening_lead_document_context_v2(
  p_lead_id uuid, p_auth_user_id uuid
) returns table (kind text, "submittedAt" timestamptz, partners jsonb, plan text)
language sql security definer stable
set search_path = pg_catalog, concloud
as $$
  select d.kind, l."documentsSubmittedAt", l.partners, l.plan
  from concloud."OpeningLead" l
  left join concloud."OpeningLeadDocument" d on d."openingLeadId"=l.id
  where l.id=p_lead_id and l."authUserId"=p_auth_user_id and l."paymentStatus"='PAID'
$$;
revoke all on function concloud.get_opening_lead_document_context_v2(uuid,uuid) from public;
grant execute on function concloud.get_opening_lead_document_context_v2(uuid,uuid) to concloud_runtime;

create or replace function concloud.complete_opening_lead_documents(
  p_lead_id uuid, p_auth_user_id uuid
) returns timestamptz
language plpgsql security definer
set search_path = pg_catalog, concloud
as $$
declare submitted_at timestamptz;
declare v_plan text;
declare v_partner_count integer;
begin
  select plan, jsonb_array_length(partners) into v_plan, v_partner_count
  from concloud."OpeningLead"
  where id=p_lead_id and "authUserId"=p_auth_user_id and "paymentStatus"='PAID';
  if not found then raise exception 'opening lead not authorized'; end if;
  if exists (
    select 1 from (
      select 'socio-' || n || '-' || k as kind
      from generate_series(1, v_partner_count) n
      cross join unnest(array['identidade','titulo','estado-civil','endereco-socio']) k
      union all select 'endereco-empresa'
      union all select 'iptu' where v_plan <> 'mei'
    ) required
    where not exists (
      select 1 from concloud."OpeningLeadDocument" d
      where d."openingLeadId"=p_lead_id and d.kind=required.kind
    )
  ) then raise exception 'opening documents incomplete'; end if;
  update concloud."OpeningLead"
  set "documentsSubmittedAt"=coalesce("documentsSubmittedAt",current_timestamp)
  where id=p_lead_id returning "documentsSubmittedAt" into submitted_at;
  return submitted_at;
end;
$$;
