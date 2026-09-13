import type { AppConfig, CustomerProfile, GroupInfo, LogEntry, MapCandidate, MapRoomsResult, SearchRequest, SearchZone, SentRoomSummary, StatusData } from "./types";

const BASE = "";
const GROUPS_CACHE_KEY = "zalo-sale.groups-cache";
// WHY: Metadata nhóm phải có ngay qua các lần mở web; "Quét mới" là điểm làm mới rõ ràng.
type GroupsResponse = { ok: true; groups: GroupInfo[] };
let groupsRequest: Promise<GroupsResponse> | null = null;

function groupMetadata(value: unknown): GroupInfo | null {
  if (!value || typeof value !== "object") return null;
  const group = value as Record<string, unknown>;
  if ((typeof group.id !== "string" && typeof group.id !== "number") || !String(group.id).trim() || typeof group.name !== "string" || !group.name.trim()) return null;

  return {
    id: String(group.id),
    name: group.name,
    ...(typeof group.avt === "string" && group.avt ? { avt: group.avt } : {}),
    ...(typeof group.avatar === "string" && group.avatar ? { avatar: group.avatar } : {}),
    ...(typeof group.type === "number" ? { type: group.type } : {}),
    ...(typeof group.subType === "number" ? { subType: group.subType } : {}),
    ...(group.isOwner === true ? { isOwner: true } : {}),
    ...(group.isAdmin === true ? { isAdmin: true } : {}),
    ...(group.isManager === true ? { isManager: true } : {}),
    ...(typeof group.totalMember === "number" ? { totalMember: group.totalMember } : {}),
  };
}

function groupMetadataList(groups: unknown[]): GroupInfo[] {
  return groups.map(groupMetadata).filter((group): group is GroupInfo => group !== null);
}

function cachedGroups(): GroupsResponse | null {
  try {
    const raw = localStorage.getItem(GROUPS_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (!Array.isArray(cache.groups)) return null;
    const groups = groupMetadataList(cache.groups);
    return groups.length ? { ok: true, groups } : null;
  } catch {
    return null;
  }
}

// AI: Codex | WHY: Panels need cached group metadata before their first render to avoid avatar flicker.
// SPEC: user request to retain source/destination group thumbnails on 2026-09-06
export function readCachedGroups(): GroupInfo[] {
  return cachedGroups()?.groups || [];
}

function saveGroups(groups: GroupInfo[]) {
  try {
    const metadata = groupMetadataList(groups);
    if (metadata.length) localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), groups: metadata }));
  } catch {
    // Cache chỉ giúp nhanh hơn; không được làm hỏng luồng chính khi trình duyệt chặn storage.
  }
}

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
  groups: async (force = false): Promise<GroupsResponse> => {
    const cache = !force ? cachedGroups() : null;
    if (cache) return cache;
    if (!force && groupsRequest) return groupsRequest;

    const requestGroups = async () => {
      const response = await request<GroupsResponse>(`/api/groups${force ? "?force=1" : ""}`);
      saveGroups(response.groups || []);
      return response;
    };

    if (force) return requestGroups();
    groupsRequest = requestGroups().finally(() => { groupsRequest = null; });
    return groupsRequest;
  },
  logs: () => request<{ ok: true; logs: LogEntry[] }>("/api/logs"),
  qr: () => request<{ ok: true; qr: string | null; loggedIn: boolean }>("/api/qr"),
  sentRooms: (query = "", limit = 20) =>
    request<{ ok: true; rooms: SentRoomSummary[] }>(`/api/sent-rooms?q=${encodeURIComponent(query)}&limit=${limit}`),
  clearSentRooms: () => request<{ ok: true; clearedRooms: number }>("/api/sent-rooms/clear", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "CLEAR_SENT_ROOMS" }),
  }),
  resendSentRoom: (roomId: string) => request<{ ok: true; sent: number; failed: number }>(`/api/sent-rooms/${encodeURIComponent(roomId)}/resend`, {
    method: "POST", headers: { "Content-Type": "application/json" },
  }),
  customers: () => request<{ ok: true; customers: CustomerProfile[] }>("/api/customers"),
  createCustomer: (input: { name: string; phone: string }) => request<{ ok: true; customer: CustomerProfile }>("/api/customers", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }),
  searchRequests: (customerId: string) => request<{ ok: true; searchRequests: SearchRequest[] }>(`/api/customers/${encodeURIComponent(customerId)}/search-requests`),
  createSearchRequest: (customerId: string, title: string) => request<{ ok: true; searchRequest: SearchRequest }>(`/api/customers/${encodeURIComponent(customerId)}/search-requests`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }),
  }),
  searchZones: (requestId: string) => request<{ ok: true; zones: SearchZone[] }>(`/api/search-requests/${encodeURIComponent(requestId)}/search-zones`),
  createSearchZone: (requestId: string, input: { label: string; center: { latitude: number; longitude: number }; radiusMeters: number; enabled?: boolean }) => request<{ ok: true; zone: SearchZone }>(`/api/search-requests/${encodeURIComponent(requestId)}/search-zones`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }),
  geocodeMap: (query: string) => request<{ ok: true; candidates: MapCandidate[] }>("/api/map/geocode", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  }),
  mapRooms: (requestId: string) => request<MapRoomsResult & { ok: true }>(`/api/search-requests/${encodeURIComponent(requestId)}/map-rooms`),
  mapRoomsForZones: (zones: Array<{ label: string; center: { latitude: number; longitude: number }; radiusMeters: number; enabled?: boolean }>) => request<MapRoomsResult & { ok: true }>("/api/map/rooms", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zones }),
  }),
  resolveRoomLocation: (roomId: string, address: string, options: { selectFirst?: boolean } = {}) => request<{ ok: true; location: { status: string; latitude: number | null; longitude: number | null } }>(`/api/rooms/${encodeURIComponent(roomId)}/location/resolve`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, ...options }),
  }),
  backfillRoomAddresses: () => request<{ ok: true; updated: number }>("/api/map/rooms/backfill-addresses", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
  }),
  control: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};
