CREATE TABLE pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id uuid,
  title text NOT NULL DEFAULT 'Untitled',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, org_id),
  -- parent must belong to the same workspace
  FOREIGN KEY (parent_id, org_id) REFERENCES pages (id, org_id) ON DELETE CASCADE
);

CREATE INDEX pages_org_parent_idx ON pages (org_id, parent_id);

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pages
  USING (org_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON pages TO app_user;
-- future tables get the same access automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;