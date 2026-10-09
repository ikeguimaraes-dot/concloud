alter table concloud."OpeningLead"
  add column cpf text,
  add column "authUserId" uuid;

create unique index "OpeningLead_cpf_key" on concloud."OpeningLead" (cpf) where cpf is not null;

drop function if exists concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text);

create or replace function concloud.submit_opening_lead(
  p_name text, p_cpf text, p_email text, p_phone text, p_activity text,
  p_zip_code text, p_address_type text, p_city text, p_state text,
  p_plan text, p_auth_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, concloud
as $$
declare v_id uuid;
begin
  if length(trim(p_name)) < 3
    or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    or p_cpf !~ '^[0-9]{11}$' then
    raise exception 'invalid opening registration';
  end if;
  insert into concloud."OpeningLead"
    (name,cpf,email,phone,activity,"zipCode","addressType",city,state,plan,"authUserId")
  values
    (trim(p_name),p_cpf,lower(trim(p_email)),trim(p_phone),trim(p_activity),trim(p_zip_code),
     p_address_type,trim(p_city),trim(p_state),p_plan,p_auth_user_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text,text,uuid) from public;
grant execute on function concloud.submit_opening_lead(text,text,text,text,text,text,text,text,text,text,uuid) to concloud_runtime;
