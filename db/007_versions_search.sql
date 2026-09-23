-- Plain-text copy of the content, kept in sync on every save, used for search
ALTER TABLE pages ADD COLUMN content_text text NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN search tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content_text, '')), 'B')
) STORED;
CREATE INDEX pages_search_idx ON pages USING GIN (search);

CREATE TABLE page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id uuid NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL,
  content_text text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (page_id, org_id) REFERENCES pages (id, org_id) ON DELETE CASCADE
);
CREATE INDEX page_versions_page_idx ON page_versions (page_id, created_at DESC);

ALTER TABLE page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON page_versions
  USING (org_id = NULLIF(current_setting('app.current_org', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org', true), '')::uuid);