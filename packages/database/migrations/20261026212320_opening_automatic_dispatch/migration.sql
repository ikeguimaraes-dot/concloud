-- Payment and process creation commit together; no notification or assignment side effects.
alter table concloud."OpeningProcess" drop constraint "OpeningProcess_workflow_check";
alter table concloud."OpeningProcess" add constraint "OpeningProcess_workflow_check" check(workflow in ('MEI','JUCESP','TRIAGE'));
alter table concloud."OpeningProcess" add constraint opening_triage_stage check(workflow<>'TRIAGE' or stage=1);
alter table concloud."OpeningProcessEvent" alter column "actorId" drop not null;

create function concloud.opening_dispatch_paid() returns trigger
language plpgsql security invoker set search_path=pg_catalog,concloud as $$
declare process_id uuid;
begin
 if new."paymentStatus"='PAID' and new."organizationId"=concloud.opening_office() then
  insert into concloud."OpeningProcess"("leadId",workflow)
  values(new.id,case when new.plan='mei' then 'MEI' when upper(new.state)='SP' and new.plan in ('essencial','gestao','proximo') then 'JUCESP' else 'TRIAGE' end)
  on conflict("leadId") do nothing returning id into process_id;
  if process_id is not null then
   insert into concloud."OpeningProcessEvent"("processId","actorId","toStage",situation,reason,evidence)
   values(process_id,null,1,'TODO','Encaminhamento automático após pagamento confirmado',jsonb_build_object('source','payment','testPayment',coalesce(new."pagbankPaymentId"='TEST_BYPASS',false)));
  end if;
 end if;
 return new;
end;
$$;
revoke all on function concloud.opening_dispatch_paid() from public,anon,authenticated,concloud_runtime;
create trigger opening_dispatch_paid after insert or update of "paymentStatus" on concloud."OpeningLead" for each row execute function concloud.opening_dispatch_paid();

-- Backfill only absent processes; never reset stages or versions on retries.
with created as (
 insert into concloud."OpeningProcess"("leadId",workflow)
 select id,case when plan='mei' then 'MEI' when upper(state)='SP' and plan in ('essencial','gestao','proximo') then 'JUCESP' else 'TRIAGE' end
 from concloud."OpeningLead" where "paymentStatus"='PAID' and "organizationId"=concloud.opening_office()
 on conflict("leadId") do nothing returning id,"leadId"
)
insert into concloud."OpeningProcessEvent"("processId","actorId","toStage",situation,reason,evidence)
select p.id,null,1,'TODO','Encaminhamento automático de cadastro já pago',jsonb_build_object('source','payment_backfill','testPayment',coalesce(l."pagbankPaymentId"='TEST_BYPASS',false))
from created p join concloud."OpeningLead" l on l.id=p."leadId";
