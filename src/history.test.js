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
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000,
    areas: [],
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
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000,
    areas: [],
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 6);
});

test("sau sticker không có tin mở thì list phòng không nhập vào cụm trước", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const photo = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/room.jpg" } });
  const opening = "🏠 NHÀ A29 - số 37 ngõ 136/6 Cầu Giấy. Phòng 405 giá 4tr5 đầy đủ nội thất, liên hệ 0981234567";
  const msgs = [
    { data: { content: opening, ts: t0 } },
    sticker(1),
    { data: { content: "P302 - 4tr5", ts: t0 + 2000 } },
    photo(3),
  ];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000,
    areas: [{ id: "cg", keywords: ["cau giay"] }],
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 1);
  assert.ok(batches[0][0].data.content.includes("NHÀ A29"));
  assert.equal(batches[0].some((item) => item.data.msgType === "chat.sticker"), false);
});

test("sticker trước tin mở mới vẫn tách cụm", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const opening = (name) => `${name} - số 12 ngõ 34 Cầu Giấy. Phòng 405 giá 4tr5 đầy đủ nội thất, liên hệ 0981234567`;
  const msgs = [
    { data: { content: opening("NHÀ CŨ"), ts: t0 } },
    sticker(1),
    { data: { content: opening("NHÀ MỚI"), ts: t0 + 2000 } },
  ];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000,
    areas: [{ id: "cg", keywords: ["cau giay"] }],
  });
  assert.equal(batches.length, 2);
});

test("sticker không có tin mở chỉ giữ cụm phòng trước sticker", () => {
  const sticker = { data: { msgType: "chat.sticker", content: "", ts: t0 + 1000 } };
  const photo = { data: { content: "", photo: "http://x/room.jpg", ts: t0 + 3000 } };
  const batches = segmentMessages([
    { data: { content: "P301 - 4tr5", ts: t0 } },
    sticker,
    { data: { content: "P302 - 4tr5", ts: t0 + 2000 } },
    photo,
  ], { threadId: "t", gapMs: 120000, maxBatchItems: 1, maxWaitMs: 120000, areas: [] });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 1);
  assert.equal(batches[0][0].data.content, "P301 - 4tr5");
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
  assert.equal(batches[0].some((item) => item.data.msgType === "chat.sticker"), false);
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

test("album chỉ có ảnh ở run kế tiếp vẫn gộp vào cụm chữ ngay trước", () => {
  const text = { data: { content: "Bài phòng Hà Đông có mô tả đầy đủ", ts: t0 } };
  const photo = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: `http://x/${sec}.jpg` } });
  const batches = segmentMessages([text, photo(121), photo(122)], {
    threadId: "t", gapMs: 10000, maxWaitMs: 10000, maxBatchItems: 20, areas: [],
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 3);
});

