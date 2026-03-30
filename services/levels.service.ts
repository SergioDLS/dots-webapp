import api from "../lib/api-client";

async function getLevelsService() {
  try {
    const response = await api.get("/levels");
    return response.data;
  } catch (error) {
    console.error("Levels fetch error:", error);
    throw error;
  }
}

export { getLevelsService };
