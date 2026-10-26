-- ConCloud only. Source of migrations remains packages/database/migrations.
-- Allow partial drafts; legacy final submissions receive the known sole titular.
alter table concloud."OpeningLead" drop constraint "OpeningLead_partners_check";
alter table concloud."OpeningLead" add constraint "OpeningLead_partners_check" check (
 jsonb_typeof(partners)='array' and (jsonb_array_length(partners) between 1 and 21 or (status='DRAFT' and partners='[]'::jsonb))
);
alter table concloud."OpeningLead" drop constraint "OpeningLead_mei_partners_check";
alter table concloud."OpeningLead" add constraint "OpeningLead_mei_partners_check" check (
 plan <> 'mei' or jsonb_array_length(partners)=1 or (status='DRAFT' and partners='[]'::jsonb)
);
create function concloud.opening_legacy_partner() returns trigger language plpgsql security invoker set search_path=pg_catalog,concloud as $$
begin
 if new.status <> 'DRAFT' and new.partners='[]'::jsonb then
  new.partners=jsonb_build_array(jsonb_build_object('name',new.name,'cpf',new.cpf,'percentage',100));
 end if;
 return new;
end $$;
create trigger opening_legacy_partner before insert or update on concloud."OpeningLead" for each row execute function concloud.opening_legacy_partner();

create table concloud."OpeningOffice" (
 singleton boolean primary key default true check(singleton),
 "organizationId" uuid not null unique references concloud."Organization"(id)
);
alter table concloud."OpeningOffice" enable row level security;
alter table concloud."OpeningOffice" force row level security;
revoke all on concloud."OpeningOffice" from public,anon,authenticated,concloud_runtime;
grant select on concloud."OpeningOffice" to concloud_runtime;
create policy opening_office_read on concloud."OpeningOffice" for select to concloud_runtime using(true);
do $$ declare office uuid; n integer; begin
 select count(*),min(id::text)::uuid into n,office from concloud."Organization" where lower(name)='concloud';
 if n>1 then raise exception 'Ambiguous ConCloud organization'; end if;
 if office is null then
  office=gen_random_uuid();
  insert into concloud."Organization"(id,name) values(office,'ConCloud');
 end if;
 insert into concloud."OpeningOffice"("organizationId") values(office);
end $$;
create function concloud.opening_office() returns uuid language sql stable security invoker set search_path=pg_catalog,concloud as $$ select "organizationId" from concloud."OpeningOffice" where singleton $$;
revoke all on function concloud.opening_office() from public;
grant execute on function concloud.opening_office() to concloud_runtime;
alter table concloud."OpeningLead" add column "organizationId" uuid default concloud.opening_office() references concloud."Organization"(id),
 add column "ownerId" uuid, add column version integer not null default 1;
update concloud."OpeningLead" set "organizationId"=concloud.opening_office() where "organizationId" is null;
alter table concloud."OpeningLead" alter column "organizationId" set not null;
alter table concloud."OpeningLead" add unique("organizationId",id);
create index "OpeningLead_internal_list" on concloud."OpeningLead"("organizationId","createdAt" desc,id desc);

create table concloud."OpeningStaff" (
 "organizationId" uuid not null,
 "userId" uuid not null,
 "displayName" text not null,
 active boolean not null default true,
 "readAll" boolean not null default false,
 documents boolean not null default false,
 "canAssign" boolean not null default false,
 primary key("organizationId","userId"),
 foreign key("organizationId","userId") references concloud."OrganizationMembership"("organizationId","userId") on delete restrict
);
alter table concloud."OpeningLead" add foreign key("organizationId","ownerId") references concloud."OpeningStaff"("organizationId","userId");
alter table concloud."OpeningStaff" enable row level security;
alter table concloud."OpeningStaff" force row level security;
revoke all on concloud."OpeningStaff" from public,anon,authenticated,concloud_runtime;
grant select on concloud."OpeningStaff" to concloud_runtime;
create policy opening_staff_read on concloud."OpeningStaff" for select to concloud_runtime using("userId"=concloud.actor() or concloud.org_admin("organizationId"));

