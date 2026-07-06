import api from "../lib/api-client";

export type RegisterPayload = {
  name: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  birthday?: string;
};

async function loginService(username: string, password: string) {
  try {
    const response = await api.post("/auth/login", { username, password });
    return response.data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

async function registerService(payload: RegisterPayload) {
  const response = await api.post("/auth/register", payload);
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
  registerService,
  forgotPasswordService,
  resetPasswordService,
};
