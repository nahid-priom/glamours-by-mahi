-- Authorized administrators may inspect archived branches for restore and history.
-- Ordinary branch users continue to see only non-deleted branches they can access.

DROP POLICY IF EXISTS branches_select ON public.branches;
CREATE POLICY branches_select ON public.branches
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('settings.manage')
      OR (deleted_at IS NULL AND public.user_has_branch_access(id))
    )
  );
