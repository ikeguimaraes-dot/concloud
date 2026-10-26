-- Versioned evidence: uploads never inherit an earlier approval.
create table concloud."OpeningDocumentVersion" (
 id uuid primary key default gen_random_uuid(),
 "documentId" uuid not null references concloud."OpeningLeadDocument"(id),
 "leadId" uuid not null references concloud."OpeningLead"(id),
 kind text not null, filename text not null, mime text not null, size integer not null,
 bucket text not null, "objectKey" text not null,
 "uploadedAt" timestamptz not null, "uploaderId" uuid,
 "partnersSnapshot" jsonb not null,
 unique("documentId","objectKey")
);
create table concloud."OpeningDocumentReview" (
 id uuid primary key default gen_random_uuid(),
 "versionId" uuid not null references concloud."OpeningDocumentVersion"(id),
 "reviewerId" uuid not null,
 decision text not null check(decision in ('APPROVED','REJECTED')),
 reason text not null default '',
 "createdAt" timestamptz not null default now(),
 check(decision <> 'REJECTED' or length(trim(reason))>=5)
);
create index on concloud."OpeningDocumentVersion"("leadId",kind,"uploadedAt" desc);
create index on concloud."OpeningDocumentReview"("versionId","createdAt" desc);
insert into concloud."OpeningDocumentVersion"("documentId","leadId",kind,filename,mime,size,bucket,"objectKey","uploadedAt","uploaderId","partnersSnapshot")
select d.id,d."openingLeadId",d.kind,d.filename,d.mime,d.size,d.bucket,d."objectKey",d."uploadedAt",l."authUserId",l.partners from concloud."OpeningLeadDocument" d join concloud."OpeningLead" l on l.id=d."openingLeadId";
create function concloud.opening_capture_document_version() returns trigger language plpgsql security invoker set search_path=pg_catalog,concloud as $$
begin
 insert into concloud."OpeningDocumentVersion"("documentId","leadId",kind,filename,mime,size,bucket,"objectKey","uploadedAt","uploaderId","partnersSnapshot")
 select new.id,new."openingLeadId",new.kind,new.filename,new.mime,new.size,new.bucket,new."objectKey",new."uploadedAt",l."authUserId",l.partners from concloud."OpeningLead" l where l.id=new."openingLeadId"
 on conflict("documentId","objectKey") do nothing;
 return new;
end $$;
create trigger opening_capture_document_version after insert or update of "objectKey" on concloud."OpeningLeadDocument" for each row execute function concloud.opening_capture_document_version();
alter table concloud."OpeningDocumentVersion" enable row level security;
alter table concloud."OpeningDocumentVersion" force row level security;
alter table concloud."OpeningDocumentReview" enable row level security;
alter table concloud."OpeningDocumentReview" force row level security;
revoke all on concloud."OpeningDocumentVersion",concloud."OpeningDocumentReview" from public,anon,authenticated,concloud_runtime;
grant select on concloud."OpeningDocumentVersion",concloud."OpeningDocumentReview" to concloud_runtime;
grant insert on concloud."OpeningDocumentReview" to concloud_runtime;
create policy opening_version_read on concloud."OpeningDocumentVersion" for select to concloud_runtime using(exists(select 1 from concloud."OpeningLead" l where l.id="leadId" and concloud.opening_access(l."organizationId",l."ownerId",'documents')));
create policy opening_review_read on concloud."OpeningDocumentReview" for select to concloud_runtime using(exists(select 1 from concloud."OpeningDocumentVersion" v where v.id="versionId"));
create policy opening_review_insert on concloud."OpeningDocumentReview" for insert to concloud_runtime with check("reviewerId"=concloud.actor() and exists(select 1 from concloud."OpeningDocumentVersion" v where v.id="versionId"));
-- Same server-only ownership contract as the existing upload/status functions.
-- Never granted to anon/authenticated; caller obtains actor from validated Auth.
create function concloud.get_opening_document_reviews(p_lead_id uuid,p_auth_user_id uuid)
returns table(kind text,decision text,reason text) language sql stable security definer set search_path=pg_catalog,concloud as $$
 select d.kind,case when v."partnersSnapshot"<>l.partners then 'REJECTED' else coalesce(r.decision,'RECEIVED') end,case when v."partnersSnapshot"<>l.partners then 'Os dados dos sócios foram alterados. Envie uma versão atualizada para nova conferência.' else coalesce(r.reason,'') end
 from concloud."OpeningLead" l join concloud."OpeningLeadDocument" d on d."openingLeadId"=l.id
 join concloud."OpeningDocumentVersion" v on v."documentId"=d.id and v."objectKey"=d."objectKey"
 left join lateral(select r.decision,r.reason from concloud."OpeningDocumentReview" r where r."versionId"=v.id order by r."createdAt" desc,r.id desc limit 1) r on true
 where l.id=p_lead_id and l."authUserId"=p_auth_user_id and l."paymentStatus"='PAID'
$$;
revoke all on function concloud.get_opening_document_reviews(uuid,uuid) from public,anon,authenticated;
grant execute on function concloud.get_opening_document_reviews(uuid,uuid) to concloud_runtime;
