// Ai viết: Codex — persistence cho kho tin đã gửi
// Tại sao: SQL và transaction nằm ngoài service để biên DB thay được
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

import crypto from "node:crypto";
import { openDatabase } from "../../db/client.js";

export function createSentMessageRepository(databasePath) {
  const database = openDatabase(databasePath);

  function transaction(work) {
    database.exec("BEGIN IMMEDIATE");
    try {
      const value = work();
      database.exec("COMMIT");
      return value;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  function upsertGroup(group, timestamp) {
    if (!group?.id) return null;
    database.prepare(`
      INSERT INTO zalo_groups (id, name, last_resolved_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = CASE WHEN excluded.name = '' THEN zalo_groups.name ELSE excluded.name END,
        last_resolved_at = excluded.last_resolved_at
    `).run(String(group.id), String(group.name || ""), timestamp);
    return String(group.id);
  }

  function findRoomByCode(roomCode) {
    return database.prepare("SELECT * FROM room_records WHERE room_code = ? COLLATE NOCASE").get(roomCode);
  }

  function insertRoom({ roomCode, content, normalizedSearch, timestamp }) {
    const id = crypto.randomUUID();
    database.prepare(`
      INSERT INTO room_records
        (id, room_code, latest_content, normalized_search, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, roomCode, content, normalizedSearch, timestamp, timestamp);
    database.prepare("INSERT INTO room_search (room_id, search_text) VALUES (?, ?)")
      .run(id, normalizedSearch);
    return findRoomByCode(roomCode);
  }

  function updateRoom(room, content, normalizedSearch, timestamp) {
    const combinedSearch = room.normalized_search.includes(normalizedSearch)
      ? room.normalized_search
      : `${room.normalized_search} ${normalizedSearch}`.trim();
    database.prepare(`
      UPDATE room_records
      SET latest_content = ?, normalized_search = ?, updated_at = ?
      WHERE id = ?
    `).run(content, combinedSearch, timestamp, room.id);
    database.prepare("DELETE FROM room_search WHERE room_id = ?").run(room.id);
    database.prepare("INSERT INTO room_search (room_id, search_text) VALUES (?, ?)")
      .run(room.id, combinedSearch);
    return { ...room, latest_content: content, normalized_search: combinedSearch, updated_at: timestamp };
  }

  function recordDelivery(delivery) {
    return transaction(() => {
      const capturedAt = Date.now();
      const sourceId = upsertGroup(delivery.sourceGroup, capturedAt);
      const destinationId = upsertGroup(delivery.destinationGroup, capturedAt);
      const existingRoom = findRoomByCode(delivery.roomCode);
      const room = existingRoom
        ? updateRoom(existingRoom, delivery.sentContent, delivery.normalizedSearch, delivery.sentAt)
        : insertRoom({
          roomCode: delivery.roomCode,
          content: delivery.sentContent,
          normalizedSearch: delivery.normalizedSearch,
          timestamp: delivery.sentAt,
        });
      database.prepare(`
        INSERT INTO sent_messages
          (id, room_id, source_group_id, destination_group_id, original_content,
           sent_content, content_hash, sent_at, captured_at, image_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(), room.id, sourceId, destinationId,
        delivery.originalContent, delivery.sentContent, delivery.contentHash,
        delivery.sentAt, capturedAt, delivery.imageTotal,
      );
      const sentAt = delivery.sentAt;
      const msgIds = [...new Set((delivery.messageIds || []).map(String).filter(Boolean))];
      if (msgIds.length) {
        const placeholders = msgIds.map(() => "(?, ?)").join(", ");
        const params = msgIds.flatMap((id) => [id, sentAt]);
        database.prepare(
          `INSERT OR IGNORE INTO sent_message_ids (message_id, sent_at) VALUES ${placeholders}`
        ).run(...params);
      }
      return room.id;
    });
  }

  function roomRows(ftsQuery, limit) {
    if (!ftsQuery) {
      return database.prepare("SELECT * FROM room_records ORDER BY updated_at DESC LIMIT ?").all(limit);
    }
    return database.prepare(`
      SELECT room_records.* FROM room_search
      JOIN room_records ON room_records.id = room_search.room_id
      WHERE room_search MATCH ?
      ORDER BY CASE WHEN lower(room_code) = lower(?) THEN 0 ELSE 1 END, updated_at DESC
      LIMIT ?
    `).all(ftsQuery, ftsQuery.replaceAll('"', "").replaceAll("*", "").replaceAll(" AND ", " "), limit);
  }

  function deliveriesForRooms(roomIds) {
    const ids = roomIds.map(String).filter(Boolean);
    if (!ids.length) return [];
    const placeholders = ids.map(() => "?").join(", ");
    return database.prepare(`
      SELECT sent_messages.*, source.name AS source_name, destination.name AS destination_name
      FROM sent_messages
      LEFT JOIN zalo_groups source ON source.id = sent_messages.source_group_id
      JOIN zalo_groups destination ON destination.id = sent_messages.destination_group_id
      WHERE room_id IN (${placeholders})
      ORDER BY room_id, sent_at DESC
    `).all(...ids);
  }

  function hasDelivery(destinationId, contentHash) {
    return Boolean(database.prepare(`
      SELECT 1 FROM sent_messages
      WHERE destination_group_id = ? AND content_hash = ?
      LIMIT 1
    `).get(String(destinationId), String(contentHash)));
  }

  /** Mã phòng chỉ để hiển thị; chặn quét lại dựa trên đúng nguồn và nội dung đã gửi. */
  function hasSourceDelivery(sourceId, contentHash) {
    return Boolean(database.prepare(`
      SELECT 1 FROM sent_messages
      WHERE source_group_id = ? AND content_hash = ?
      LIMIT 1
    `).get(String(sourceId), String(contentHash)));
  }

  /** Đếm trong danh sách có bao nhiêu ID tin đã gửi (để loại cả cụm khi quét lại). */
  function countSentMessageIds(ids) {
    const list = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!list.length) return 0;
    const placeholders = list.map(() => "?").join(", ");
    return database.prepare(
      `SELECT COUNT(*) AS total FROM sent_message_ids WHERE message_id IN (${placeholders})`
    ).get(...list).total;
  }

  function clearDeliveries() {
    return transaction(() => {
      const roomCount = database.prepare("SELECT COUNT(*) AS total FROM room_records").get().total;
      database.exec("DELETE FROM room_search; DELETE FROM sent_messages; DELETE FROM room_records; DELETE FROM sent_message_ids;");
      database.exec("DELETE FROM zalo_groups WHERE id NOT IN (SELECT source_group_id FROM sent_messages UNION SELECT destination_group_id FROM sent_messages);");
      return roomCount;
    });
  }

  return {
    database, recordDelivery, hasDelivery, hasSourceDelivery, countSentMessageIds, clearDeliveries, roomRows, deliveriesForRooms, close: () => database.close(),
  };
}
