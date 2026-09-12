// Ai viết: Codex — kiểm chứng slice lưu và tìm tin đã gửi
// Tại sao: test repository SQLite thật để không che lỗi migration/FTS bằng mock
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSentMessageRepository } from "./repository.js";
import { createSentMessageIndex } from "./service.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zalosale-sent-index-"));
const databasePath = path.join(tempDir, "test.sqlite");
let batchRepository;

try {
  const index = createSentMessageIndex({ databasePath });
  const baseDelivery = {
    sourceGroup: { id: "source-a", name: "Kho Cầu Giấy" },
    originalContent: "Mã: R151\nĐịa chỉ: 18A Trung Kính - Cầu Giấy",
    sentContent: "Mã: R151\nĐịa chỉ: 18A Trung Kính - Cầu Giấy",
    sentAt: 1_788_067_200_000,
    imageTotal: 2,
  };

  index.recordBotDelivery({
    ...baseDelivery,
    destinationGroup: { id: "dest-b", name: "Khách thuê Cầu Giấy" },
  });
  index.recordBotDelivery({
    ...baseDelivery,
    destinationGroup: { id: "dest-c", name: "Phòng Hà Nội" },
  });

  assert.equal(
    index.hasSourceSent({ sourceId: "source-a", content: baseDelivery.sentContent }),
    true,
  );
  assert.equal(
    index.hasSourceSent({ sourceId: "source-b", content: baseDelivery.sentContent }),
    false,
  );
  assert.equal(
    index.hasSourceSent({ sourceId: "source-a", content: "Mã: R151\nĐịa chỉ khác" }),
    false,
  );

  const byCode = index.search({ query: "R151", limit: 20 });
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].roomCode, "R151");
  assert.equal(byCode[0].sourceGroups[0].name, "Kho Cầu Giấy");
  assert.equal(byCode[0].destinations.length, 2);

  const withoutAccents = index.search({ query: "trung kinh", limit: 20 });
  assert.equal(withoutAccents.length, 1);
  assert.equal(withoutAccents[0].sentCount, 2);

  index.recordBotDelivery({
    ...baseDelivery,
    destinationGroup: { id: "dest-b", name: "Khách thuê Cầu Giấy" },
    originalContent: "Mã: R151\nCập nhật giá phòng mới",
    sentContent: "Mã: R151\nCập nhật giá phòng mới",
  });
  assert.equal(index.search({ query: "trung kinh", limit: 20 }).length, 1);
  assert.equal(
    index.hasSourceSent({ sourceId: "source-a", content: "Mã: R151\nCập nhật giá phòng mới" }),
    true,
  );

  index.recordBotDelivery({
    ...baseDelivery,
    destinationGroup: { id: "dest-b", name: "Khách thuê Cầu Giấy" },
    sentContent: "Mã: R152\nĐịa chỉ mới",
    originalContent: "Mã: R152\nĐịa chỉ mới",
    messageIds: ["m1", "m2", "m1"],
  });
  assert.equal(index.countSentMessageIds(["m1", "m2"]), 2);
  assert.equal(index.countSentMessageIds(["m1", "chua-gui"]), 1);
  assert.equal(index.countSentMessageIds([]), 0);
  assert.equal(index.countSentMessageIds(["khong-co"]), 0);

  assert.throws(
    () => index.search({ query: "x".repeat(201), limit: 20 }),
    /tối đa 200/i,
  );
  assert.equal(index.clear(), 2);
  assert.deepEqual(index.search({ query: "", limit: 20 }), []);
  index.close();

  batchRepository = createSentMessageRepository(path.join(tempDir, "batch.sqlite"));
  const firstRoomId = batchRepository.recordDelivery({
    roomCode: "R201",
    sourceGroup: { id: "source-a", name: "Nguồn A" },
    destinationGroup: { id: "dest-a", name: "Đích A" },
    originalContent: "R201",
    sentContent: "R201",
    normalizedSearch: "r201",
    contentHash: "hash-r201",
    sentAt: 20,
    imageTotal: 0,
  });
  const secondRoomId = batchRepository.recordDelivery({
    roomCode: "R202",
    sourceGroup: { id: "source-b", name: "Nguồn B" },
    destinationGroup: { id: "dest-b", name: "Đích B" },
    originalContent: "R202",
    sentContent: "R202",
    normalizedSearch: "r202",
    contentHash: "hash-r202",
    sentAt: 10,
    imageTotal: 0,
  });
  const deliveryRows = batchRepository.deliveriesForRooms([firstRoomId, secondRoomId]);

  assert.equal(deliveryRows.length, 2);
  assert.deepEqual(new Set(deliveryRows.map((row) => row.room_id)), new Set([firstRoomId, secondRoomId]));
  batchRepository.close();
  batchRepository = null;
} finally {
  batchRepository?.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
