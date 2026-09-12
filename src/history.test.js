// Ai viết: Muse Spark | Tại sao: khóa việc chùm ảnh + mã phòng gom vào tin mở cụm khi quét lịch sử
// Link: phản hồi user ngày 2026-09-11 (P304/P305 tách cụm) + SPEC-005 roomPrefix
import assert from "node:assert/strict";
import { test } from "node:test";
import { segmentMessages, fetchRecentBatches } from "./history.js";

const t0 = 1_700_000_000_000;
const text = (content, sec) => ({ data: { content, ts: t0 + sec * 1000 } });
const photo = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
const OPENING = "🎊NHÀ MỚI SIÊU ĐẸP🎊 🏢Địa chỉ : 639 Hoàng Hoa Thám, Vĩnh Phúc, Ba Đình. Trống: P102, P205, P305, P405, P406, P504. Trống 21/9: P304 - 5tr. Liên hệ 0981234567";

function rocketSequence() {
  return [
    text("P504", 0), text("P405,406", 7), photo(8), text("P305", 15), text("P304", 22),
    photo(23), photo(24), photo(25), photo(26), photo(27), photo(28), text(OPENING, 100),
  ];
}

test("đạt trần mà chưa có tin mở: giữ phòng chờ, tin mở tới gom hết (case ROCKET 31 tin)", () => {
  const OPEN2 = "🌹30% \n🎊Thưởng 50k cho ctv\n\n🎊NHÀ MỚI SIÊU ĐẸP🎊\n🏢Địa chỉ : 639 Hoàng Hoa Thám, Vĩnh Phúc, Ba Đình. Trống: P102, P205, P305, P405, P504. Liên hệ 0981234567";
  const t = (content, sec) => ({ data: { content, ts: t0 + sec * 1000 } });
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
  const msgs = [
    t("P504", 0), ph(0), ph(0), ph(0), ph(0),
    t("P405,406", 7), ph(8), ph(8), ph(8), ph(8), ph(8),
    t("P305", 15), ph(15), ph(15),
    t("P304", 22), ph(23), ph(23), ph(23), ph(23), ph(23), ph(23), ph(23), ph(23),
    t("P205", 29), ph(29), ph(29),
    t("P102", 33), ph(33), ph(33),
    ph(34),
    t(OPEN2, 80),
  ];
  assert.equal(msgs.length, 31);
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 31);
  assert.ok(batches[0][0].data.content.includes("639 Hoàng Hoa Thám"));
});

test("quá 50 tin chờ mà không có tin mở: xả cũ nhất, không mất tin", () => {
  const many = Array.from({ length: 60 }, (_, i) => ({ data: { content: "P" + (100 + i), ts: t0 + i * 2000 } }));
  const batches = segmentMessages(many, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  const total = batches.reduce((n, b) => n + b.length, 0);
  assert.equal(total, many.length);
});

test("sticker giữa 2 chùm chỉ-có-ảnh: bỏ qua, gom chung", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
  const msgs = [ph(0), ph(1), ph(2), sticker(3), ph(4), ph(5), ph(6)];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 6);
});

test("sticker kề tin có chữ vẫn tách (SPEC-005)", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const msgs = [
    { data: { content: "Phòng đẹp giá 3tr", ts: t0 } },
    sticker(1),
    { data: { content: "Phòng xinh giá 4tr", ts: t0 + 2000 } },
  ];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 2);
});

test("mở + sticker + ảnh: gom 1 cụm (bước gắn ảnh mồ côi)", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
  const OPEN = "🌹30%\nR217\n\n🏠 NHÀ A29 - số 37 ngõ 136/6 Cầu Giấy\n🏠 Phòng: 405 gác xép (1/10 vào ở) giá 4tr5 đầy đủ nội thất điều hoà nóng lạnh máy giặt\nLiên hệ 0981234567";
  const areas = [{ id: "cg", keywords: ["cau giay"] }];
  const msgs = [ { data: { content: OPEN, ts: t0 } }, ph(1), ph(1), sticker(40), ph(41), ph(41), sticker(70), ph(71), ph(71) ];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas,
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 7);
  assert.ok(batches[0][0].data.content.includes("NHÀ A29"));
});

