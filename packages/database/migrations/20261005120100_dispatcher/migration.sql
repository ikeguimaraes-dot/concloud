DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='concloud_dispatcher') THEN CREATE ROLE concloud_dispatcher NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA concloud TO concloud_dispatcher;
GRANT SELECT ON concloud."OutboxEvent" TO concloud_dispatcher;
GRANT UPDATE("enqueuedAt",attempts,"lastError") ON concloud."OutboxEvent" TO concloud_dispatcher;
CREATE POLICY dispatcher_read ON concloud."OutboxEvent" FOR SELECT TO concloud_dispatcher USING(true);
CREATE POLICY dispatcher_update ON concloud."OutboxEvent" FOR UPDATE TO concloud_dispatcher USING(true) WITH CHECK(true);
