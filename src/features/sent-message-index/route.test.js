// Ai viết: Codex — kiểm chứng biên HTTP tìm kho tin
// Tại sao: route phải chặn input dài và không lộ lỗi nội bộ
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

import assert from "node:assert/strict";
import { clearSentRoomsRoute, resendSentRoomRoute, searchSentRoomsRoute } from "./route.js";

function mockResponse() {
  const response = { statusCode: 200, body: null };
  response.status = (code) => { response.statusCode = code; return response; };
  response.json = (body) => { response.body = body; return response; };
  return response;
}

const rooms = [{ id: "room-1", roomCode: "R151" }];
const index = { search: ({ query }) => query === "R151" ? rooms : [] };

const validResponse = mockResponse();
searchSentRoomsRoute({ query: { q: "R151", limit: "20" }, sentMessageIndex: index }, validResponse);
assert.equal(validResponse.statusCode, 200);
assert.deepEqual(validResponse.body, { ok: true, rooms });

const invalidResponse = mockResponse();
searchSentRoomsRoute({ query: { q: "x".repeat(201) }, sentMessageIndex: index }, invalidResponse);
assert.equal(invalidResponse.statusCode, 400);
assert.match(invalidResponse.body.error, /tối đa 200/i);

const errorResponse = mockResponse();
searchSentRoomsRoute({ query: {}, sentMessageIndex: { search: () => { throw new Error("secret DB path"); } } }, errorResponse);
assert.equal(errorResponse.statusCode, 500);
assert.equal(JSON.stringify(errorResponse.body).includes("secret DB path"), false);

const clearResponse = mockResponse();
clearSentRoomsRoute({ body: { confirmation: "CLEAR_SENT_ROOMS" }, sentMessageIndex: { clear: () => 2 } }, clearResponse);
assert.deepEqual(clearResponse.body, { ok: true, clearedRooms: 2 });

const invalidClearResponse = mockResponse();
clearSentRoomsRoute({ body: {}, sentMessageIndex: index }, invalidClearResponse);
assert.equal(invalidClearResponse.statusCode, 400);

const resendResponse = mockResponse();
await resendSentRoomRoute({
  params: { roomId: "550e8400-e29b-41d4-a716-446655440000" },
  resendSentRoom: async () => ({ sent: 2, failed: 0 }),
}, resendResponse);
assert.deepEqual(resendResponse.body, { ok: true, sent: 2, failed: 0 });

const invalidResendResponse = mockResponse();
await resendSentRoomRoute({ params: { roomId: "room-1" }, resendSentRoom: async () => ({ sent: 1 }) }, invalidResendResponse);
assert.equal(invalidResendResponse.statusCode, 400);
