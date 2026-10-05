-- Client financial/document writes must flag an exported period as stale. A client
-- may only advance revision; changing state, assignees, dates or scope is denied.
DROP POLICY update_rows ON concloud."AccountingPeriod";
CREATE POLICY update_rows ON concloud."AccountingPeriod" FOR UPDATE TO concloud_runtime USING(concloud.company_access("organizationId","companyId")) WITH CHECK(concloud.company_access("organizationId","companyId"));
CREATE FUNCTION concloud.guard_period_update() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT concloud.staff_access(OLD."organizationId",OLD."companyId") THEN
   IF (to_jsonb(OLD)-'revision') IS DISTINCT FROM (to_jsonb(NEW)-'revision') OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Client can only advance source revision'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION concloud.guard_period_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION concloud.guard_period_update() TO concloud_runtime;
CREATE TRIGGER period_client_revision BEFORE UPDATE ON concloud."AccountingPeriod" FOR EACH ROW EXECUTE FUNCTION concloud.guard_period_update();
