import { Roles, type RoleName } from '../types/auth'

export function getRoleLabel(roleName?: RoleName | string) {
  if (roleName === Roles.SuperAdmin) {
    return 'Owner'
  }

  if (roleName === Roles.Admin) {
    return 'Cashier'
  }

  return roleName ?? ''
}
