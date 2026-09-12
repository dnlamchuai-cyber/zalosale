// Ai viết: Codex — nghiệp vụ gom phòng và tìm lịch sử gửi
// Tại sao: service giữ quy tắc mã phòng, repository chỉ xử lý SQLite
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSentMessageRepository } from "./repository.js";
import {
  contentHash,
  extractRoomCode,
  generateRoomCode,
  normalizeSearchText,
  toFtsQuery,
} from "./normalize.js";

const ROOT = path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))));
const DEFAULT_DATABASE_PATH = path.join(ROOT, "data", "zalosale.sqlite");
const MAX_QUERY_LENGTH = 200; // WHY: giới hạn chi phí parse và input bất thường
const MAX_RESULTS = 100;

function summarizeRoom(room, deliveries) {
  const sourceMap = new Map();
  const destinationMap = new Map();
  for (const delivery of deliveries) {
    if (delivery.source_group_id) {
      sourceMap.set(delivery.source_group_id, {
        id: delivery.source_group_id,
        name: delivery.source_name || "Không xác định",
      });
    }
    const previous = destinationMap.get(delivery.destination_group_id);
    destinationMap.set(delivery.destination_group_id, {
      id: delivery.destination_group_id,
      name: delivery.destination_name || "Không xác định",
      sentCount: (previous?.sentCount || 0) + 1,
      lastSentAt: Math.max(previous?.lastSentAt || 0, delivery.sent_at),
    });
  }
  return {
    id: room.id,
    roomCode: room.room_code,
    latestContent: room.latest_content,
    status: room.status,
    sourceGroups: [...sourceMap.values()],
    destinations: [...destinationMap.values()],
    sentCount: deliveries.length,
    lastSentAt: deliveries[0]?.sent_at || room.updated_at,
  };
}

function groupDeliveriesByRoom(deliveries) {
  const byRoomId = new Map();
  for (const delivery of deliveries) {
    const roomDeliveries = byRoomId.get(delivery.room_id) || [];
    roomDeliveries.push(delivery);
    byRoomId.set(delivery.room_id, roomDeliveries);
  }
  return byRoomId;
}

export function createSentMessageIndex({ databasePath = DEFAULT_DATABASE_PATH } = {}) {
  const repository = createSentMessageRepository(databasePath);

  function recordBotDelivery(input) {
    const roomCode = extractRoomCode(input.originalContent) || generateRoomCode();
    const normalizedSearch = normalizeSearchText(
      `${roomCode} ${input.originalContent} ${input.sentContent}`,
    );
    return repository.recordDelivery({
      ...input,
      roomCode,
      normalizedSearch,
      contentHash: contentHash(input.sentContent),
      sentAt: Number(input.sentAt) || Date.now(),
      imageTotal: Number(input.imageTotal) || 0,
    });
  }

  function search({ query = "", limit = 20 } = {}) {
    if (typeof query !== "string" || query.length > MAX_QUERY_LENGTH) {
      throw new Error("Từ khóa tối đa 200 ký tự");
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_RESULTS);
    const rooms = repository.roomRows(toFtsQuery(query), safeLimit);
    const deliveriesByRoom = groupDeliveriesByRoom(repository.deliveriesForRooms(rooms.map((room) => room.id)));
    return rooms.map((room) => summarizeRoom(room, deliveriesByRoom.get(room.id) || []));
  }

  function hasSent({ destinationId, content }) {
    if (!destinationId || !content) return false;
    return repository.hasDelivery(destinationId, contentHash(content));
  }

  function hasSourceSent({ sourceId, content }) {
    if (!sourceId || !content) return false;
    return repository.hasSourceDelivery(sourceId, contentHash(content));
  }

  function clear() {
    return repository.clearDeliveries();
  }

  return { recordBotDelivery, hasSent, hasSourceSent, search, clear, close: repository.close };
}
