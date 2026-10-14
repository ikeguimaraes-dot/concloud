create or replace function concloud.get_opening_lead_email_by_cpf(p_cpf text)
returns text
language sql security definer stable
set search_path = pg_catalog, concloud
as $$
  select lower(email)
  from concloud."OpeningLead"
  where cpf=p_cpf and "authUserId" is not null
  order by "createdAt" desc
  limit 1
$$;

create or replace function concloud.get_opening_lead_resume(p_auth_user_id uuid)
returns table (id uuid, plan text, "paymentStatus" text)
language sql security definer stable
set search_path = pg_catalog, concloud
as $$
  select l.id,l.plan,l."paymentStatus"
  from concloud."OpeningLead" l
  where l."authUserId"=p_auth_user_id and l.status='NEW'
  order by l."createdAt" desc
  limit 1
$$;

revoke all on function concloud.get_opening_lead_email_by_cpf(text) from public;
revoke all on function concloud.get_opening_lead_resume(uuid) from public;
grant execute on function concloud.get_opening_lead_email_by_cpf(text) to concloud_runtime;
grant execute on function concloud.get_opening_lead_resume(uuid) to concloud_runtime;
