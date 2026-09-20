ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
UPDATE memberships SET role = 'editor' WHERE role IN ('admin', 'member');
ALTER TABLE memberships
  ADD CONSTRAINT memberships_role_check CHECK (role IN ('owner', 'editor', 'viewer'));
ALTER TABLE memberships ALTER COLUMN role SET DEFAULT 'editor';