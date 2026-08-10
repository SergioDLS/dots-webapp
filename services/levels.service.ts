import api from "../lib/api-client";
import type {
  PathNeighborsResponse,
  PathResponse,
} from "@/types/path.types";

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

/**
 * Compañeros más cercanos en el camino. Es un adorno: quien lo consuma debe
 * degradar en silencio si falla (ver PathContainer).
 */
async function getPathNeighborsService(): Promise<PathNeighborsResponse> {
  const response = await api.get("/path/neighbors");
  return response.data;
}

export { getLevelsService, getPathService, getPathNeighborsService };
