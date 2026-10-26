-- Login com senha autorizado pelo responsável em 26/10/2026.
-- Preserva vínculo ativo, escritório, concessões e RLS.
create or replace function concloud.opening_access(org uuid,owner_id uuid,capability text default 'read') returns boolean
language sql stable security invoker set search_path=pg_catalog,concloud as $$
 select coalesce(current_setting('app.aal',true),'') in ('aal1','aal2') and org=concloud.opening_office() and exists (
 select 1 from concloud."OpeningStaff" s join concloud."OrganizationMembership" m
 on m."organizationId"=s."organizationId" and m."userId"=s."userId"
 where s."organizationId"=org and s."userId"=concloud.actor() and s.active and m.active
 and m.role in ('ORG_ADMIN','SUPER_ADMIN','ACCOUNTANT','ASSISTANT')
 and (s."readAll" or owner_id=concloud.actor() or m.role in ('ORG_ADMIN','SUPER_ADMIN'))
 and case capability when 'read' then true when 'documents' then s.documents or m.role in ('ORG_ADMIN','SUPER_ADMIN')
 when 'assign' then s."canAssign" or m.role in ('ORG_ADMIN','SUPER_ADMIN') else false end
 )
$$;
