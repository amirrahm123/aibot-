import api from './client';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  IUser,
} from '@shared/types';

// Registration: single step
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', data);
  return res.data;
}

// Login: single step
export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', data);
  return res.data;
}

export async function getMe(): Promise<IUser> {
  const res = await api.get<IUser>('/auth/me');
  return res.data;
}
