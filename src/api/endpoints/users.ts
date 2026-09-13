import apiClient from '@/api/client';
import type { PaginatedResponse, PaginationParams, UserProfileFormData } from '@/types';
import type { User, InsertTables, UpdateTables } from '@/types/database.types';

export async function getUsers(params?: PaginationParams): Promise<PaginatedResponse<User>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const from = (page - 1) * pageSize;

  const { data } = await apiClient.get<User[]>('/users', {
    params: {
      select: '*',
      offset: from,
      limit: pageSize,
      order: `${params?.sortBy ?? 'created_at'}.${params?.sortOrder ?? 'desc'}`,
    },
  });

  return {
    data: data ?? [],
    total: data?.length ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((data?.length ?? 0) / pageSize),
  };
}

export async function getUserById(id: string): Promise<User> {
  const { data } = await apiClient.get<User[]>(`/users`, { params: { id: `eq.${id}` } });
  if (!data?.[0]) throw new Error('Utilisateur non trouvé');
  return data[0];
}

export async function createUser(user: InsertTables<'users'>): Promise<User> {
  const { data } = await apiClient.post<User[]>('/users', user);
  if (!data?.[0]) throw new Error('Erreur lors de la création');
  return data[0];
}

export async function updateUser(id: string, updates: UpdateTables<'users'>): Promise<User> {
  const { data } = await apiClient.patch<User[]>(`/users?id=eq.${id}`, updates);
  if (!data?.[0]) throw new Error('Erreur lors de la mise à jour');
  return data[0];
}

export async function updateUserProfile(id: string, profile: UserProfileFormData): Promise<User> {
  return updateUser(id, {
    full_name: profile.fullName,
    email: profile.email,
    commune: profile.commune,
    address: profile.address,
    avatar_url: profile.avatarUrl,
  });
}
