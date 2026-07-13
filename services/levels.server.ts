import { cookies } from "next/headers";
import { createServerApi } from "@/lib/create-server-api";
import { Difficulty } from "@/types/levels.types";

export async function getLevelsServer(): Promise<Array<Difficulty>> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // Per-request axios instance that forwards cookies and handles refresh.
  // createServerApi already picks up the access_token cookie if present.
  const api = createServerApi(cookieHeader);

  const res = await api.get("/levels");
  const data = res.data;
  return Array.isArray(data) ? data : (data.levels ?? []);
}