test("ảnh lẻ cuối run gộp vào cụm chữ trước nó (case ROCKET 14:51)", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
  const OPEN = "🌹30%\nR217\n\n🏠 NHÀ A29 - số 37 ngõ 136/6 Cầu Giấy\n🏠 Phòng: 405 gác xép (1/10 vào ở) giá 4tr5 đầy đủ nội thất điều hoà nóng lạnh máy giặt\nLiên hệ 0981234567";
  const areas = [{ id: "cg", keywords: ["cau giay"], routingKey: "cau-giay" }];
  const rules = [{ id: "r", name: "Cầu Giấy", normalizedName: "cau giay", type: "duong", routingKeys: ["cau-giay"], enabled: true, source: "manual", note: "", updatedAt: 1 }];
  const msgs = [{ data: { content: OPEN, ts: t0 } }, ph(1), ph(1), sticker(40), ph(41), ph(41), ph(41), sticker(70), ph(71), ph(71)];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas, rules,
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 8);
  assert.ok(batches[0][0].data.content.includes("NHÀ A29"));
});

test("attachOrphanPhotoBatches: quote trỏ ảnh thì về cụm mở (mở đứng đầu)", async () => {
  const { attachOrphanPhotoBatches } = await import("./history.js");
  const ph = (cli) => ({ data: { content: "", ts: 1, cliMsgId: cli, photo: "http://x/y.jpg" } });
  const batches = [
    [ph("7"), ph("7")],
    [{ data: { content: "Mở cụm", ts: 2, quote: { cliMsgId: "7" } } }],
  ];
  const out = attachOrphanPhotoBatches(batches, [0, 2]);
  assert.equal(out.length, 1);
  assert.equal(out[0].length, 3);
  assert.equal(out[0][0].data.content, "Mở cụm");
});

test("attachOrphanPhotoBatches: ảnh kẹp giữa 2 cụm chữ thì giữ nguyên (tránh gửi nhầm)", async () => {
  const { attachOrphanPhotoBatches } = await import("./history.js");
  const ph = () => ({ data: { content: "", ts: 1, photo: "http://x/y.jpg" } });
  const batches = [
    [{ data: { content: "Bài A", ts: 0 } }],
    [ph()],
    [{ data: { content: "Bài B", ts: 2 } }],
  ];
  const out = attachOrphanPhotoBatches(batches, [0, 3]);
  assert.equal(out.length, 3);
});
test("batcher có rules: ngữ cảnh cụm mở mang đích + lý do để thừa kế", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
  const OPEN = "🌹30%\nR217\n\n🏠 NHÀ A29 - số 37 ngõ 136/6 Cầu Giấy\n🏠 Phòng: 405 gác xép (1/10 vào ở) giá 4tr5 đầy đủ nội thất điều hoà nóng lạnh máy giặt\nLiên hệ 0981234567";
  const areas = [{ id: "cg", keywords: ["cau giay"] }];
  const rules = [{ id: "r", name: "Cầu Giấy", normalizedName: "cau giay", type: "duong", routingKeys: ["cau-giay"], enabled: true, source: "manual", note: "", updatedAt: 1 }];
  areas[0].routingKey = "cau-giay";
  const msgs = [{ data: { content: OPEN, ts: t0 } }, ph(1), sticker(2), ph(3), ph(4)];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas, rules,
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 4);
  assert.ok(batches[0][0].data.content.includes("NHÀ A29"));
  assert.deepEqual((batches[0].batchMeta?.inheritedDestinations || []).map((d) => d.id), ["cg"]);
  assert.equal(batches[0].batchMeta?.inheritedRouteVia, "dia-chi");
});

test("describePost: chùm ảnh thừa kế có đích + lý do, không Chưa xác định", async () => {
  const { Forwarder } = await import("./forwarder.js");
  const { parseConfig } = await import("./config.js");
  const config = parseConfig({
    sourceGroups: ["s"],
    areas: [{ id: "cg", keywords: ["cau giay"], routingKey: "cau-giay" }],
    forward: { sendDelayMs: 0 },
  });
  const fw = new Forwarder({ sendMessage: async () => {} }, config);
  fw._rulesOverride = [];
  const items = [{ data: { content: "", ts: 1, photo: "http://x/y.jpg" } }];
  const d = fw.describePost(
    items,
    [{ id: "cg", keywords: ["cau giay"], routingKey: "cau-giay" }],
    "dia-chi",
    [{ name: "Cầu Giấy", type: "duong" }],
  );
  assert.deepEqual(d.destinationNames, ["cau giay"]);
  assert.equal(d.undetermined, false);
  assert.equal(d.routingReason, "dia-chi");
  assert.deepEqual(d.matchedRules, [{ name: "Cầu Giấy", type: "duong" }]);
});

