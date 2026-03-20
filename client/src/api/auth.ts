import api from './client';
import {
  AuthResponse,
  LoginRequest,
  LoginOtpSentResponse,
  VerifyLoginRequest,
  RegisterRequest,
  RegisterOtpSentResponse,
  VerifyRegisterRequest,
  IUser,
} from '@shared/types';

// Registration step 1: send OTP
export async function register(data: RegisterRequest): Promise<RegisterOtpSentResponse> {
  const res = await api.post<RegisterOtpSentResponse>('/auth/register', data);
  return res.data;
}

// Registration step 2: verify OTP + create account
export async function verifyRegister(data: VerifyRegisterRequest): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register/verify', data);
  return res.data;
}

// Login step 1: username + password → get OTP sent
export async function login(data: LoginRequest): Promise<LoginOtpSentResponse> {
  const res = await api.post<LoginOtpSentResponse>('/auth/login', data);
  return res.data;
}

// Login step 2: verify OTP → get full token
export async function verifyLogin(data: VerifyLoginRequest): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login/verify', data);
  return res.data;
}

export async function getMe(): Promise<IUser> {
  const res = await api.get<IUser>('/auth/me');
  return res.data;
}
