create table concloud."OpeningProcess" (
 id uuid primary key default gen_random_uuid(), "leadId" uuid not null unique references concloud."OpeningLead"(id),
 workflow text not null check(workflow in ('MEI','JUCESP')), stage integer not null default 1,
 situation text not null default 'TODO' check(situation in ('TODO','IN_PROGRESS','WAITING_CLIENT','WAITING_AGENCY','REQUIREMENT','DONE','CANCELED')),
 version integer not null default 1, "createdAt" timestamptz not null default now(),
 check(stage>=1 and stage<=case when workflow='MEI' then 7 else 16 end)
);
create table concloud."OpeningProcessEvent" (
 id uuid primary key default gen_random_uuid(), "processId" uuid not null references concloud."OpeningProcess"(id),
 "actorId" uuid not null, "fromStage" integer, "toStage" integer not null,
 situation text not null, reason text not null, evidence jsonb not null default '{}',
 "createdAt" timestamptz not null default now()
);
create index on concloud."OpeningProcessEvent"("processId","createdAt" desc);
create table concloud."OpeningProcessTask" (
 id uuid primary key default gen_random_uuid(), "processId" uuid not null references concloud."OpeningProcess"(id),
 title text not null check(length(title) between 3 and 200), "ownerId" uuid not null,
 "dueAt" timestamptz, completed boolean not null default false, version integer not null default 1,
 "createdAt" timestamptz not null default now()
);
create index on concloud."OpeningProcessTask"("processId");
create table concloud."OpeningProcessEvidence" (
 id uuid primary key default gen_random_uuid(), "processId" uuid not null references concloud."OpeningProcess"(id),
 "actorId" uuid not null, kind text not null check(kind in ('DARE','SIGNED_CONTRACT','CNPJ','CCMEI','DELIVERY','OTHER')),
 filename text not null,mime text not null,size integer not null,bucket text not null,"objectKey" text not null,
 "createdAt" timestamptz not null default now()
);
create index on concloud."OpeningProcessEvidence"("processId");
alter table concloud."OpeningProcess" enable row level security;
alter table concloud."OpeningProcess" force row level security;
revoke all on concloud."OpeningProcess" from public,anon,authenticated,concloud_runtime;
grant select,insert on concloud."OpeningProcess" to concloud_runtime;
grant update(stage,situation,version) on concloud."OpeningProcess" to concloud_runtime;
create policy opening_process_read on concloud."OpeningProcess" for select to concloud_runtime using(exists(select 1 from concloud."OpeningLead" l where l.id="leadId" and concloud.opening_access(l."organizationId",l."ownerId",'read')));
create policy opening_process_insert on concloud."OpeningProcess" for insert to concloud_runtime with check(exists(select 1 from concloud."OpeningLead" l where l.id="leadId" and l."paymentStatus"='PAID' and l."ownerId" is not null and concloud.opening_access(l."organizationId",l."ownerId",'assign')));
create policy opening_process_update on concloud."OpeningProcess" for update to concloud_runtime using(exists(select 1 from concloud."OpeningLead" l where l.id="leadId" and concloud.opening_access(l."organizationId",l."ownerId",'documents'))) with check(exists(select 1 from concloud."OpeningLead" l where l.id="leadId" and concloud.opening_access(l."organizationId",l."ownerId",'documents')));
alter table concloud."OpeningProcessEvent" enable row level security;
alter table concloud."OpeningProcessEvent" force row level security;
revoke all on concloud."OpeningProcessEvent" from public,anon,authenticated,concloud_runtime;
grant select,insert on concloud."OpeningProcessEvent" to concloud_runtime;
create policy operation_read on concloud."OpeningProcessEvent" for select to concloud_runtime using(exists(select 1 from concloud."OpeningProcess" p join concloud."OpeningLead" l on l.id=p."leadId" where p.id="processId" and concloud.opening_access(l."organizationId",l."ownerId",'documents')));
create policy operation_insert on concloud."OpeningProcessEvent" for insert to concloud_runtime with check(exists(select 1 from concloud."OpeningProcess" p join concloud."OpeningLead" l on l.id=p."leadId" where p.id="processId" and concloud.opening_access(l."organizationId",l."ownerId",'documents')) and "actorId"=concloud.actor());
alter table concloud."OpeningProcessTask" enable row level security;
alter table concloud."OpeningProcessTask" force row level security;
revoke all on concloud."OpeningProcessTask" from public,anon,authenticated,concloud_runtime;
grant select,insert on concloud."OpeningProcessTask" to concloud_runtime;
create policy operation_read on concloud."OpeningProcessTask" for select to concloud_runtime using(exists(select 1 from concloud."OpeningProcess" p join concloud."OpeningLead" l on l.id=p."leadId" where p.id="processId" and concloud.opening_access(l."organizationId",l."ownerId",'documents')));
create policy operation_insert on concloud."OpeningProcessTask" for insert to concloud_runtime with check(exists(select 1 from concloud."OpeningProcess" p join concloud."OpeningLead" l on l.id=p."leadId" where p.id="processId" and concloud.opening_access(l."organizationId",l."ownerId",'documents')));
alter table concloud."OpeningProcessEvidence" enable row level security;
alter table concloud."OpeningProcessEvidence" force row level security;
revoke all on concloud."OpeningProcessEvidence" from public,anon,authenticated,concloud_runtime;
grant select,insert on concloud."OpeningProcessEvidence" to concloud_runtime;
create policy operation_read on concloud."OpeningProcessEvidence" for select to concloud_runtime using(exists(select 1 from concloud."OpeningProcess" p join concloud."OpeningLead" l on l.id=p."leadId" where p.id="processId" and concloud.opening_access(l."organizationId",l."ownerId",'documents')));
create policy operation_insert on concloud."OpeningProcessEvidence" for insert to concloud_runtime with check(exists(select 1 from concloud."OpeningProcess" p join concloud."OpeningLead" l on l.id=p."leadId" where p.id="processId" and concloud.opening_access(l."organizationId",l."ownerId",'documents')) and "actorId"=concloud.actor());
grant update(completed,version) on concloud."OpeningProcessTask" to concloud_runtime;
create policy operation_task_update on concloud."OpeningProcessTask" for update to concloud_runtime using(exists(select 1 from concloud."OpeningProcess" p join concloud."OpeningLead" l on l.id=p."leadId" where p.id="processId" and concloud.opening_access(l."organizationId",l."ownerId",'documents'))) with check(exists(select 1 from concloud."OpeningProcess" p join concloud."OpeningLead" l on l.id=p."leadId" where p.id="processId" and concloud.opening_access(l."organizationId",l."ownerId",'documents')));
