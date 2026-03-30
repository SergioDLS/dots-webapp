import { cookies } from "next/headers";
import { createServerApi } from "@/lib/create-server-api";
import { Difficulty } from "@/types/levels.types";

export async function getLevelsServer(): Promise<
  Array<Difficulty>
> {

  const cookieStore = (await Promise.resolve(cookies() as unknown)) as {
    getAll?: () => Array<{ name: string; value: string }>;
  };

  const cookieList = cookieStore.getAll ? cookieStore.getAll() : [];
  const cookieHeader = cookieList.map((c) => `${c.name}=${c.value}`).join("; ");

  // Create a per-request axios instance that forwards cookies and handles refresh
  const api = createServerApi(cookieHeader);
  // If an access_token cookie is present, attach it as Authorization for compatibility
  const accessCookie = cookieList.find((c) => c.name === "access_token");
  if (accessCookie?.value) {
    api.defaults.headers = api.defaults.headers ?? {};
    api.defaults.headers.common = api.defaults.headers.common ?? {};
    api.defaults.headers.common["Authorization"] = `Bearer ${accessCookie.value}`;
  }

  try {
    const res = await api.get("/levels");
    const data = res.data;
    console.log(data);
    
    return Array.isArray(data) ? data : data.levels ?? [];
  } catch (err) {
    console.error("getLevelsServer error:", err);
    throw err;
  }
}
