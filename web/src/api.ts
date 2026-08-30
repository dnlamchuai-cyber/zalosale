import type { AppConfig, GroupInfo, LogEntry, ScanPost, StatusData } from "./types";

const BASE = "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  status: () => request<StatusData>("/api/status"),
  config: () => request<{ ok: true; config: AppConfig }>("/api/config"),
  saveConfig: (cfg: AppConfig) =>
    request<{ ok: true; config: AppConfig }>("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    }),
  groups: (force = false) =>
    request<{ ok: true; groups: GroupInfo[] }>(`/api/groups${force ? "?force=1" : ""}`),
  logs: () => request<{ ok: true; logs: LogEntry[] }>("/api/logs"),
  qr: () => request<{ ok: true; qr: string | null; loggedIn: boolean }>("/api/qr"),
  control: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};
