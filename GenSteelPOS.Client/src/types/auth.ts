export const Roles = {
  Admin: 'Admin',
  SuperAdmin: 'SuperAdmin',
} as const

export type RoleName = (typeof Roles)[keyof typeof Roles]

export interface User {
  id: number
  fullName: string
  username: string
  email: string
  isActive: boolean
  roleName: RoleName
}

export interface AuthResponse {
  token: string
  expiresAtUtc: string
  user: User
}
