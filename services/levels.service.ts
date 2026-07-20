import api from "../lib/api-client";
import type { PathResponse } from "@/types/path.types";

async function getLevelsService() {
  try {
    const response = await api.get("/levels");
    return response.data;
  } catch (error) {
    console.error("Levels fetch error:", error);
    throw error;
  }
}

async function getPathService(): Promise<PathResponse> {
  const response = await api.get("/path");
  return response.data;
}

export { getLevelsService, getPathService };