test("loadRulesCached: file đổi thì đọc lại (rule mới nhận ngay)", async () => {
  const { loadRulesCached } = await import("./features/location-rules/repository.js");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rulcache-"));
  const p = path.join(dir, "rules.json");
  fs.writeFileSync(p, JSON.stringify({ version: 1, rules: [] }));
  assert.equal(loadRulesCached(p).rules.length, 0);
  await new Promise((r) => setTimeout(r, 15));
  fs.writeFileSync(p, JSON.stringify({ version: 1, rules: [{ id: "a", name: "X", normalizedName: "x", type: "duong", routingKeys: ["k"], enabled: true, source: "manual", note: "", updatedAt: 1 }] }));
  assert.equal(loadRulesCached(p).rules.length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("BIZ-004 giữ nguyên: sticker, ảnh, mở, sticker thành 1 cụm mở đầu", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
  const OPEN = "🏠 NHÀ A29 - số 37 ngõ 136/6 Triều Khúc. Phòng 405 gác xép giá 4tr5 đầy đủ nội thất điều hoà nóng lạnh máy giặt chung. Trống 1/10 vào ở luôn P406. Liên hệ 0981234567";
  const msgs = [sticker(0), ph(1), ph(2), { data: { content: OPEN, ts: t0 + 3000 } }, sticker(4)];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 1);
  assert.ok(batches[0][0].data.content.includes("NHÀ A29"));
  assert.equal(batches[0].length, 3);
});

test("ảnh lẻ ngay trước nhãn phòng thì gộp vào phòng (case TC HOME P301)", () => {
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
  const msgs = [ph(0), ph(1), ph(2), ph(3), ph(4), ph(5), ph(6), ph(7),
    { data: { content: "P301: 5tr5", ts: t0 + 109000 } }, ph(110), ph(111)];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 11);
  assert.ok(batches[0].some((m) => m.data.content === "P301: 5tr5"));
});

test("generic có chữ trước nhãn phòng thì không gộp (giữ ngữ cảnh)", () => {
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
  const msgs = [
    { data: { content: "xem phòng này nhé", ts: t0 } }, ph(1),
    { data: { content: "P301: 5tr5", ts: t0 + 2000 } },
  ];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 2);
});

test("quét lịch sử: mã phòng + chùm ảnh gom vào 1 cụm dưới tin mở", () => {
  const batches = segmentMessages(rocketSequence(), {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 1);
  assert.ok(batches[0].length >= 12);
  assert.ok(batches[0][0].data.content.includes("639 Hoàng Hoa Thám"));
});

test("cap nhỏ cũng giữ phòng chờ tin mở (không xả lẻ nữa)", () => {
  const batches = segmentMessages(rocketSequence(), {
    threadId: "t", gapMs: 120000, maxBatchItems: 10, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 1);
});

test("hai tòa khác nhau vẫn tách cụm", () => {
  const msgs = [
    ...rocketSequence(),
    text("🏢Địa chỉ : Số 19 ngách 85 Ngõ 75 Phú Diễn - Bắc Từ Liêm. Phòng studio thang máy đầy đủ nội thất điều hoà nóng lạnh giường tủ. Giá 4tr5. Trống P304, P404 cuối tháng. Liên hệ 0987654321", 500),
  ];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 2);
  assert.ok(batches[1][0].data.content.includes("Phú Diễn"));
});

test("fetchRecentBatches dùng cap lịch sử >= 30 dù config để 10", async () => {
  const seen = [];
  const api = {
    async getGroupChatHistory() {
      return { groupMsgs: rocketSequence().map((m) => ({ ...m, data: { ...m.data } })) };
    },
  };
  const batches = await fetchRecentBatches(api, "t", { fromMs: t0 - 1000, toMs: t0 + 2000 * 1000 }, {
    forward: { historyGapMs: 120000, maxBatchItems: 10, maxWaitMs: 120000 },
    areas: [], defaultArea: null,
  });
  seen.push(batches.length);
  assert.deepEqual(seen, [1]);
});