test("nhãn phòng một dòng sau run ảnh được nối vào cụm ngay trước", () => {
  const sticker = { data: { msgType: "chat.sticker", content: "https://example.test/separator.webp", ts: t0 + 1000 } };
  const image = { data: { normalUrl: "https://example.test/room.jpg", ts: t0 } };
  const roomLabel = { data: { content: "P101 1n1k 8tr", ts: t0 + 121000 } };
  const batches = segmentMessages([image, sticker, roomLabel], {
    threadId: "t", gapMs: 10000, maxWaitMs: 10000, maxBatchItems: 20, areas: [],
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
  assert.equal(batches[0][1].data.content, "P101 1n1k 8tr");
});

test("album ảnh trước nhãn phòng kế tiếp vẫn thuộc cụm mô tả trước", () => {
  const description = { data: { content: "Địa chỉ Hà Đông, phòng studio đầy đủ nội thất", ts: t0 } };
  const orphanPhoto = { data: { normalUrl: "https://example.test/first-room.jpg", ts: t0 + 121000 } };
  const nextRoom = { data: { content: "P301 1n1k 8tr", ts: t0 + 139000 } };
  const nextPhoto = { data: { normalUrl: "https://example.test/next-room.jpg", ts: t0 + 140000 } };
  const batches = segmentMessages([description, orphanPhoto, nextRoom, nextPhoto], {
    threadId: "t", gapMs: 10000, maxWaitMs: 10000, maxBatchItems: 20, areas: [],
  });
  assert.equal(batches.length, 2);
  assert.equal(batches[0].some((item) => item.data.normalUrl === "https://example.test/first-room.jpg"), true);
  assert.equal(batches[1].some((item) => item.data.normalUrl === "https://example.test/next-room.jpg"), true);
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

test("list phòng giữa hai sticker được chuyển sau tin mở; sticker không được gửi", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
  const OPEN = "🏠 NHÀ A29 - số 37 ngõ 136/6 Triều Khúc. Phòng 405 gác xép giá 4tr5 đầy đủ nội thất điều hoà nóng lạnh máy giặt chung. Trống 1/10 vào ở luôn P406. Liên hệ 0981234567";
  const msgs = [sticker(0), { data: { content: "P301: 5tr5", ts: t0 + 1000 } }, { data: { content: "P302: 5tr8", ts: t0 + 2000 } }, { data: { content: OPEN, ts: t0 + 3000 } }, ph(4), sticker(5)];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 1);
  assert.ok(batches[0][0].data.content.includes("NHÀ A29"));
  assert.equal(batches[0].length, 4);
  assert.equal(batches[0][1].data.content, "P301: 5tr5");
  assert.equal(batches[0].some((item) => item.data.msgType === "chat.sticker"), false);
});

test("list giữa sticker và tin mở mới không bị gộp vào cụm trước", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: `http://x/${sec}.jpg` } });
  const opening = (name) => `🏠 ${name} - số 37 ngõ 136/6 Cầu Giấy. Phòng studio đủ nội thất giá 4tr5, liên hệ 0981234567`;
  const batches = segmentMessages([
    { data: { content: opening("NHÀ CŨ"), ts: t0 } }, ph(1),
    sticker(2),
    { data: { content: "P302: 5tr8", ts: t0 + 3000 } }, ph(4),
    { data: { content: opening("NHÀ MỚI"), ts: t0 + 5000 } }, ph(6),
    sticker(7),
  ], { threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [{ id: "cg", keywords: ["cau giay"] }] });
  assert.equal(batches.length, 2);
  assert.ok(batches[0][0].data.content.includes("NHÀ CŨ"));
  assert.equal(batches[0].some((item) => item.data.content === "P302: 5tr8"), false);
  assert.ok(batches[1][0].data.content.includes("NHÀ MỚI"));
  assert.equal(batches[1][1].data.content, "P302: 5tr8");
  assert.equal(batches[1].some((item) => item.data.msgType === "chat.sticker"), false);
});

test("bỏ thông báo lẻ nhưng giữ list và ảnh trước tin mở trong khoảng sticker", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const opening = "🏠 NHÀ MỚI - số 37 ngõ 136/6 Cầu Giấy. Phòng studio đủ nội thất giá 4tr5, liên hệ 0981234567";
  const batches = segmentMessages([
    sticker(0),
    { data: { content: "Ai cần ib mình nhé", ts: t0 + 1000 } },
    { data: { content: "P501: 8tr", ts: t0 + 2000 } },
    { data: { content: "", photo: "http://x/p501.jpg", ts: t0 + 3000 } },
    { data: { content: opening, ts: t0 + 4000 } },
    sticker(5),
  ], { threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [{ id: "cg", keywords: ["cau giay"] }] });
  assert.equal(batches.length, 1);
  assert.equal(batches[0][0].data.content, opening);
  assert.equal(batches[0].some((item) => item.data.content === "Ai cần ib mình nhé"), false);
  assert.equal(batches[0].some((item) => item.data.content === "P501: 8tr"), true);
  assert.equal(batches[0].some((item) => item.data.photo === "http://x/p501.jpg"), true);
});

test("ảnh trần sau sticker vẫn về cụm cũ trước tin mở mới", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const photo = (id, sec) => ({ data: { content: "", cliMsgId: id, normalUrl: `https://example.test/${id}.jpg`, ts: t0 + sec * 1000 } });
  const opening = (name) => `🏠 ${name} - số 37 ngõ 136/6 Cầu Giấy. Phòng studio đủ nội thất giá 4tr5, liên hệ 0981234567`;
  const batches = segmentMessages([
    sticker(0), { data: { content: opening("NHÀ A"), ts: t0 + 1000 } }, photo("a101", 2),
    sticker(3), photo("a102", 4), { data: { content: opening("NHÀ B"), ts: t0 + 5000 } },
  ], { threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [{ id: "cg", keywords: ["cau giay"] }] });
  assert.equal(batches.length, 2);
  assert.ok(batches[0][0].data.content.includes("NHÀ A"));
  assert.equal(batches[0].some((item) => item.data.cliMsgId === "a102"), true);
  assert.ok(batches[1][0].data.content.includes("NHÀ B"));
});

