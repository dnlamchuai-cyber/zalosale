// AI: Codex | WHY: Serve saved group metadata immediately without a Zalo network request.
// SPEC: user request to retain source/destination group data on 2026-09-06
import fs from "node:fs";

function isGroupMetadata(group) {
  return group
    && typeof group === "object"
    && (typeof group.id === "string" || typeof group.id === "number")
    && String(group.id).trim().length > 0
    && typeof group.name === "string"
    && group.name.trim().length > 0;
}

export function toPersistedGroups(groups) {
  return groups.filter(isGroupMetadata).map((group) => ({
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
  }));
}

export function readPersistedGroups(cachePath) {
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (!Array.isArray(cache?.groups)) return [];
    return toPersistedGroups(cache.groups);
  } catch {
    return [];
  }
}
