import api from "../lib/api-client";

async function loginService(username: string, password: string) {
  try {
    const response = await api.post("/auth/login", { username, password });
    return response.data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export { loginService };
