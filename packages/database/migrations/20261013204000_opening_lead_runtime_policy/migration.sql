create or replace function concloud.get_opening_lead_for_checkout(p_id uuid)
returns table (
  id uuid, name text, cpf text, email text, phone text, plan text,
  "pagbankCheckoutId" text, "pagbankCheckoutUrl" text, "paymentStatus" text
)
language sql
security definer
stable
set search_path = pg_catalog, concloud
as $$
  select l.id,l.name,l.cpf,l.email,l.phone,l.plan,l."pagbankCheckoutId",
         l."pagbankCheckoutUrl",l."paymentStatus"
  from concloud."OpeningLead" l
  where l.id=p_id
  limit 1
$$;

create or replace function concloud.set_opening_lead_checkout(
  p_id uuid, p_checkout_id text, p_checkout_url text, p_plan_id text, p_amount integer
) returns void
language sql
security definer
set search_path = pg_catalog, concloud
as $$
  update concloud."OpeningLead"
  set "pagbankCheckoutId"=p_checkout_id, "pagbankCheckoutUrl"=p_checkout_url,
      "pagbankPlanId"=p_plan_id, "paymentAmount"=p_amount,
      "paymentStatus"='PENDING', "paymentUpdatedAt"=current_timestamp
  where id=p_id
$$;

create or replace function concloud.get_opening_lead_payment_status(p_id uuid)
returns text
language sql
security definer
stable
set search_path = pg_catalog, concloud
as $$
  select "paymentStatus" from concloud."OpeningLead" where id=p_id
$$;

create or replace function concloud.update_opening_lead_payment(
  p_lead_id uuid, p_checkout_id text, p_status text, p_payment_id text,
  p_subscription_id text, p_paid_at timestamptz
) returns void
language plpgsql
security definer
set search_path = pg_catalog, concloud
as $$
begin
  if p_status not in ('WAITING','IN_ANALYSIS','PAID','DECLINED','CANCELED','EXPIRED') then
    raise exception 'invalid payment status';
  end if;
  update concloud."OpeningLead"
  set "paymentStatus"=case when "paymentStatus"='PAID' then 'PAID' else p_status end,
      "pagbankPaymentId"=coalesce(p_payment_id,"pagbankPaymentId"),
      "pagbankSubscriptionId"=coalesce(p_subscription_id,"pagbankSubscriptionId"),
      "paidAt"=case when p_status='PAID' then coalesce(p_paid_at,current_timestamp) else "paidAt" end,
      "paymentUpdatedAt"=current_timestamp
  where (p_lead_id is not null and id=p_lead_id)
     or (p_checkout_id is not null and "pagbankCheckoutId"=p_checkout_id);
end;
$$;

revoke all on function concloud.get_opening_lead_for_checkout(uuid) from public;
revoke all on function concloud.set_opening_lead_checkout(uuid,text,text,text,integer) from public;
revoke all on function concloud.get_opening_lead_payment_status(uuid) from public;
revoke all on function concloud.update_opening_lead_payment(uuid,text,text,text,text,timestamptz) from public;
grant execute on function concloud.get_opening_lead_for_checkout(uuid) to concloud_runtime;
grant execute on function concloud.set_opening_lead_checkout(uuid,text,text,text,integer) to concloud_runtime;
grant execute on function concloud.get_opening_lead_payment_status(uuid) to concloud_runtime;
grant execute on function concloud.update_opening_lead_payment(uuid,text,text,text,text,timestamptz) to concloud_runtime;
