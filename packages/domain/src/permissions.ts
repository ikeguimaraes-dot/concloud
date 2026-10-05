import { AppError } from './errors';
export const roles = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'ACCOUNTANT',
  'ASSISTANT',
  'CLIENT_OWNER',
  'CLIENT_MEMBER',
] as const;
export type Role = (typeof roles)[number];
export const internal = (r: Role) =>
  ['SUPER_ADMIN', 'ORG_ADMIN', 'ACCOUNTANT', 'ASSISTANT'].includes(r);
export type Permission = 'read' | 'finance' | 'upload' | 'staff' | 'review' | 'admin' | 'team';
const grants: Record<Permission, readonly Role[]> = {
  read: roles,
  finance: roles,
  upload: roles,
  staff: ['SUPER_ADMIN', 'ORG_ADMIN', 'ACCOUNTANT', 'ASSISTANT'],
  review: ['SUPER_ADMIN', 'ORG_ADMIN', 'ACCOUNTANT'],
  admin: ['SUPER_ADMIN', 'ORG_ADMIN'],
  team: ['SUPER_ADMIN', 'ORG_ADMIN', 'CLIENT_OWNER'],
};
export function authorize(role: Role, action: Permission) {
  if (!grants[action].includes(role))
    throw new AppError('FORBIDDEN', 'Você não tem permissão para esta ação.', 403);
}
export function assertScope(
  actual: { organizationId: string; companyId: string },
  expected: { organizationId: string; companyId: string },
) {
  if (actual.organizationId !== expected.organizationId || actual.companyId !== expected.companyId)
    throw new AppError('NOT_FOUND', 'Registro não encontrado.', 404);
}
