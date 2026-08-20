import AuthService from '/js/services/auth.js';

/**
 * Client-side convenience redirect for role-gated pages — improves UX by not
 * flashing the wrong dashboard, but is NOT the real authorization boundary.
 * Every endpoint these pages call re-checks the role server-side via
 * require_roles() regardless of what this returns.
 */
export function requireRole(allowedRoles, redirectTo = '/dashboard.html') {
  const role = AuthService.getRole();
  if (!allowedRoles.includes(role)) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

export default requireRole;
