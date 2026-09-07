/**
 * The pool assignment button is a convenience affordance only. The API
 * remains the authorization boundary for assigning a lead.
 *
 * `sales_lead` is the CRM's documented supervisor role; `admin` is a seeded
 * management role and `super_admin` retains its normal bypass behavior.
 */
const POOL_ASSIGNMENT_ROLE_CODES = new Set([
  'super_admin',
  'admin',
  'sales_lead',
]);

export function canAssignPoolLead(roleCodes?: string[]): boolean {
  return roleCodes?.some((code) => POOL_ASSIGNMENT_ROLE_CODES.has(code)) ?? false;
}