create function concloud.opening_access(org uuid,owner_id uuid,capability text default 'read') returns boolean
language sql stable security invoker set search_path=pg_catalog,concloud as $$
 select coalesce(current_setting('app.aal',true),'')='aal2' and org=concloud.opening_office() and exists (
 select 1 from concloud."OpeningStaff" s join concloud."OrganizationMembership" m
 on m."organizationId"=s."organizationId" and m."userId"=s."userId"
 where s."organizationId"=org and s."userId"=concloud.actor() and s.active and m.active
 and m.role in ('ORG_ADMIN','SUPER_ADMIN','ACCOUNTANT','ASSISTANT')
 and (s."readAll" or owner_id=concloud.actor() or m.role in ('ORG_ADMIN','SUPER_ADMIN'))
 and case capability when 'read' then true when 'documents' then s.documents or m.role in ('ORG_ADMIN','SUPER_ADMIN')
 when 'assign' then s."canAssign" or m.role in ('ORG_ADMIN','SUPER_ADMIN') else false end
 )
$$;
revoke all on function concloud.opening_access(uuid,uuid,text) from public;
grant execute on function concloud.opening_access(uuid,uuid,text) to concloud_runtime;
create policy opening_internal_read on concloud."OpeningLead" for select to concloud_runtime using(concloud.opening_access("organizationId","ownerId"));
-- Existing SQL functions use owner privileges. Direct runtime mutations are assignment only.
revoke update on concloud."OpeningLead" from concloud_runtime;
grant update("ownerId",version) on concloud."OpeningLead" to concloud_runtime;
create policy opening_internal_assign on concloud."OpeningLead" for update to concloud_runtime using(concloud.opening_access("organizationId","ownerId",'assign')) with check(concloud.opening_access("organizationId","ownerId",'assign'));
grant select on concloud."OpeningLeadDocument" to concloud_runtime;
create policy opening_internal_documents on concloud."OpeningLeadDocument" for select to concloud_runtime using(exists (
 select 1 from concloud."OpeningLead" l where l.id="openingLeadId" and concloud.opening_access(l."organizationId",l."ownerId",'documents')
));
create table concloud."OpeningAuditEvent" (
 id uuid primary key default gen_random_uuid(), "organizationId" uuid not null,
 "leadId" uuid not null, "actorId" uuid not null, action text not null,
 metadata jsonb not null default '{}'::jsonb, "createdAt" timestamptz not null default now(),
 foreign key("organizationId","leadId") references concloud."OpeningLead"("organizationId",id) on delete restrict
);
alter table concloud."OpeningAuditEvent" enable row level security;
alter table concloud."OpeningAuditEvent" force row level security;
revoke all on concloud."OpeningAuditEvent" from public,anon,authenticated,concloud_runtime;
grant select,insert on concloud."OpeningAuditEvent" to concloud_runtime;
create policy opening_audit_read on concloud."OpeningAuditEvent" for select to concloud_runtime using(exists(select 1 from concloud."OpeningLead" l where l.id="leadId"));
create policy opening_audit_insert on concloud."OpeningAuditEvent" for insert to concloud_runtime with check("actorId"=concloud.actor() and exists(select 1 from concloud."OpeningLead" l where l.id="leadId" and l."organizationId"="OpeningAuditEvent"."organizationId"));
-- Revoking the organization membership also removes eligibility for new assignments.
create function concloud.opening_revoke_staff() returns trigger language plpgsql security invoker set search_path=pg_catalog,concloud as $$
begin
 if not new.active or new.role not in ('ORG_ADMIN','SUPER_ADMIN','ACCOUNTANT','ASSISTANT') then
  update concloud."OpeningStaff" set active=false where "organizationId"=new."organizationId" and "userId"=new."userId";
 end if;
 return new;
end $$;
create trigger opening_revoke_staff after update of active,role on concloud."OrganizationMembership" for each row execute function concloud.opening_revoke_staff();
