import { apiFetch } from "./http";

export interface SessionUser {
  email: string;
  name: string;
  type: number;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function me(): Promise<SessionUser> {
  return apiFetch<SessionUser>("/auth/me");
}

export interface SignupInput {
  email: string;
  name: string;
  password: string;
  universityId?: number;
}

export function signup(input: SignupInput): Promise<{ email: string }> {
  return apiFetch("/users", { method: "POST", body: JSON.stringify(input) });
}

export function confirmEmail(email: string, token: string): Promise<{ confirmed: true }> {
  return apiFetch("/users/confirm", { method: "POST", body: JSON.stringify({ email, token }) });
}

export function resendConfirmation(email: string): Promise<{ sent: true }> {
  return apiFetch("/users/resend-confirmation", { method: "POST", body: JSON.stringify({ email }) });
}

export function requestPasswordReset(email: string): Promise<{ sent: true }> {
  return apiFetch("/users/request-password-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(email: string, token: string, newPassword: string): Promise<{ reset: true }> {
  return apiFetch("/users/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, token, newPassword }),
  });
}
