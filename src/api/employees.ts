export type EntraEmployee = {
  id: string;
  name: string;
  email: string;
  upn: string;
  enabled: boolean;
};

export async function searchEmployees(query = "", signal?: AbortSignal): Promise<EntraEmployee[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  params.set("limit", "50");
  const res = await fetch(`/api/employees?${params}`, { signal });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    employees?: EntraEmployee[];
    error?: string;
    detail?: string;
  } | null;
  if (!res.ok || !data?.ok) {
    const parts = [data?.error, data?.detail].filter(Boolean);
    throw new Error(parts.length ? parts.join(" ") : "Could not load Entra users.");
  }
  return Array.isArray(data.employees) ? data.employees : [];
}
