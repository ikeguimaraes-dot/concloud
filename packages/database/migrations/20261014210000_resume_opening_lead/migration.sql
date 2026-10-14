create or replace function concloud.submit_opening_lead(
  p_name text, p_cpf text, p_email text, p_phone text, p_activity text,
  p_zip_code text, p_address_type text, p_city text, p_state text,
  p_plan text, p_auth_user_id uuid, p_token_hash text
) returns uuid
language plpgsql security definer
set search_path = pg_catalog, concloud
as $$
declare v_id uuid;
begin
  if length(trim(p_name)) < 3
    or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    or p_cpf !~ '^[0-9]{11}$' or length(p_token_hash) <> 64 then
    raise exception 'invalid opening registration';
  end if;

  select id into v_id
  from concloud."OpeningLead"
  where cpf=p_cpf and lower(email)=lower(trim(p_email))
    and ("authUserId" is null or "authUserId"=p_auth_user_id)
  limit 1;

  if v_id is null then
    select id into v_id
    from concloud."OpeningLead"
    where "draftTokenHash"=p_token_hash and status='DRAFT'
    limit 1;
  end if;

  if v_id is null then
    insert into concloud."OpeningLead"
      (name,cpf,email,phone,activity,"zipCode","addressType",city,state,plan,"authUserId",
       status,"draftTokenHash","funnelStep","lastActivityAt")
    values
      (trim(p_name),p_cpf,lower(trim(p_email)),trim(p_phone),trim(p_activity),trim(p_zip_code),
       p_address_type,trim(p_city),trim(p_state),p_plan,p_auth_user_id,'NEW',p_token_hash,4,current_timestamp)
    returning id into v_id;
  else
    update concloud."OpeningLead" set
      name=trim(p_name),cpf=p_cpf,email=lower(trim(p_email)),phone=trim(p_phone),
      activity=trim(p_activity),"zipCode"=trim(p_zip_code),"addressType"=p_address_type,
      city=trim(p_city),state=trim(p_state),plan=p_plan,"authUserId"=p_auth_user_id,
      status='NEW',"funnelStep"=4,"lastActivityAt"=current_timestamp
    where id=v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text,text,uuid,text) from public;
grant execute on function concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text,text,uuid,text) to concloud_runtime;
