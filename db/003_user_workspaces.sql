CREATE FUNCTION user_workspaces(p_user uuid)
RETURNS TABLE (id uuid, name text, role text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, m.role
  FROM memberships m
  JOIN organizations o ON o.id = m.org_id
  WHERE m.user_id = p_user
  ORDER BY o.created_at
$$;

REVOKE ALL ON FUNCTION user_workspaces(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION user_workspaces(uuid) TO app_user;