-- Run only for the confirmed ConCloud administrator. Does not create Auth users.
do $$ declare user_id uuid; office uuid; begin
 select id into user_id from auth.users where lower(email)='grupomeeteat@gmail.com' and email_confirmed_at is not null;
 if user_id is null then raise exception 'Confirmed administrator identity not found'; end if;
 office=concloud.opening_office();
 if office is null then raise exception 'ConCloud office is not configured'; end if;
 insert into concloud."Profile"(id,email,name) values(user_id,'grupomeeteat@gmail.com','Administrador ConCloud') on conflict(id) do nothing;
 insert into concloud."OrganizationMembership"(id,"organizationId","userId",role,active)
 values(gen_random_uuid(),office,user_id,'ORG_ADMIN',true)
 on conflict("organizationId","userId") do update set role='ORG_ADMIN',active=true;
 insert into concloud."OpeningStaff"("organizationId","userId","displayName",active,"readAll",documents,"canAssign")
 values(office,user_id,'Administrador ConCloud',true,true,true,true)
 on conflict("organizationId","userId") do update set active=true,"readAll"=true,documents=true,"canAssign"=true;
end $$;