test("reply vào ảnh cũ gộp list và ảnh sau sticker về cụm gốc", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const photo = (id, sec) => ({ data: { content: "", cliMsgId: id, normalUrl: `https://example.test/${id}.jpg`, ts: t0 + sec * 1000 } });
  const opening = "🏠 NHÀ A - số 37 ngõ 136/6 Cầu Giấy. Phòng studio đủ nội thất giá 4tr5, liên hệ 0981234567";
  const batches = segmentMessages([
    sticker(0), { data: { content: opening, ts: t0 + 1000 } }, photo("a101", 2),
    sticker(3), { data: { content: "TRỤC 01", ts: t0 + 4000 } }, photo("t01", 5),
    { data: { content: "TRỤC 02", ts: t0 + 6000 } }, photo("t02", 7),
    { data: { content: "Ảnh trục này cùng toà", quote: { cliMsgId: "a101" }, ts: t0 + 8000 } },
  ], { threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [{ id: "cg", keywords: ["cau giay"] }] });
  assert.equal(batches.length, 1);
  assert.equal(batches[0][0].data.content, opening);
  assert.equal(batches[0].some((item) => item.data.content === "TRỤC 01"), true);
  assert.equal(batches[0].some((item) => item.data.cliMsgId === "t02"), true);
});

test("reply mô tả ảnh được đặt trước đúng ảnh trong cùng cụm", () => {
  const opening = "🏠 Địa chỉ: 37 ngõ 136 Cầu Giấy. Phòng studio đầy đủ nội thất, giá 4tr5, liên hệ 0981234567.";
  const photo = (id, sec) => ({ data: { content: "", cliMsgId: id, photo: `http://x/${id}.jpg`, ts: t0 + sec * 1000 } });
  const batches = segmentMessages([
    text(opening, 0),
    photo("p101", 1),
    { data: { content: "P101 hướng ban công", quote: { cliMsgId: "p101" }, ts: t0 + 2000, uidFrom: "nguoi-2" } },
    text("Cửa sổ rộng", 3),
    photo("p102", 4),
  ], { threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [{ id: "cg", keywords: ["cau giay"] }] });
  assert.equal(batches.length, 1);
  assert.deepEqual(
    batches[0].map((item) => item.data.content || item.data.cliMsgId),
    [opening, "P101 hướng ban công", "p101", "Cửa sổ rộng", "p102"],
  );
});

test("list và ảnh từ người khác vẫn nối vào tin mở cùng nhóm nguồn", () => {
  const opening = "T210 - 🌹40\nKhai Trương Toà Mới - Ngõ 78 Võ Chí Công, Tây Hồ. Trục phòng đang trống, studio đầy đủ nội thất, điện nước rõ ràng.";
  const batches = segmentMessages([
    { data: { content: opening, ts: t0, uidFrom: "nguoi-1" } },
    { data: { content: "Trục 01", ts: t0 + 1000, uidFrom: "nguoi-2" } },
    { data: { content: "", photo: "http://x/truc-01.jpg", ts: t0 + 2000, uidFrom: "nguoi-2" } },
    { data: { content: "Trục 04", ts: t0 + 3000, uidFrom: "nguoi-2" } },
    { data: { content: "", photo: "http://x/truc-04.jpg", ts: t0 + 4000, uidFrom: "nguoi-2" } },
  ], { threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [{ id: "th", keywords: ["tay ho"] }] });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].batchMeta?.segmentType, "building");
  assert.equal(batches[0].filter((item) => item.data.photo).length, 2);
});

test("tin mở reply vào ảnh được nhận diện từ dòng ghim vị trí, kể cả sau sticker", () => {
  const sticker = (sec) => ({ data: { msgType: "chat.sticker", content: "", ts: t0 + sec * 1000 } });
  const photo = { data: { content: "", cliMsgId: "p601", photo: "http://x/p601.jpg", ts: t0 + 1000 } };
  const opening = "🌹40% HĐ 12T R444\n1N1K Cập Nhật Giảm Giá\n📍Tân Ấp-Ba Đình\n1 ngủ + 1 khách, thang máy, phòng đầy đủ nội thất. P601 có thể xem luôn. Giá 9tr5. Điện nước rõ ràng.";
  const batches = segmentMessages([
    sticker(0), photo,
    { data: { content: opening, quote: { cliMsgId: "p601" }, ts: t0 + 2000, uidFrom: "nguoi-2" } },
    sticker(3),
  ], { threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [{ id: "bd", keywords: ["ba dinh"] }] });
  assert.equal(batches.length, 1);
  assert.equal(batches[0][0].data.content, opening);
  assert.equal(batches[0][1].data.cliMsgId, "p601");
  assert.equal(batches[0].batchMeta?.segmentType, "building");
});

