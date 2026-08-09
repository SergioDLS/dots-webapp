import api from "../lib/api-client";

export type InvitationPreview = {
  email: string;
  name: string;
  lastName: string;
};

export type AcceptInvitePayload = {
  token: string;
  username: string;
  password: string;
  name: string;
  lastName: string;
  birthday?: string;
};

async function loginService(username: string, password: string) {
  try {
    const response = await api.post("/auth/login", { username, password });
    return response.data;
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    console.error("Login error — status:", status ?? "network");
    throw error;
  }
}

async function getInvitationService(token: string): Promise<InvitationPreview> {
  const response = await api.get(`/auth/invitations/${token}`);
  return response.data;
}

async function acceptInvitationService(payload: AcceptInvitePayload) {
  const response = await api.post("/auth/invitations/accept", payload);
  return response.data;
}

async function forgotPasswordService(email: string) {
  const response = await api.post("/auth/forgot-password", { email });
  return response.data;
}

async function resetPasswordService(
  email: string,
  code: string,
  password: string,
) {
  const response = await api.post("/auth/reset-password", {
    email,
    code,
    password,
  });
  return response.data;
}

export {
  loginService,
  getInvitationService,
  acceptInvitationService,
  forgotPasswordService,
  resetPasswordService,
};
