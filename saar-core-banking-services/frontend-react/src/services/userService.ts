import { apiService } from './apiService';

const USERS_BASE = '/api/users';
const ROLES_BASE = '/api/roles';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoleRecord {
  id: number;
  name: string;
  userRoles?: { userId: number }[];
}

export interface UserRecord {
  id: number;
  username: string;
  email: string;
  isActive: boolean;
  passwordHash?: string;
  userRoles: {
    userId: number;
    roleId: number;
    role: RoleRecord;
  }[];
}

export interface CreateUserDto {
  username: string;
  email: string;
  passwordHash: string; // plain password — backend stores bcrypt hash
  isActive: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const userService = {
  listUsers:  () => apiService.get<UserRecord[]>(USERS_BASE),
  getUser:    (id: number) => apiService.get<UserRecord>(`${USERS_BASE}/${id}`),
  createUser: (data: CreateUserDto) => apiService.post<UserRecord>(USERS_BASE, data),
  updateUser: (id: number, data: UserRecord) => apiService.put<void>(`${USERS_BASE}/${id}`, data),
  deleteUser: (id: number) => apiService.delete<void>(`${USERS_BASE}/${id}`),

  listRoles:  () => apiService.get<RoleRecord[]>(ROLES_BASE),
  createRole: (name: string) => apiService.post<RoleRecord>(ROLES_BASE, { name }),
};