test("tin mở reply vào ảnh không có sticker cũng đưa tin mở lên đầu", () => {
  const photo = { data: { content: "", cliMsgId: "p701", photo: "http://x/p701.jpg", ts: t0 } };
  const opening = "📍Tân Ấp-Ba Đình. Phòng 1 ngủ 1 khách, đầy đủ nội thất, giá 9tr5, điện nước rõ ràng và có thể xem ngay.";
  const batches = segmentMessages([
    photo,
    { data: { content: opening, quote: { cliMsgId: "p701" }, ts: t0 + 1000, uidFrom: "nguoi-2" } },
  ], { threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [{ id: "bd", keywords: ["ba dinh"] }] });
  assert.equal(batches.length, 1);
  assert.equal(batches[0][0].data.content, opening);
  assert.equal(batches[0][1].data.cliMsgId, "p701");
  assert.equal(batches[0].batchMeta?.segmentType, "building");
});

test("ảnh trước tin mở được chuyển sau tin mở, không để tin mở nằm giữa cụm", () => {
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: `http://x/${sec}.jpg` } });
  const opening = "🏠 NHÀ A29 - số 37 ngõ 136/6 Cầu Giấy. Phòng studio đủ nội thất, giá 4tr5, liên hệ 0981234567";
  const batches = segmentMessages([
    ph(0),
    { data: { content: opening, ts: t0 + 1000 } },
    ph(2),
  ], { threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [{ id: "cg", keywords: ["cau giay"] }] });
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

test("nhãn phòng một dòng nối vào cụm trước khi chưa có tin mở", () => {
  const ph = (sec) => ({ data: { content: "", ts: t0 + sec * 1000, photo: "http://x/y.jpg" } });
  const msgs = [
    { data: { content: "xem phòng này nhé", ts: t0 } }, ph(1),
    { data: { content: "P301: 5tr5", ts: t0 + 2000 } },
  ];
  const batches = segmentMessages(msgs, {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].at(-1).data.content, "P301: 5tr5");
});

test("quét lịch sử: mã phòng + chùm ảnh gom vào 1 cụm dưới tin mở", () => {
  const batches = segmentMessages(rocketSequence(), {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000, areas: [],
  });
  assert.equal(batches.length, 1);
  assert.ok(batches[0].length >= 12);
  assert.ok(batches[0][0].data.content.includes("639 Hoàng Hoa Thám"));
});

test("lịch sử nối danh sách phòng và ảnh vào tin mở trước đó khi chỉ ngắt quãng ngắn", () => {
  const opening = "Khai Trương Toà Mới - Ngõ 78 Võ Chí Công, Tây Hồ. Trục 1,2,3 đang trống, phòng studio đầy đủ nội thất, điện nước rõ ràng.";
  const batches = segmentMessages([
    text(opening, 0),
    text("Trục 01\nTrục 04\nP803\nP504,404", 137),
    photo(138),
    photo(139),
  ], {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000,
    areas: [{ id: "th", keywords: ["tay ho"] }],
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0][0].data.content, opening);
  assert.equal(batches[0].filter((item) => item.data.photo).length, 2);
  assert.equal(batches[0].some((item) => item.data.content === "Trục 01\nTrục 04\nP803\nP504,404"), true);
});

test("ảnh sau tin mở vẫn về cụm trước, không bị bài mở xuất hiện muộn chặn lại", () => {
  const firstOpening = "Địa chỉ: 122 Võ Chí Công, Tây Hồ. Studio đầy đủ nội thất, giá 7tr7.";
  const nextOpening = "Địa chỉ: 75 Trịnh Công Sơn, Tây Hồ. Studio mới, giá 6tr.";
  const batches = segmentMessages([
    text(firstOpening, 0),
    photo(135),
    text(nextOpening, 627),
  ], {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000,
    areas: [{ id: "th", keywords: ["tay ho"] }],
  });
  assert.equal(batches.length, 2);
  assert.equal(batches[0][0].data.content, firstOpening);
  assert.equal(batches[0].filter((item) => item.data.photo).length, 1);
  assert.equal(batches[1][0].data.content, nextOpening);
});

test("list phòng có ảnh nối sau tối đa mười phút khi chưa có tin mở mới", () => {
  const opening = "Khai trương nhà mới. Địa chỉ: 123 Thụy Khuê, Tây Hồ. Giá theo bảng giá bên dưới, studio đầy đủ nội thất.";
  const batches = segmentMessages([
    text(opening, 0),
    text("Trục 01\nTrục 02", 383),
    photo(384),
  ], {
    threadId: "t", gapMs: 120000, maxBatchItems: 30, maxWaitMs: 120000,
    areas: [{ id: "th", keywords: ["tay ho"] }],
  });
  assert.equal(batches.length, 1);
  assert.equal(batches[0][0].data.content, opening);
  assert.equal(batches[0].some((item) => item.data.content === "Trục 01\nTrục 02"), true);
  assert.equal(batches[0].filter((item) => item.data.photo).length, 1);
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
