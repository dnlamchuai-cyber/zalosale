// Ai viết: AI PROMPT-001 + AI regression TASK-004
// Tại sao dùng node:assert: assertion sai phải làm process thất bại và chặn root test
// Link SPEC/PROMPT: docs/03_SPEC/SPEC-001.md + docs/05_TASKS/TASK-004_KIEM-THU-TOAN-DIEN.md
import assert from "node:assert/strict";
import { checkCommunity } from "./service.js";

async function run() {
  const inRangeTs = new Date("2026-08-22T12:00:00+07:00").getTime();
  const mockFetch1 = async () => [
    [{ data: { content: "Phòng trọ Cầu Giấy 4tr5", ts: inRangeTs } }],
    [{ data: { content: "Phòng Hà Đông", ts: inRangeTs } }],
  ];
  const areas = [{ keywords: ["cau giay"], groupLink: "" }];
  const res1 = await checkCommunity({ groupId: "8089152704833938973", from: "2026-08-21", to: "2026-08-24", keyword: "cau giay" }, { api: {}, areas, fetchFn: mockFetch1 });
  assert.equal(res1.total, 1);
  assert.match(res1.posts[0]?.clean, /Cầu Giấy/);

  const mockFetch2 = async () => [
    [{ data: { content: "Tin 1", ts: inRangeTs } }],
    [{ data: { content: "Tin 2", ts: inRangeTs } }],
  ];
  const res2 = await checkCommunity({ groupId: "8089152704833938973", from: "2026-08-21", to: "2026-08-24" }, { api: {}, areas: [], fetchFn: mockFetch2 });
  assert.equal(res2.total, 2);

  const mockFetch3 = async () => [];
  const res3 = await checkCommunity({ groupId: "8089152704833938973", from: "2026-08-21", to: "2026-08-24" }, { api: {}, fetchFn: mockFetch3 });
  assert.equal(res3.total, 0);

  const mockFilteredPosts = async () => [
    [{ data: { content: "Tìm phòng Cầu Giấy", ts: inRangeTs } }],
    [{ data: { content: "Cho thuê Cầu Giấy\nhoa hồng 30%\nGiá 4tr", ts: inRangeTs } }],
  ];
  const filtered = await checkCommunity(
    { groupId: "8089152704833938973", from: "2026-08-21", to: "2026-08-24" },
    {
      api: {},
      areas,
      fetchFn: mockFilteredPosts,
      excludeKeywords: ["tìm phòng"],
      deleteLines: ["hoa hồng"],
      filter: { removePercentLines: true, removePriceLines: true },
    },
  );
  assert.equal(filtered.total, 1);
  assert.equal(filtered.posts[0].clean, "Cho thuê Cầu Giấy");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
