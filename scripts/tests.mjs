import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanText, isExcluded, normalizeText } from "../src/processor.js";
import { classifyArea, classifyAreas, detectHanoiDistrict, findAreaMatch } from "../src/classifier.js";
import { parseDateInput, resolveRange, startOfDay, endOfDay, fmtDate, fetchRecentBatches, fetchRecentMessages, segmentMessages } from "../src/history.js";
import { createCommunityParams, createCommunityRequest } from "../src/community.js";
import { parseConfig } from "../src/config.js";
import { Forwarder, mapWithConcurrency } from "../src/forwarder.js";
import { imageDimensions } from "../src/image-metadata.js";
import { fetchWithTimeout } from "../src/session.js";
import { isRepeatedPhotoOnlyCluster, startBot } from "../src/listener.js";
import { ClosingStickerStore, extractStickerId } from "../src/closing-sticker.js";
import { photoUrls } from "../src/media.js";
import { buildingKeyFromText as buildingKeyFromTextStatic, buildingNoticeMatchesText, parseFullBuildingNotice as parseFullBuildingNoticeStatic } from "../src/full-building.js";

/* ---------------- mini test framework ---------------- */
let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) pass++;
  else {
    fail++;
    failures.push({ name, detail });
  }
}

function assertEq(name, actual, expected) {
  check(name, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

/* ---------------- mocks ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pngHeader = Buffer.alloc(24);
pngHeader.write("\x89PNG\r\n\x1a\n", 0, "binary");
pngHeader.writeUInt32BE(640, 16);
pngHeader.writeUInt32BE(480, 20);
assertEq("đọc kích thước PNG để gửi Zalo", imageDimensions(pngHeader)?.width, 640);
assertEq("đọc chiều cao PNG để gửi Zalo", imageDimensions(pngHeader)?.height, 480);
assertEq("file ảnh không hợp lệ không có metadata", imageDimensions(Buffer.from("not-an-image")), null);
assertEq("cấu hình mới mặc định xoá dòng phần trăm", parseConfig({}).filter.removePercentLines, true);
let activeDownloads = 0;
let peakDownloads = 0;
const parallelResults = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
  activeDownloads++;
  peakDownloads = Math.max(peakDownloads, activeDownloads);
  await sleep(5);
  activeDownloads--;
  return value * 10;
});
assertEq("tải ảnh song song vẫn giữ thứ tự", parallelResults.join(","), "10,20,30,40");
assertEq("tải ảnh song song không vượt giới hạn", peakDownloads, 2);
let requestTimedOut = false;
try {
  await fetchWithTimeout("https://example.test/slow", {}, async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }), 5);
} catch {
  requestTimedOut = true;
}
assertEq("kết nối Zalo treo được dừng sớm", requestTimedOut, true);

function makeApi({ history = {}, groupLink = null, sendOk = true } = {}) {
  const msgHandlers = [];
  const sentMessages = [];
  return {
    _handlers: msgHandlers,
    _sent: sentMessages,
    listener: {
      on: (ev, fn) => msgHandlers.push([ev, fn]),
      start: async () => {},
      stop: async () => {},
      removeAllListeners: () => {},
    },
    getGroupInfo: async (id) => ({ gridInfoMap: { [id]: { groupId: id, name: `Nhom ${id}` } } }),
    getGroupLinkInfo: async ({ link }) =>
      groupLink && link === groupLink ? { groupId: "g001", name: "Nhom Link 1" } : null,
    getAllGroups: async () => ({ gridVerMap: { g001: "v1", g002: "v2" } }),
    getGroupChatHistory: async (id, count) => ({ groupMsgs: history[id] || [] }),
    sendMessage: async (msg, tid, type) => {
      if (!sendOk) throw new Error("send fail");
      sentMessages.push({ msg, tid, type });
      return { msg, tid, type };
    },
    sendSticker: async (sticker, tid, type) => {
      sentMessages.push({ sticker, tid, type });
      return { msgId: 1 };
    },
    getStickersDetail: async (id) => [{ id: Number(id), cateId: 7, type: 1 }],
  };
}

/* ---------------- sticker kết thúc cụm ---------------- */
assertEq("đọc sticker id từ tin nhắn Zalo", extractStickerId({ msgType: "chat.sticker", content: { stickerId: 123 } }), 123);
assertEq("không nhận ảnh thường là sticker", extractStickerId({ msgType: "chat.photo", content: { id: 123 } }), null);
assertEq("sticker nguồn không bị coi là ảnh để forward", photoUrls({ data: { msgType: "chat.sticker", content: { stickerUrl: "https://example.test/sticker.webp" } } }).length, 0);
const closingStickerTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zalosale-sticker-test-"));
const closingStickerPath = path.join(closingStickerTempDir, "closing-sticker.json");
const closingStickerStore = new ClosingStickerStore(closingStickerPath);
closingStickerStore.save({ id: 123, cateId: 7, type: 1 });
assertEq("sticker kết thúc được lưu bền vững", new ClosingStickerStore(closingStickerPath).get()?.id, 123);
closingStickerStore.clear();
assertEq("có thể tắt sticker kết thúc", closingStickerStore.get(), null);
fs.rmSync(closingStickerTempDir, { recursive: true, force: true });

const footerApi = makeApi();
const footerStore = { get: () => ({ id: 123, cateId: 7, type: 1 }) };
const footerForwarder = new Forwarder(
  footerApi,
  parseConfig({ sourceGroups: ["source"], areas: [{ id: "dest", matchAll: true }], forward: { sendDelayMs: 0, retries: 0 } }),
  () => {},
  async () => {},
  async () => false,
  footerStore,
);
await footerForwarder.forwardPayload({ threadId: "source", source: "test", items: [{ data: { content: "Tin phòng hợp lệ" } }] });
assertEq("sticker tự chọn gửi sau nội dung cụm", footerApi._sent.map((entry) => entry.sticker ? "sticker" : "text").join(","), "text,sticker");
const multiUnitFooterApi = makeApi();
const multiUnitFooterForwarder = new Forwarder(
  multiUnitFooterApi,
  parseConfig({ sourceGroups: ["source"], areas: [{ id: "dest", matchAll: true }], forward: { sendDelayMs: 0, retries: 0 } }),
  () => {},
  async () => {},
  async () => false,
  footerStore,
);
await multiUnitFooterForwarder.forwardPayload({
  threadId: "source",
  source: "test",
  items: [{ data: { content: "Tin mở cụm" } }, { data: { content: "Thông tin phòng" } }],
});
assertEq("sticker luôn đứng sau delivery unit cuối của cụm", multiUnitFooterApi._sent.map((entry) => entry.sticker ? "sticker" : "text").join(","), "text,text,sticker");
const failedFooterApi = makeApi();
failedFooterApi.sendSticker = async () => { throw new Error("sticker unavailable"); };
const failedFooterForwarder = new Forwarder(
  failedFooterApi,
  parseConfig({ sourceGroups: ["source"], areas: [{ id: "dest", matchAll: true }], forward: { sendDelayMs: 0, retries: 0 } }),
  () => {},
  async () => {},
  async () => false,
  footerStore,
);
const failedFooterResult = await failedFooterForwarder.forwardPayload({ threadId: "source", source: "test", items: [{ data: { content: "Cụm vẫn thành công" } }] });
assertEq("sticker lỗi không làm gửi lại nội dung cụm", failedFooterResult.sent, true);

let savedFromDm = null;
const dmStickerStore = {
  get: () => savedFromDm,
  save: (sticker) => (savedFromDm = sticker),
  clear: () => { savedFromDm = null; },
};
const dmStickerApi = makeApi();
const dmStickerBot = startBot({
  api: dmStickerApi,
  config: { sourceGroups: [], areas: [], forward: {}, defaultArea: null },
  batcher: null,
  forwarder: { config: {}, statusInfo: () => [] },
  status: { startedAt: new Date(), forwarded: 0, mode: "manual", knownSources: [] },
  closingStickerStore: dmStickerStore,
});
const dmMessageHandler = dmStickerApi._handlers.find(([event]) => event === "message")[1];
await dmMessageHandler({ isSelf: false, type: 0, threadId: "operator", data: { content: "/setsticker" } });
await dmMessageHandler({ isSelf: false, type: 0, threadId: "operator", data: { msgType: "chat.sticker", content: { stickerId: 456 } } });
assertEq("DM /setsticker lưu sticker gửi ngay sau đó", savedFromDm?.id, 456);
assertEq("bot xác nhận đã lưu sticker qua DM", String(dmStickerApi._sent.at(-1)?.msg?.msg).includes("Đã lưu sticker ID 456"), true);
await dmMessageHandler({ isSelf: false, type: 0, threadId: "operator", data: { content: "/sticker off" } });
assertEq("DM /sticker off xoá sticker đã lưu", savedFromDm, null);
dmStickerBot.stop();

/* ---------------- listener: quét metadata nhóm có giới hạn song song ---------------- */
const groupMetadataTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zalosale-groups-test-"));
const groupMetadataCachePath = path.join(groupMetadataTempDir, "groups-cache.json");
const groupMetadataIds = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`group-${index}`, "v1"]));
let activeGroupMetadataRequests = 0;
let peakGroupMetadataRequests = 0;
const groupMetadataApi = makeApi();
groupMetadataApi.getAllGroups = async () => ({ gridVerMap: groupMetadataIds });
groupMetadataApi.getGroupInfo = async (ids) => {
  activeGroupMetadataRequests++;
  peakGroupMetadataRequests = Math.max(peakGroupMetadataRequests, activeGroupMetadataRequests);
  await sleep(12);
  activeGroupMetadataRequests--;
  const batch = Array.isArray(ids) ? ids : [ids];
  return {
    gridInfoMap: Object.fromEntries(batch.map((id) => [id, { groupId: id, name: `Nhóm ${id}` }])),
  };
};
const groupMetadataBot = startBot({
  api: groupMetadataApi,
  config: { sourceGroups: [], areas: [], forward: {}, defaultArea: null },
  batcher: null,
  forwarder: { config: {}, statusInfo: () => [] },
  status: { startedAt: new Date(), forwarded: 0, mode: "manual", knownSources: [] },
  groupsCachePath: groupMetadataCachePath,
});
const groupMetadata = await groupMetadataBot.listGroups(true);
assertEq("quét metadata lấy đủ nhóm", groupMetadata.length, 30);
assertEq("quét metadata giữ thứ tự danh sách nhóm", groupMetadata.map((group) => group.id).join(","), Object.keys(groupMetadataIds).join(","));
assertEq("quét metadata chỉ dùng tối đa 5 lô song song", peakGroupMetadataRequests <= 5, true);
assertEq("quét metadata thực sự chạy nhiều lô cùng lúc", peakGroupMetadataRequests > 1, true);
groupMetadataBot.stop();
fs.rmSync(groupMetadataTempDir, { recursive: true, force: true });

const CFG = {
  sourceGroups: [],
  areas: [
    { keywords: ["ha dong", "nguyen trai", "van quan"], groupLink: "https://zalo.me/g/hadong" },
    { keywords: ["ba dinh", "phan dinh phung"], groupLink: "https://zalo.me/g/badinh" },
  ],
  deleteLines: ["🌹", "hoa hồng"],
  excludeKeywords: ["tìm phòng", "hết phòng"],
  filter: { removePercentLines: true, removePriceLines: true },
  defaultArea: null,
  forward: {
    windowMs: 3000,
    maxBatchItems: 10,
    maxWaitMs: 30000,
    sendDelayMs: 1,
    retries: 0,
    historyGapMs: 10000,
  },
};

/* ---------------- 1. processor.js ---------------- */
console.log("\n=== processor: normalizeText ===");
const normCases = [
  ["HOA HỒNG", "hoa hong"],
  ["Đẹp Đẽ", "dep de"],
  ["Hà Đông", "ha dong"],
  ["  Phòng Trọ  ", "phong tro"],
  ["🌹( 12t ) : 30%", "🌹( 12t ) : 30%"],
  ["Nguyễn Trãi", "nguyen trai"],
  ["PHAN ĐÌNH PHÙNG", "phan dinh phung"],
  ["hoa  hồng", "hoa hong"],
];
for (const [input, want] of normCases) assertEq(`norm: ${input}`, normalizeText(input), want);

console.log("\n=== processor: cleanText ===");
assertEq("xoá dòng 🌹", cleanText("Phòng 12m2\n🌹( 12t ) : 30%\nGiá 3tr", { deleteLines: ["🌹"] }), "Phòng 12m2\nGiá 3tr");
assertEq("xoá nhiều chữ", cleanText("a\nhoa hồng\nb\nHoa Hồng 20%", { deleteLines: ["hoa hồng"] }), "a\nb");
assertEq("xoá %", cleanText("a\n30%\nb", { removePercentLines: true }), "a\nb");
assertEq("xoá nguyên dòng có %", cleanText("a\n🌹( 12t ) : 30%b\nb", { removePercentLines: true }), "a\nb");
assertEq("xoá dòng % dù có mã tòa", cleanText("/-rose 12th 40% Mã TT110\nĐịa chỉ: Cầu Giấy", { removePercentLines: true }), "Địa chỉ: Cầu Giấy");
assertEq("xoá các dòng % riêng", cleanText("🌹 12th : 40%\n6th : 30%\nMã: TR426", { removePercentLines: true }), "Mã: TR426");
assertEq("không xoá % khi tắt", cleanText("a\n30%\nb", { removePercentLines: false }), "a\n30%\nb");
assertEq("xoá dòng giá", cleanText("a\n💰Giá: 4tr4\nb", { removePriceLines: true }), "a\nb");
assertEq("không xoá giá khi tắt", cleanText("a\nGiá 4tr\nb", { removePriceLines: false }), "a\nGiá 4tr\nb");
assertEq("xoá dòng chứa nhiều ký tự", cleanText("line1\ncó 🌹 đây\nline3", { deleteLines: ["🌹"] }), "line1\nline3");
assertEq("không đụng dòng khác", cleanText("a\nhoa hồng 12t\nb", { deleteLines: ["🌹"] }), "a\nhoa hồng 12t\nb");
assertEq("trim đầu cuối", cleanText("  a  \n  b  ", {}), "a  \n  b");
assertEq("rỗng khi toàn bộ bị xoá", cleanText("🌹\n🌹", { deleteLines: ["🌹"] }), "");
assertEq("dòng có % liền chữ cũng bị xoá", cleanText("x\nhoa 30%hồng\ny", { removePercentLines: true }), "x\ny");

console.log("\n=== processor: isExcluded ===");
assertEq("exclude khớp", isExcluded("Tìm phòng giá rẻ", ["tìm phòng"]), true);
assertEq("exclude khớp hoa thường", isExcluded("TÌM PHÒNG", ["tìm phòng"]), true);
assertEq("exclude không khớp", isExcluded("Cho thuê phòng", ["tìm phòng"]), false);
assertEq("exclude nhiều từ", isExcluded("hết phòng", ["tìm phòng", "hết phòng"]), true);
assertEq("exclude rỗng list", isExcluded("bất cứ", []), false);

/* ---------------- 2. classifier.js ---------------- */
console.log("\n=== classifier: classifyArea ===");
const areas = CFG.areas;
const c1 = classifyArea("Địa chỉ: Hà Đông", areas);
assertEq("nhận Hà Đông", c1?.keywords?.[0], "ha dong");
const c2 = classifyArea("Địa chỉ: HÀ ĐÔNG", areas);
assertEq("HOA HÀ ĐÔNG", c2?.keywords?.[0], "ha dong");
const c3 = classifyArea("Địa chỉ: Phan Đình Phùng", areas);
assertEq("nhận Ba Đình", c3?.keywords?.[0], "ba dinh");
const c4 = classifyArea("không có khu vực nào", areas);
assertEq("không khớp → null", c4, null);
const c5 = classifyArea("Địa chỉ: Hà Đông, Ba Đình", areas);
assertEq("khớp mạnh nhất = từ khoá dài hơn", c5?.keywords?.[0], c5?.keywords?.[0]);
const cauGiayArea = { keywords: ["cau giay"] };
assertEq("từ khóa không dấu khớp tên quận có dấu", classifyArea("Địa chỉ: Cầu Giấy", [cauGiayArea])?.keywords?.[0], "cau giay");
assertEq("phường Dịch Vọng nhận Cầu Giấy", classifyArea("Địa chỉ: Hoa Bằng, Dịch Vọng", [cauGiayArea])?.keywords?.[0], "cau giay");
assertEq("phường Yên Hòa nhận Cầu Giấy", classifyArea("Địa chỉ: Ngõ Trung Kính, Yên Hòa", [cauGiayArea])?.keywords?.[0], "cau giay");
assertEq("khu vực hiển thị là phường đã khớp", findAreaMatch("Địa chỉ: Dịch Vọng Hậu", cauGiayArea)?.keyword, "Dịch Vọng Hậu");
assertEq("phường La Khê nhận Hà Đông", classifyArea("Địa chỉ: La Khê, Hà Nội", [{ keywords: ["ha dong"] }])?.keywords?.[0], "ha dong");
assertEq("phường Hàng Bạc nhận Hoàn Kiếm", classifyArea("Địa chỉ: Hàng Bạc", [{ keywords: ["hoan kiem"] }])?.keywords?.[0], "hoan kiem");
assertEq("nhận diện Hoàng Mai dù chưa có nhóm đích", detectHanoiDistrict("Địa chỉ: Đại Từ, Hoàng Mai")?.district, "Hoàng Mai");
assertEq("nhận diện phường Cầu Giấy dù chưa có nhóm đích", detectHanoiDistrict("Địa chỉ: Dịch Vọng Hậu")?.district, "Cầu Giấy");
assertEq("luôn trả 1 khu vực", typeof c5?.keywords?.[0], "string");
const c6 = classifyArea("hà đông", [], "ha dong");
assertEq("defaultArea nhưng rỗng areas → null", c6, null);
const c7 = classifyArea("phòng đẹp", areas, "ba dinh");
assertEq("không có địa chỉ thì không dùng defaultArea", c7, null);
assertEq("từ khoá ngắn 1 ký tự bỏ qua", classifyArea("a", [{ keywords: ["a"] }]), null);
assertEq("khoá không dấu vẫn khớp text có dấu", classifyArea("Địa chỉ: HÀ ĐÔNG", areas)?.keywords?.[0], "ha dong");
assertEq("text rỗng", classifyArea("", areas), null);
assertEq("areas rỗng", classifyArea("ha dong", []), null);

const pricedAreas = [
  { keywords: ["ha dong"], id: "ha-dong" },
  { keywords: ["ha dong"], id: "ha-dong-under-4", priceCondition: { operator: "<", value: 4 } },
];
assertEq("Hà Đông 3tr khớp cả nhóm chung và <4", classifyAreas("Địa chỉ: Hà Đông\nGiá 3tr", pricedAreas).length, 2);
assertEq("Hà Đông 5tr chỉ khớp nhóm chung", classifyAreas("Địa chỉ: Hà Đông\nGiá 5tr", pricedAreas).map((area) => area.id).join(","), "ha-dong");
assertEq("bài thiếu giá không vào nhóm có điều kiện", classifyAreas("Địa chỉ: Hà Đông", pricedAreas).map((area) => area.id).join(","), "ha-dong");

/* ---------------- 3. history.js ---------------- */
console.log("\n=== history: parseDateInput ===");
const todayOnly = resolveRange({ days: 1 });
assertEq("days=1 bắt đầu từ hôm nay", todayOnly.fromMs, startOfDay(new Date()));
const d1 = parseDateInput("15/08/2026");
assertEq("dd/MM/yyyy", d1?.getDate() === 15 && d1?.getMonth() === 7 && d1?.getFullYear() === 2026, true);
const d2 = parseDateInput("15/08");
assertEq("dd/MM năm hiện tại", d2?.getDate() === 15 && d2?.getMonth() === 7, true);
const d3 = parseDateInput("2026-08-15");
assertEq("yyyy-MM-dd", d3?.getDate() === 15, true);
assertEq("chuỗi rác → null", parseDateInput("abc"), null);
assertEq("ngày sai → null", parseDateInput("31/02/2026"), null);

console.log("\n=== history: resolveRange ===");
const r1 = resolveRange({ days: 3 });
assertEq("days=3 label", r1.label.includes("3 ngày"), true);
assertEq("days=3 không lỗi", !r1.error, true);
assertEq("days=0 lỗi", !!resolveRange({ days: 0 }).error, true);
assertEq("days=61 lỗi", !!resolveRange({ days: 61 }).error, true);
const r2 = resolveRange({ from: "15/08/2026", to: "20/08/2026" });
assertEq("from/to hợp lệ", !r2.error, true);
assertEq("from/to label", r2.label.includes("6 ngày"), true);
assertEq("from > to lỗi", !!resolveRange({ from: "20/08/2026", to: "15/08/2026" }).error, true);
assertEq("from sai lỗi", !!resolveRange({ from: "abc" }).error, true);
assertEq("khoảng 61 ngày lỗi", !!resolveRange({ from: "01/01/2026", to: "10/03/2026" }).error, true);
const r3 = resolveRange({});
assertEq("không tham số = hôm nay", r3.fromMs <= r3.toMs, true);
assertEq("không tham số label có hôm nay", r3.label.includes("hôm nay") || r3.label.includes("1 ngày"), true);

console.log("\n=== history: fetchRecentBatches ===");
const now = Date.now();
const msgs = [];
for (let i = 0; i < 5; i++) {
  msgs.push({ data: { ts: now - (5 - i) * 500, content: i === 2 ? "Địa chỉ: Hà Đông\nPhòng 1tr" : `tin ${i}` } });
}
// cách 500ms < gap 10000 → 1 bài
const api = makeApi({ history: { g001: msgs } });
const batches = await fetchRecentBatches(api, "g001", { fromMs: now - 86400000, toMs: now + 1000 }, CFG);
assertEq("tin giá ngắn mở lượt riêng trong chuỗi lịch sử", batches.length, 2);
// cách nhau > gap → tách
const msgs2 = msgs.map((m, i) => ({ data: { ts: now - (5 - i) * 30000, content: m.data.content } }));
const batches2 = await fetchRecentBatches(makeApi({ history: { g001: msgs2 } }), "g001", { fromMs: now - 86400000, toMs: now + 1000 }, CFG);
assertEq("cách 30s = 5 bài", batches2.length, 5);
// lọc ngoài khoảng
const batches3 = await fetchRecentBatches(makeApi({ history: { g001: msgs } }), "g001", { fromMs: now - 1000, toMs: now + 1000 }, CFG);
assertEq("khoảng hẹp chỉ 1 tin", batches3.length, 1);
// maxBatchItems giới hạn
const batches4 = await fetchRecentBatches(api, "g001", { fromMs: now - 86400000, toMs: now + 1000 }, { ...CFG, forward: { ...CFG.forward, maxBatchItems: 2 } });
assertEq("cap lich su toi thieu 30 de giu cum phong", batches4.length, 2);
const manyMsgs = Array.from({ length: 35 }, (_, i) => ({ data: { ts: now - (35 - i) * 500, content: "tin " + i } }));
const batches5 = await fetchRecentBatches(makeApi({ history: { g001: manyMsgs } }), "g001", { fromMs: now - 86400000, toMs: now + 1000 }, CFG);
assertEq("vuot floor 30 van tach chuoi dai", batches5.length, 2);

const unorderedHistory = await fetchRecentMessages(
  makeApi({ history: { unordered: [
    { data: { ts: now - 1000, content: "tin cuối" } },
    { data: { ts: now - 3000, content: "tin mở cụm" } },
    { data: { ts: now - 2000, content: "tin giữa" } },
  ] } }),
  "unordered",
  { fromMs: now - 10000, toMs: now + 1000, gapMs: 10000, maxWaitMs: 10000 },
);
assertEq(
  "lịch sử luôn sắp theo timestamp tăng dần trước khi gom",
  unorderedHistory.flat().map((item) => item.data.content).join(","),
  "tin mở cụm,tin giữa,tin cuối",
);

const historicalBuilding = segmentMessages([
  { data: { ts: now - 5000, content: "Địa chỉ Mỹ Đình. Dịch vụ và nội thất đầy đủ." } },
  { data: { ts: now - 4000, content: "TRỤC 01, 02" } },
  { data: { ts: now - 3000, normalUrl: "https://example.test/truc-01.jpg" } },
  { data: { ts: now - 2000, content: "TRỤC 03" } },
  { data: { ts: now - 1000, normalUrl: "https://example.test/truc-03.jpg" } },
], {
  threadId: "history-source",
  gapMs: 120000,
  maxWaitMs: 120000,
  maxBatchItems: 20,
  areas: [{ keywords: ["my dinh"], id: "dest-my-dinh" }],
});
assertEq("lịch sử giữ toàn bộ tin cùng tòa trong một cụm", historicalBuilding.length, 1);
assertEq("lịch sử giữ metadata nhóm đích của tòa", historicalBuilding[0]?.batchMeta?.inheritedDestinations?.[0]?.id, "dest-my-dinh");
assertEq("lịch sử giữ ảnh xen kẽ đúng thứ tự", historicalBuilding[0]?.map((item) => item.data.content || item.data.normalUrl || item.normalUrl).join(","), "Địa chỉ Mỹ Đình. Dịch vụ và nội thất đầy đủ.,TRỤC 01, 02,https://example.test/truc-01.jpg,TRỤC 03,https://example.test/truc-03.jpg");

console.log("\n=== community: request + fallback ===");
const communityRequest = createCommunityRequest("encrypted-params");
assertEq("Community dùng GET", communityRequest.options.method, "GET");
assertEq("Community gửi params trên query", communityRequest.query.params, "encrypted-params");
assertEq("Community tắt retry tự động", communityRequest.query.nretry, 0);
const communityParams = createCommunityParams("g123", 120, 456, "test-imei");
assertEq("Community bỏ prefix g", communityParams.groupId, "123");
assertEq("Community phân trang tối đa 50 tin", communityParams.count, 50);
assertEq("Community gửi cursor", communityParams.globalMsgId, 456);
assertEq("Community gửi src web", communityParams.src, 3);
assertEq("Community gửi imei", communityParams.imei, "test-imei");

const localBatch = [[{ data: { ts: now, content: "Tin Community local" } }]];
const fallbackBatches = await fetchRecentMessages(
  { getGroupChatHistory: async () => { throw new Error("HTTP 404"); } },
  "community-001",
  {
    fromMs: now - 86400000,
    toMs: now + 1000,
    communityFetch: async () => { throw new Error("Invalid context response"); },
    storeQuery: () => localBatch,
  }
);
assertEq("Community lỗi bất kỳ → fallback store", fallbackBatches.length, 1);
await (async () => {
  let rejected = false;
  try {
    await fetchRecentMessages(
      { getGroupChatHistory: async () => { throw new Error("HTTP 404"); } },
      "community-empty",
      {
        fromMs: now - 86400000,
        toMs: now + 1000,
        communityFetch: async () => { throw new Error("Community adapter unavailable"); },
        storeQuery: () => [],
      },
    );
  } catch {
    rejected = true;
  }
  assertEq("Community lỗi + store rỗng phải báo lỗi", rejected, true);
})();

/* ---------------- 4. forwarder.js: describePost ---------------- */
console.log("\n=== forwarder: describePost ===");
const FORWARD_CFG = { ...CFG, areas: CFG.areas.map((area, index) => ({ ...area, id: `dest-${index + 1}` })) };
const forwarderApi = makeApi();
const fw = new Forwarder(forwarderApi, FORWARD_CFG, () => {});

// Rate limit phải áp dụng cho từng lệnh gửi, kể cả nhiều nhóm đích trong cùng một bài.
const rateLimitApi = makeApi();
const rateLimitSentAt = [];
rateLimitApi.sendMessage = async (msg, tid, type) => {
  rateLimitSentAt.push(Date.now());
  rateLimitApi._sent.push({ msg, tid, type });
};
const rateLimitForwarder = new Forwarder(rateLimitApi, {
  ...FORWARD_CFG,
  areas: [
    { id: "rate-1", keywords: ["ha dong"] },
    { id: "rate-2", keywords: ["ha dong"] },
    { id: "rate-3", keywords: ["ha dong"] },
  ],
  forward: { ...FORWARD_CFG.forward, sendDelayMs: 15, retries: 0 },
}, () => {});
const rateLimitResult = await rateLimitForwarder.enqueue({
  threadId: "rate-source",
  items: [{ data: { content: "Địa chỉ: Hà Đông\nPhòng đẹp" } }],
  source: "manual",
});
assertEq("rate limit vẫn gửi đủ nhiều nhóm đích", rateLimitResult.destinations, 3);
assertEq(
  "rate limit cách đều từng lệnh gửi trong một cụm",
  rateLimitSentAt.slice(1).every((sentAt, index) => sentAt - rateLimitSentAt[index] >= 12),
  true,
);

const delayedApi = makeApi();
const delayedSentAt = [];
delayedApi.sendMessage = async (msg, tid, type) => {
  delayedSentAt.push(Date.now());
  delayedApi._sent.push({ msg, tid, type });
};
const delayedForwarder = new Forwarder(delayedApi, { ...FORWARD_CFG, forward: { ...FORWARD_CFG.forward, sendDelayMs: 0 } }, () => {});
const delayedStart = Date.now();
const delayedResult = await delayedForwarder.enqueue({
  threadId: "auto-source",
  items: [{ data: { content: "Địa chỉ: Hà Đông\nPhòng đẹp" } }],
  source: "live",
  notBefore: delayedStart + 25,
  beforeSend: async () => true,
});
assertEq("auto giữ bài đến mốc notBefore", delayedSentAt[0] - delayedStart >= 20, true);
assertEq("auto sau thời gian chờ vẫn gửi được", delayedResult.destinations, 1);
const cancelledResult = await delayedForwarder.enqueue({
  threadId: "auto-source",
  items: [{ data: { content: "Địa chỉ: Hà Đông\nPhòng khác" } }],
  source: "live",
  notBefore: Date.now() + 5,
  beforeSend: async () => false,
});
assertEq("auto bỏ qua bài đã bị gỡ trước khi gửi", cancelledResult.skipped, true);

const d1p = fw.describePost([{ data: { content: "Địa chỉ: Hà Đông\nPhòng trọ" } }]);
assertEq("nhận Hà Đông", d1p.areaName, "ha dong");
assertEq("clean giữ text", d1p.clean.includes("Hà Đông"), true);
assertEq("không ảnh", d1p.photoCount, 0);
const d2p = fw.describePost([
  { data: { content: "Cho thuê phòng\n🌹( 12t ) : 30%\n💰Giá 3tr" } },
]);
assertEq("xoá dòng 🌹 và giá", d2p.clean, "Cho thuê phòng");
const d3p = fw.describePost([{ data: { content: "Tìm phòng gấp" } }]);
assertEq("excluded = true", d3p.excluded, true);
const d4p = fw.describePost([{ data: { content: "abc không khu vực" } }]);
assertEq("không nhận định → areaName null", d4p.areaName, null);
const d5p = fw.describePost([{ data: { content: "Ảnh đây" } }, { data: { content: "Địa chỉ: ha dong" } }]);
assertEq("text + text", d5p.clean.includes("ha dong"), true);
const d6p = fw.describePost([{ data: { content: "x" } }, { data: { originUrl: "https://x/a.jpg" } }]);
assertEq("1 ảnh", d6p.photoCount, 1);
const d7p = fw.describePost([{ data: { content: "{\"originUrl\":\"https://x/b.jpg\"}" } }]);
assertEq("ảnh dạng JSON content", d7p.photoCount, 1);
const d7Community = fw.describePost([{
  data: {
    msgType: "chat.photo",
    content: { href: "https://x/community.jpg", thumb: "https://x/community-thumb.jpg" },
  },
}]);
assertEq("ảnh Community dạng object content", d7Community.photoCount, 1);
assertEq("preview Community ưu tiên ảnh gốc", d7Community.photoUrls[0], "https://x/community.jpg");
const d8p = fw.describePost([{ data: { content: "a" } }, { data: { content: "b" } }]);
assertEq("text 2 tin nối \n\n", d8p.clean, "a\n\nb");
const fullDescription = fw.describePost([{ data: { content: "1B5 Đầm Trấu full toà" } }]);
assertEq("mô tả nhận diện đúng thông báo full tòa", fullDescription.isFullBuilding, true);
assertEq("mô tả giữ tên tòa full", fullDescription.fullBuilding, "1B5 Đầm Trấu");
const fullForwardApi = makeApi();
const fullForwarder = new Forwarder(fullForwardApi, FORWARD_CFG, () => {});
const fullNoticeOutcome = await fullForwarder.forwardPayload({ threadId: "source-full", source: "live", items: [{ data: { content: "1B5 Đầm Trấu full toà" } }] });
assertEq("thông báo full tòa không bị forward", fullNoticeOutcome.reason, "building-full");
const fullRoomOutcome = await fullForwarder.forwardPayload({
  threadId: "source-full",
  source: "live",
  buildingKey: "1b5",
  items: [{ data: { content: "1B5 Đầm Trấu — Địa chỉ: Cầu Giấy, nội thất đầy đủ\nGiá 5tr" } }],
});
assertEq("bài thuộc tòa đã full không bị forward", fullRoomOutcome.reason, "building-full");
assertEq("tòa full không gọi API gửi", fullForwardApi._sent.length, 0);

const duplicateAddressNotice = parseFullBuildingNoticeStatic("1B5 Đầm Trấu full tòa");
assertEq("full tòa giữ mã nhận diện", duplicateAddressNotice.code, "1b5");
assertEq("cùng mã và cùng tên được xem là một tòa", buildingNoticeMatchesText("1B5 Đầm Trấu — phòng 201", duplicateAddressNotice, { requireName: true }), true);
assertEq("trùng mã nhưng khác tên không bị loại nhầm", buildingNoticeMatchesText("1B5 Kim Giang — phòng 201", duplicateAddressNotice, { requireName: true }), false);
assertEq("tòa không có mã vẫn lấy tên trước dấu phân cách", buildingKeyFromTextStatic("STUDIO Đầm Trấu - Cầu Giấy"), "dam trau");
const duplicateForwardApi = makeApi();
const duplicateForwarder = new Forwarder(duplicateForwardApi, {
  ...FORWARD_CFG,
  areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }],
}, () => {});
await duplicateForwarder.forwardPayload({ threadId: "source-duplicate", items: [{ data: { content: "1B5 Đầm Trấu full tòa" } }] });
const duplicateDifferentBuilding = await duplicateForwarder.forwardPayload({
  threadId: "source-duplicate",
  source: "manual",
  buildingKey: "1b5",
  items: [{ data: { content: "1B5 Kim Giang — Địa chỉ: Cầu Giấy, nội thất đầy đủ\nGiá 5tr" } }],
});
assertEq("trùng mã nhưng khác tên vẫn được gửi", duplicateDifferentBuilding.reason, undefined);
assertEq("tòa trùng mã khác tên thực sự gọi API", duplicateForwardApi._sent.length, 1);

const multiDestinationApi = makeApi();
const multiDestinationForwarder = new Forwarder(multiDestinationApi, {
  ...FORWARD_CFG,
  areas: [
    { keywords: ["ha dong"], id: "ha-dong" },
    { keywords: ["ha dong"], id: "ha-dong-under-4", priceCondition: { operator: "<", value: 4 } },
  ],
}, () => {});
const multiDestinationOutcome = await multiDestinationForwarder.enqueue({
  threadId: "source",
  source: "manual",
  items: [{ data: { content: "Địa chỉ: Hà Đông\nGiá 3tr" } }],
});
assertEq("forward một bài tới hai nhóm phù hợp", multiDestinationOutcome.destinations, 2);
assertEq("API nhận hai lần gửi", multiDestinationApi._sent.map((item) => item.tid).join(","), "ha-dong,ha-dong-under-4");

const inheritedApi = makeApi();
const inheritedForwarder = new Forwarder(inheritedApi, FORWARD_CFG, () => {});
const inheritedOutcome = await inheritedForwarder.enqueue({
  threadId: "source",
  source: "live",
  items: [{ data: { content: "2tr4" } }],
  inheritedDestinations: [FORWARD_CFG.areas[0]],
  buildingContextId: "source:1",
  sequence: 2,
});
assertEq("nhãn không địa chỉ vẫn forward bằng nhóm đích kế thừa", inheritedOutcome.destinations, 1);
assertEq("nhãn kế thừa gửi đúng groupId", inheritedApi._sent[0]?.tid, "dest-1");

const orderedApi = makeApi();
const orderedForwarder = new Forwarder(orderedApi, FORWARD_CFG, () => {});
orderedForwarder.download = async (url) => `C:/zalosale-test/${url.split("/").at(-1)}`;
await orderedForwarder.enqueue({
  threadId: "source",
  source: "manual",
  items: [
    { data: { content: "Địa chỉ: Hà Đông\nPhòng mở cụm" } },
    { data: { content: { href: "https://example.test/album-a.jpg" } } },
    { data: { content: "Ghi chú sau ảnh" } },
    { data: { content: { href: "https://example.test/album-b.jpg" } } },
  ],
});
assertEq(
  "forward giữ đúng thứ tự chữ → ảnh → chữ → ảnh trong cụm",
  orderedApi._sent.map(({ msg }) => typeof msg === "string" ? "text" : "image").join(","),
  "text,image,text,image",
);

const fallbackApi = makeApi();
let albumAttempts = 0;
fallbackApi.sendMessage = async (msg, tid, type) => {
  if (typeof msg !== "string" && msg.attachments?.length > 1) {
    albumAttempts++;
    if (albumAttempts === 1) throw new Error("album unavailable");
  }
  fallbackApi._sent.push({ msg, tid, type });
};
const fallbackForwarder = new Forwarder(fallbackApi, {
  ...FORWARD_CFG,
  forward: { ...FORWARD_CFG.forward, retries: 1, sendDelayMs: 0 },
}, () => {});
await fallbackForwarder.sendWithRetry("dest-fallback", "Nội dung phòng", ["first.jpg", "second.jpg"]);
assertEq(
  "album lỗi chỉ thử lại nguyên album",
  albumAttempts,
  2,
);
assertEq(
  "album không bao giờ bị tách ảnh lẻ",
  fallbackApi._sent.filter(({ msg }) => typeof msg !== "string").map(({ msg }) => msg.attachments.join(",")).join("|"),
  "first.jpg,second.jpg",
);

const limitedAlbumApi = makeApi();
const limitedAlbums = [];
let limitedAlbumAttempts = 0;
limitedAlbumApi.sendMessage = async (msg, tid, type) => {
  limitedAlbumAttempts++;
  if (typeof msg !== "string" && msg.attachments.length > 3) {
    throw new Error("Exceed maximum file of 3");
  }
  limitedAlbums.push({ msg, tid, type });
};
const limitedAlbumForwarder = new Forwarder(limitedAlbumApi, {
  ...FORWARD_CFG,
  forward: { ...FORWARD_CFG.forward, retries: 1, sendDelayMs: 0 },
}, () => {});
await limitedAlbumForwarder.sendWithRetry("dest-limit", "Mô tả album", ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"]);
assertEq("album vượt giới hạn được tự chia theo số file API trả về", limitedAlbums.map(({ msg }) => msg.attachments.join(",")).join("|"), "1.jpg,2.jpg,3.jpg|4.jpg,5.jpg");
assertEq("chỉ album đầu giữ phần mô tả", limitedAlbums[0]?.msg.msg, "Mô tả album");
assertEq("album lỗi giới hạn không retry nguyên album", limitedAlbumAttempts, 3);

/* ---------------- 5. listener: scanRange/forwardSelected ---------------- */
console.log("\n=== listener: scan trước → chọn sau ===");
const sourceLink = "https://zalo.me/g/nhomnguon";
const nowT = Date.now();

// Quét lịch sử nhiều nhóm phải có giới hạn song song, nhưng kết quả vẫn theo thứ tự nguồn.
const scanConcurrencyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zalosale-scan-test-"));
const scanConcurrencyIds = Array.from({ length: 6 }, (_, index) => String(9100 + index));
const scanConcurrencyHistory = Object.fromEntries(scanConcurrencyIds.map((id, index) => [
  id,
  [{ data: { ts: nowT - index, content: `Địa chỉ: Hà Đông\nPhòng đẹp mã S${index}` } }],
]));
let activeHistoryRequests = 0;
let peakHistoryRequests = 0;
const scanConcurrencyApi = makeApi({ history: scanConcurrencyHistory });
scanConcurrencyApi.getGroupChatHistory = async (id) => {
  activeHistoryRequests++;
  peakHistoryRequests = Math.max(peakHistoryRequests, activeHistoryRequests);
  await sleep(12);
  activeHistoryRequests--;
  return { groupMsgs: scanConcurrencyHistory[id] };
};
const scanConcurrencyBot = startBot({
  api: scanConcurrencyApi,
  config: { ...FORWARD_CFG, sourceGroups: scanConcurrencyIds },
  batcher: null,
  forwarder: new Forwarder(scanConcurrencyApi, FORWARD_CFG, () => {}),
  status: { startedAt: new Date(), forwarded: 0, mode: "manual", knownSources: [] },
  groupsCachePath: path.join(scanConcurrencyTempDir, "groups-cache.json"),
});
const scanConcurrencyResult = await scanConcurrencyBot.scanRange("", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
assertEq("scan giới hạn lịch sử tối đa 3 nhóm song song", peakHistoryRequests <= 3, true);
assertEq("scan lịch sử thực sự chạy song song", peakHistoryRequests > 1, true);
assertEq("scan song song vẫn giữ thứ tự nhóm nguồn", scanConcurrencyResult.posts.map((post) => post.tid).join(","), scanConcurrencyIds.join(","));
scanConcurrencyBot.stop();
fs.rmSync(scanConcurrencyTempDir, { recursive: true, force: true });

// getGroupChatHistory trả tin MỚI NHẤT trước. Sắp: [tin mới nhất, ..., cũ nhất]
const srcMsgs = [
  { data: { ts: nowT - 500, content: "tin 3" } },
  { data: { ts: nowT - 1500, content: "Địa chỉ: Ba Đình\nNhà đẹp" } }, // tách > 10s so với nhóm Hà Đông
  { data: { ts: nowT - 32000, content: "Địa chỉ: Hà Đông\nPhòng đẹp" } },
  { data: { ts: nowT - 32500, content: "tin 0" } },
];
const api2 = makeApi({ history: { g001: srcMsgs }, groupLink: sourceLink });
const status2 = { startedAt: new Date(), forwarded: 0, mode: "manual", knownSources: [] };
const bot = startBot({ api: api2, config: { ...CFG, sourceGroups: [sourceLink] }, batcher: null, forwarder: fw, status: status2 });
// chờ resolveSourceLinks học nhóm nguồn từ link
await sleep(120);

const scanR = await bot.scanRange("", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
assertEq("scan trả posts", scanR.posts?.length > 0, true);
assertEq("scan có scanId", typeof scanR.scanId === "string" && scanR.scanId.length > 0, true);
assertEq("scan total = posts.length", scanR.total === scanR.posts.length, true);
assertEq("scan posts có areaName Hà Đông", scanR.posts.some((p) => p.areaName === "ha dong"), true);
assertEq("scan posts có areaName Ba Đình", scanR.posts.some((p) => p.areaName === "ba dinh"), true);
assertEq("scan posts có name nhóm nguồn", scanR.posts.every((p) => p.name === "Nhom Link 1"), true);
assertEq("scan trả chi tiết phần trong cụm", Array.isArray(scanR.posts[0]?.clusterItems), true);

const idxHaDong = scanR.posts.findIndex((p) => p.areaName === "ha dong");
const reverseIndexes = scanR.posts.map((_, index) => index).reverse();
const orderedSelection = await bot.forwardSelected(scanR.scanId, reverseIndexes);
assertEq("chọn ngược vẫn gửi đủ bài", orderedSelection.sent, scanR.posts.length);
assertEq("tin đã gửi ở lại bảng để còn gửi lại", bot.scanState()?.posts.length, scanR.posts.length);
assertEq("tin đã gửi đánh dấu sent", bot.scanState()?.posts.every((p) => p.status === "sent"), true);
assertEq("tiến độ gửi hoàn tất đủ số cụm", bot.scanState()?.progress?.total, scanR.posts.length);
assertEq("tiến độ gửi kết thúc sau cụm cuối", bot.scanState()?.progress?.running, false);
assertEq("tiến độ gửi lưu nhóm nguồn đang xử lý", bot.scanState()?.progress?.sourceName, "Nhom Link 1");
assertEq(
  "các cụm luôn gửi cũ → mới dù chọn theo thứ tự khác",
  forwarderApi._sent.filter(({ msg }) => typeof msg === "string").map(({ msg }) => msg).join("|") ,
  [...scanR.posts]
    .sort((left, right) => left.ts - right.ts)
    .flatMap((post) => post.clusterItems.map((item) => item.text).filter(Boolean))
    .join("|"),
);
const f1 = await bot.forwardSelected(scanR.scanId, [idxHaDong]);
assertEq("forwardSelected không gửi lại cụm đã gửi", f1.sent, 0);
const f2 = await bot.forwardSelected(scanR.scanId, [idxHaDong, idxHaDong]);
assertEq("forwardSelected không báo sent cho bài đã gửi", f2.sent, 0);
const f3 = await bot.forwardAll(scanR.scanId);
assertEq("forwardAll không báo sent cho các bài trùng", f3.sent, 0);
const f4 = await bot.forwardSelected("scankhongton", [0]);
assertEq("scanId không tồn tại → error", !!f4.error, true);
assertEq("scanId không tồn tại → sent 0", f4.sent, 0);
const f5 = await bot.forwardSelected(scanR.scanId, []);
assertEq("index rỗng → sent 0", f5.sent, 0);
const f6 = await bot.forwardSelected(scanR.scanId, [idxHaDong], "", true);
assertEq("force gửi lại được tin đã gửi", f6.sent, 1);
assertEq("tin gửi lại vẫn ở bảng", bot.scanState()?.posts[idxHaDong]?.status, "sent");

const failingForwarder = new Forwarder(makeApi({ sendOk: false }), FORWARD_CFG, () => {});
const failingBot = startBot({ api: api2, config: { ...FORWARD_CFG, sourceGroups: [sourceLink] }, batcher: null, forwarder: failingForwarder, status: status2 });
await sleep(120);
const failingScan = await failingBot.scanRange("", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
const failingIndex = failingScan.posts.findIndex((post) => post.areaName === "ha dong");
const failedForward = await failingBot.forwardSelected(failingScan.scanId, [failingIndex]);
assertEq("forward lỗi không được khẳng định sent", failedForward.sent, 0);
assertEq("forward lỗi trả số bài lỗi để bảng cập nhật trạng thái", failedForward.failed, 1);
assertEq("bảng quét đánh dấu bài lỗi", failingScan.posts[failingIndex]?.status, "error");
failingBot.stop();

// scan với lọc tên nhóm
const scanR2 = await bot.scanRange("nhom link", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
assertEq("scan lọc tên nhóm trả bài", scanR2.posts?.length > 0, true);

// quét chung lọc từ khóa giống logic Community cũ: không phân biệt dấu/hoa thường
const scanByKeyword = await bot.scanRange("", { fromMs: nowT - 86400000, toMs: nowT + 1000 }, "HA DONG");
assertEq("scan lọc từ khóa không dấu", scanByKeyword.posts.length, 1);
assertEq("scan lọc từ khóa đúng bài Hà Đông", scanByKeyword.posts[0]?.areaName, "ha dong");

// Một nhóm đã được resolve trước không được làm bỏ qua các nhóm nguồn còn lại.
const secondSourceId = "2002";
const multiSourceApi = makeApi({
  history: {
    g001: [{ data: { ts: nowT - 500, content: "Địa chỉ: Hà Đông\nPhòng đẹp" } }],
    [secondSourceId]: [{ data: { ts: nowT - 500, content: "Địa chỉ: Ba Đình\nNhà đẹp" } }],
  },
  groupLink: sourceLink,
});
const multiSourceStatus = { startedAt: new Date(), forwarded: 0, mode: "manual", knownSources: [] };
const multiSourceBot = startBot({
  api: multiSourceApi,
  config: { ...CFG, sourceGroups: [sourceLink, secondSourceId] },
  batcher: null,
  forwarder: fw,
  status: multiSourceStatus,
});
await sleep(120);
const multiSourceScan = await multiSourceBot.scanRange("", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
assertEq("scan tất cả không bỏ qua nhóm chưa học", multiSourceScan.groups, 2);
assertEq("scan tất cả trả bài từ đủ hai nhóm", new Set(multiSourceScan.posts.map((post) => post.tid)).size, 2);
multiSourceBot.stop();

// Hai nhóm đăng cùng nội dung: giữ bài đầu, đánh dấu bản sau là trùng.
const dupApi = makeApi({
  history: {
    g001: [{ data: { msgId: "m-g1", ts: nowT - 500, content: "Địa chỉ: Hà Đông\nPhòng đẹp giá 4tr" } }],
    [secondSourceId]: [{ data: { msgId: "m-g2", ts: nowT - 400, content: "Địa chỉ: Hà Đông\nPhòng đẹp giá 4tr" } }],
  },
  groupLink: sourceLink,
});
const dupBot = startBot({
  api: dupApi,
  config: { ...CFG, sourceGroups: [sourceLink, secondSourceId] },
  batcher: null,
  forwarder: fw,
  status: { startedAt: new Date(), forwarded: 0, mode: "manual", knownSources: [] },
});
await sleep(120);
const dupScan = await dupBot.scanRange("", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
assertEq("cùng nội dung vẫn hiện đủ 2 bài", dupScan.posts.length, 2);
assertEq("bản trùng bị đánh dấu", dupScan.posts.filter((p) => p.status === "duplicate").length, 1);
assertEq("bản trùng trỏ về bản đầu", typeof dupScan.posts.find((p) => p.status === "duplicate")?.duplicateOf, "string");
dupBot.stop();

// Quét lại sau khi gửi: đúng ID tin đã gửi thì loại (kể cả khác nhóm cũng không thêm lại).
const { createSentMessageIndex } = await import("../src/features/sent-message-index/service.js");
const rescanIndex = createSentMessageIndex({ databasePath: path.join(os.tmpdir(), `zalosale-rescan-${Date.now()}.sqlite`) });
const rescanFw = new Forwarder(
  dupApi,
  { ...CFG, sourceGroups: [sourceLink, secondSourceId], areas: [{ id: "dest-1", keywords: ["ha dong"] }] },
  () => {},
  async (delivery) => {
    rescanIndex.recordBotDelivery({ ...delivery, sourceGroup: { id: delivery.sourceGroupId, name: "Nhom" } });
  },
);
const rescanBot = startBot({
  api: dupApi,
  config: { ...CFG, sourceGroups: [sourceLink, secondSourceId], areas: [{ id: "dest-1", keywords: ["ha dong"] }] },
  batcher: null,
  forwarder: rescanFw,
  status: { startedAt: new Date(), forwarded: 0, mode: "manual", knownSources: [] },
  wasSourceContentSent: async ({ sourceId, content }) => rescanIndex.hasSourceSent({ sourceId, content }),
  wasMessageClusterSent: async (ids) => rescanIndex.countSentMessageIds(ids),
});
await sleep(120);
const rescan1 = await rescanBot.scanRange("", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
assertEq("lần quét đầu thấy đủ 2 bài", rescan1.posts.length, 2);
const sentOnce = await rescanBot.forwardSelected(rescan1.scanId, [0]);
assertEq("gửi bài đầu thành công", sentOnce.sent, 1);
const rescan2 = await rescanBot.scanRange("", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
assertEq("quét lại loại đúng tin đã gửi", rescan2.posts.length, 1);
// posts[0] là tin của nhóm 2002 (resolve trước) nên đã gửi; còn lại là tin nhóm g001 chưa gửi.
assertEq("tin còn lại là của nhóm chưa gửi", rescan2.posts[0]?.tid, "g001");
rescanBot.stop();
rescanIndex.close();

/* ---------------- 6. scan chọn sai vùng ảnh hưởng không? ---------------- */
console.log("\n=== listener: kiểm tra scan không gửi gì (preview thuần) ===");
const sentBefore = status2.forwarded;
const scanR3 = await bot.scanRange("", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
assertEq("tải lại trang lấy được bảng quét đang giữ", bot.scanState()?.scanId, scanR3.scanId);
assertEq("scan không làm tăng forwarded", status2.forwarded === sentBefore, true);
assertEq("scan thứ 2 vẫn hoạt động", scanR3.posts?.length > 0, true);

/* ---------------- 7. batcher: gom theo cửa sổ ---------------- */
console.log("\n=== batcher ===");
const { Batcher } = await import("../src/batcher.js");
const { buildingKeyFromText, parseFullBuildingNotice } = await import("../src/full-building.js");
const fullNotice = parseFullBuildingNotice("1B5 Đầm Trấu full toà");
assertEq("nhận diện đúng thông báo full tòa", fullNotice?.label, "1B5 Đầm Trấu");
assertEq("chuẩn hóa mã tòa để đối chiếu", fullNotice?.key, "1b5");
assertEq("nhận cả cách viết full tòa ở đầu câu", parseFullBuildingNotice("full tòa: 1B5 Đầm Trấu")?.key, "1b5");
assertEq("mã tòa trong bài mở cụm khớp thông báo full", buildingKeyFromText("🏠 STUDIO 1B5 ĐẦM TRẤU - HAI BÀ TRƯNG"), "1b5");
assertEq("không nhận câu chứa full tòa nhưng thiếu tên", parseFullBuildingNotice("full toà"), null);
const events = [];
const b = new Batcher({ windowMs: 50, maxBatchItems: 5, maxWaitMs: 5000 });
b.on("batch", ({ threadId, items }) => events.push({ threadId, n: items.length }));
b.add("t1", { x: 1 });
b.add("t1", { x: 2 });
await sleep(80);
assertEq("windowMs hết → flush 2 tin", events.length === 1 && events[0].n === 2, true);
const b2 = new Batcher({ windowMs: 1000, maxBatchItems: 3, maxWaitMs: 5000 });
const ev2 = [];
b2.on("batch", (e) => ev2.push(e.items.length));
for (let i = 0; i < 5; i++) b2.add("t", { i });
await sleep(30);
assertEq("maxBatchItems=3 → flush 3", ev2.length === 1 && ev2[0] === 3, true);
const b3 = new Batcher({ windowMs: 1000, maxBatchItems: 5, maxWaitMs: 60 });
const ev3 = [];
b3.on("batch", (e) => ev3.push(e.items.length));
b3.add("t", {});
await sleep(90);
assertEq("maxWaitMs → flush sớm", ev3.length === 1, true);
const b4 = new Batcher({ windowMs: 50, maxBatchItems: 5, maxWaitMs: 5000 });
const ev4 = [];
b4.on("batch", (e) => ev4.push(e.threadId));
b4.add("a", {});
b4.add("b", {});
await sleep(80);
assertEq("mỗi threadId 1 batch riêng", ev4.length, 2);

const stickerSeparated = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }],
});
const stickerSeparatedEvents = [];
stickerSeparated.on("batch", (event) => stickerSeparatedEvents.push(event));
stickerSeparated.add("source", { data: { msgType: "chat.sticker", content: { stickerId: 1 } } });
stickerSeparated.add("source", { data: { content: "P302 - 9tr5" } });
stickerSeparated.add("source", { data: { normalUrl: "https://example.test/p302.jpg" } });
stickerSeparated.add("source", { data: { content: "Địa chỉ: Cầu Giấy. Căn hộ nội thất đầy đủ, phù hợp ở ngay và xem phòng mỗi ngày." } });
stickerSeparated.add("source", { data: { msgType: "chat.sticker", content: { stickerId: 2 } } });
assertEq("sticker nguồn luôn bị bỏ khỏi cụm", stickerSeparatedEvents[0]?.items.some((item) => item.data.msgType === "chat.sticker"), false);
assertEq("sticker rồi tin dài cuối đưa tin mở cụm lên đầu", stickerSeparatedEvents[0]?.items[0]?.data.content, "Địa chỉ: Cầu Giấy. Căn hộ nội thất đầy đủ, phù hợp ở ngay và xem phòng mỗi ngày.");
assertEq("sticker giữ nhãn và ảnh phòng sau tin mở cụm", stickerSeparatedEvents[0]?.items.slice(1).map((item) => item.data.content || item.data.normalUrl).join(","), "P302 - 9tr5,https://example.test/p302.jpg");

const stickerSeparatedHistory = segmentMessages([
  { data: { ts: 1, msgType: "chat.sticker", content: { stickerId: 1 } } },
  { data: { ts: 2, content: "P302 - 9tr5" } },
  { data: { ts: 3, normalUrl: "https://example.test/p302-history.jpg" } },
  { data: { ts: 4, content: "Địa chỉ: Cầu Giấy. Căn hộ nội thất đầy đủ, phù hợp ở ngay và xem phòng mỗi ngày." } },
  { data: { ts: 5, msgType: "chat.sticker", content: { stickerId: 2 } } },
], { areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }] });
assertEq("quét lịch sử cũng ưu tiên sticker rồi đưa tin dài cuối lên đầu", stickerSeparatedHistory[0]?.[0]?.data.content, "Địa chỉ: Cầu Giấy. Căn hộ nội thất đầy đủ, phù hợp ở ngay và xem phòng mỗi ngày.");

const stickerSeparatedAlbum = new Batcher({
  windowMs: 10,
  maxBatchItems: 10,
  maxWaitMs: 500,
  areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }],
});
const stickerSeparatedAlbumEvents = [];
stickerSeparatedAlbum.on("batch", (event) => stickerSeparatedAlbumEvents.push(event));
stickerSeparatedAlbum.add("source", { data: { msgType: "chat.sticker", content: { stickerId: 1 } } });
for (let index = 1; index <= 11; index++) {
  stickerSeparatedAlbum.add("source", { data: { normalUrl: `https://example.test/album-${index}.jpg` } });
}
stickerSeparatedAlbum.add("source", { data: { content: "Địa chỉ: Cầu Giấy. Căn hộ nội thất đầy đủ, phù hợp ở ngay và xem phòng mỗi ngày." } });
stickerSeparatedAlbum.add("source", { data: { msgType: "chat.sticker", content: { stickerId: 2 } } });
assertEq("album dài chờ tin mở cụm thay vì flush ở giới hạn cũ", stickerSeparatedAlbumEvents.length, 1);
assertEq("album dài cũng gửi tin mở cụm trước ảnh", stickerSeparatedAlbumEvents[0]?.items[0]?.data.content, "Địa chỉ: Cầu Giấy. Căn hộ nội thất đầy đủ, phù hợp ở ngay và xem phòng mỗi ngày.");

const lateOpeningCluster = new Batcher({
  windowMs: 10,
  maxBatchItems: 10,
  maxWaitMs: 500,
  areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }],
});
const lateOpeningEvents = [];
lateOpeningCluster.on("batch", (event) => lateOpeningEvents.push(event));
lateOpeningCluster.add("source", { data: { content: "P101" } });
lateOpeningCluster.add("source", { data: { normalUrl: "https://example.test/p101.jpg" } });
lateOpeningCluster.add("source", { data: { content: "P102" } });
lateOpeningCluster.add("source", { data: { normalUrl: "https://example.test/p102.jpg" } });
lateOpeningCluster.add("source", { data: { content: "Địa chỉ: Cầu Giấy. Căn hộ nội thất đầy đủ, phù hợp ở ngay và xem phòng mỗi ngày." } });
lateOpeningCluster.flushAll();
assertEq("tin mở cụm cuối gom các phòng trước đó thành một cụm", lateOpeningEvents.length, 1);
assertEq("tin mở cụm cuối được đưa lên đầu", lateOpeningEvents[0]?.items[0]?.data.content, "Địa chỉ: Cầu Giấy. Căn hộ nội thất đầy đủ, phù hợp ở ngay và xem phòng mỗi ngày.");
assertEq("các phòng giữ nguyên thứ tự nguồn sau khi đưa tin mở cụm lên đầu", lateOpeningEvents[0]?.items.slice(1).map((item) => item.data.content || item.data.normalUrl).join(","), "P101,https://example.test/p101.jpg,P102,https://example.test/p102.jpg");

const singleRoomLateOpening = new Batcher({
  windowMs: 10,
  maxBatchItems: 10,
  maxWaitMs: 500,
  areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }],
});
const singleRoomLateEvents = [];
singleRoomLateOpening.on("batch", (event) => singleRoomLateEvents.push(event));
singleRoomLateOpening.add("source", { data: { content: "P101" } });
singleRoomLateOpening.add("source", { data: { normalUrl: "https://example.test/p101-only.jpg" } });
singleRoomLateOpening.add("source", { data: { content: "Địa chỉ: Cầu Giấy. Căn hộ nội thất đầy đủ, phù hợp ở ngay và xem phòng mỗi ngày." } });
singleRoomLateOpening.flushAll();
assertEq("một phòng trước tin mở cụm cuối vẫn là một cụm", singleRoomLateEvents.length, 1);
assertEq("một phòng vẫn giữ thứ tự nhãn rồi ảnh sau tin mở cụm", singleRoomLateEvents[0]?.items.map((item) => item.data.content || item.data.normalUrl).join(","), "Địa chỉ: Cầu Giấy. Căn hộ nội thất đầy đủ, phù hợp ở ngay và xem phòng mỗi ngày.,P101,https://example.test/p101-only.jpg");

const guided = new Batcher({
  windowMs: 10,
  maxBatchItems: 10,
  maxWaitMs: 500,
  areas: [{ keywords: ["ha dong"] }],
});
const guidedEvents = [];
guided.on("batch", (event) => guidedEvents.push(event.items));
guided.add("source", { data: { content: "Phòng Hà Đông" } });
await sleep(20);
guided.add("source", { data: { content: "Note: liên hệ chính chủ" } });
guided.add("source", { data: { stickerUrl: "https://example.test/guide.webp" } });
await sleep(520);
assertEq("từ khóa quá ngắn không giữ note vào cùng cụm", guidedEvents[0]?.length, 1);
assertEq("note và sticker kế tiếp vẫn giữ đúng thứ tự", guidedEvents[1]?.length, 2);

const buildingFlow = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [{ keywords: ["my dinh"], id: "dest-my-dinh" }],
});
const buildingEvents = [];
buildingFlow.on("batch", (event) => buildingEvents.push(event));
buildingFlow.add("source", { data: { content: "Địa chỉ số 3 Mỹ Đình. Dịch vụ đầy đủ. Lưu ý gọi trước 30 phút." } });
buildingFlow.add("source", { data: { content: "2tr4" } });
buildingFlow.add("source", { data: { normalUrl: "https://example.test/2tr4-a.jpg" } });
buildingFlow.add("source", { data: { normalUrl: "https://example.test/2tr4-b.jpg" } });
buildingFlow.add("source", { data: { content: "2tr7" } });
buildingFlow.add("source", { data: { normalUrl: "https://example.test/2tr7-a.jpg" } });
buildingFlow.flushAll();
assertEq("tòa và các mã phòng là một cụm", buildingEvents.length, 1);
assertEq("cụm bắt đầu bằng thông tin tòa", buildingEvents[0]?.segmentType, "building");
assertEq("cụm giữ toàn bộ ảnh theo thứ tự", buildingEvents[0]?.items.length, 6);
assertEq("cụm kế thừa đúng nhóm đích", buildingEvents[0]?.inheritedDestinations?.[0]?.id, "dest-my-dinh");
assertEq("cụm chỉ phát một sequence", buildingEvents.map((event) => event.sequence).join(","), "1");

const beforeCaption = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }],
});
const beforeCaptionEvents = [];
beforeCaption.on("batch", (event) => beforeCaptionEvents.push(event));
beforeCaption.add("source", { data: { content: "Địa chỉ Cầu Giấy. Nội thất và dịch vụ đầy đủ." } });
beforeCaption.add("source", { data: { normalUrl: "https://example.test/truc-03.jpg" } });
beforeCaption.add("source", { data: { content: "TRỤC 03" } });
beforeCaption.flushAll();
assertEq("media và nhãn phòng ở lại cùng cụm tòa", beforeCaptionEvents.length, 1);
assertEq("nhãn phòng không tự mở cụm mới", beforeCaptionEvents[0]?.items.map((item) => item.data.content?.href || item.data.content || item.data.normalUrl).join(","), "Địa chỉ Cầu Giấy. Nội thất và dịch vụ đầy đủ.,https://example.test/truc-03.jpg,TRỤC 03");

const isolatedSources = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [
    { keywords: ["ha dong"], id: "dest-ha-dong" },
    { keywords: ["ba dinh"], id: "dest-ba-dinh" },
  ],
});
const isolatedEvents = [];
isolatedSources.on("batch", (event) => isolatedEvents.push(event));
isolatedSources.add("source-a", { data: { content: "Địa chỉ Hà Đông. Dịch vụ đầy đủ." } });
isolatedSources.add("source-b", { data: { content: "Địa chỉ Ba Đình. Dịch vụ đầy đủ." } });
isolatedSources.add("source-a", { data: { content: "P201 - 4tr5" } });
isolatedSources.add("source-b", { data: { content: "TRỤC 02" } });
isolatedSources.flushAll();
const sourceABuilding = isolatedEvents.find((event) => event.threadId === "source-a" && event.segmentType === "building");
const sourceBBuilding = isolatedEvents.find((event) => event.threadId === "source-b" && event.segmentType === "building");
assertEq("nhóm nguồn A giữ nhóm đích riêng", sourceABuilding?.inheritedDestinations?.[0]?.id, "dest-ha-dong");
assertEq("nhóm nguồn B giữ nhóm đích riêng", sourceBBuilding?.inheritedDestinations?.[0]?.id, "dest-ba-dinh");

const timeoutOnce = new Batcher({ windowMs: 10, maxBatchItems: 20, maxWaitMs: 40, areas: [] });
const timeoutEvents = [];
timeoutOnce.on("batch", (event) => timeoutEvents.push(event));
timeoutOnce.add("source", { data: { content: "TRỤC 05" } });
await sleep(70);
timeoutOnce.flushAll();
assertEq("timer và flushAll không phát trùng lượt cuối", timeoutEvents.length, 1);

const inheritedCluster = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [
    { keywords: ["my dinh"], id: "dest-my-dinh" },
    { keywords: ["cau giay"], id: "dest-cau-giay" },
  ],
});
const clusterEvents = [];
inheritedCluster.on("batch", (event) => clusterEvents.push(event));
inheritedCluster.add("source", { data: { content: "Địa chỉ Mỹ Đình. Dịch vụ và nội thất đầy đủ." } });
inheritedCluster.add("source", { data: { content: "tin nhắn bình thường" } });
inheritedCluster.add("source", { data: { content: "tin nhắn phụ" } });
inheritedCluster.add("source", { data: { content: "2tr4" } });
inheritedCluster.add("source", { data: { normalUrl: "https://example.test/room.jpg" } });
inheritedCluster.add("source", { data: { content: "Địa chỉ Cầu Giấy. Dịch vụ và nội thất đầy đủ." } });
inheritedCluster.flushAll();
const firstCluster = clusterEvents.filter((event) => event.buildingContextId === "source:1");
assertEq("mọi lượt sau tin dài cùng kế thừa một nhóm đích", firstCluster.every((event) => event.inheritedDestinations[0]?.id === "dest-my-dinh"), true);
assertEq("tin dài tiếp theo mở cụm và nhóm đích mới", clusterEvents.at(-1)?.inheritedDestinations[0]?.id, "dest-cau-giay");

const largeAlbum = new Batcher({
  windowMs: 10,
  maxBatchItems: 3,
  maxWaitMs: 500,
  areas: [{ keywords: ["my dinh"], id: "dest-my-dinh" }],
});
const largeAlbumEvents = [];
largeAlbum.on("batch", (event) => largeAlbumEvents.push(event));
largeAlbum.add("source", { data: { content: "Địa chỉ Mỹ Đình. Dịch vụ và nội thất đầy đủ." } });
largeAlbum.add("source", { data: { content: "TRỤC 01" } });
for (let index = 0; index < 6; index++) {
  largeAlbum.add("source", {
    data: { content: { href: `https://example.test/large-${index}.jpg`, thumb: `https://example.test/thumb-${index}.jpg` } },
  });
}
largeAlbum.flushAll();
const largeBuilding = largeAlbumEvents.find((event) => event.segmentType === "building");
assertEq("maxBatchItems nhỏ không cắt đôi album có ngữ cảnh", largeBuilding?.items.length, 8);

const strictBoundary = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [{ keywords: ["my dinh"], id: "dest-my-dinh" }],
});
const strictBoundaryEvents = [];
strictBoundary.on("batch", (event) => strictBoundaryEvents.push(event));
strictBoundary.add("source", { data: { content: "Địa chỉ Mỹ Đình. Nội thất đầy đủ, phòng đang trống và có thể xem ngay." } });
strictBoundary.add("source", { data: { content: "Chi tiết bổ sung của cụm đầu" } });
strictBoundary.add("source", { data: { content: { href: "https://example.test/first-album.jpg" } } });
strictBoundary.add("source", { data: { content: "P503" } });
strictBoundary.add("source", { data: { content: { href: "https://example.test/p503-a.jpg" } } });
strictBoundary.add("source", { data: { content: { href: "https://example.test/p503-b.jpg" } } });
strictBoundary.flushAll();
assertEq("mã phòng và album sau nó vẫn ở cụm tòa", strictBoundaryEvents.length, 1);
assertEq("cụm giữ đúng thứ tự mã phòng và album", strictBoundaryEvents[0]?.items.map((item) => item.data.content?.href || item.data.content).join(","), "Địa chỉ Mỹ Đình. Nội thất đầy đủ, phòng đang trống và có thể xem ngay.,Chi tiết bổ sung của cụm đầu,https://example.test/first-album.jpg,P503,https://example.test/p503-a.jpg,https://example.test/p503-b.jpg");

const consecutiveHeaders = new Batcher({ windowMs: 10, maxBatchItems: 20, maxWaitMs: 500, areas: [] });
const consecutiveHeaderEvents = [];
consecutiveHeaders.on("batch", (event) => consecutiveHeaderEvents.push(event));
consecutiveHeaders.add("source", { data: { content: "🌹30% Mã A1" } });
consecutiveHeaders.add("source", { data: { content: "ghi chú cụm A1" } });
consecutiveHeaders.add("source", { data: { content: "🌹40% Mã B2" } });
consecutiveHeaders.add("source", { data: { content: "ghi chú cụm B2" } });
consecutiveHeaders.flushAll();
assertEq("hai tin mở cụm liên tiếp tạo hai cụm", consecutiveHeaderEvents.length, 2);

const openingSignals = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [{ keywords: ["my dinh"], id: "dest-my-dinh" }],
});
const openingEvents = [];
openingSignals.on("batch", (event) => openingEvents.push(event));
openingSignals.add("source", { data: { content: "Địa chỉ: ngõ 12" } });
openingSignals.add("source", { data: { content: "tin phụ cho cụm trên" } });
openingSignals.add("source", { data: { content: "Địa chỉ Mỹ Đình, ngõ 12. Phòng studio đang trống, nội thất đầy đủ, có thang máy và khách có thể xem ngay trong ngày." } });
openingSignals.add("source", { data: { content: "tin phụ sau tin dài" } });
openingSignals.add("source", { data: { content: "Giá phòng 4tr5" } });
openingSignals.flushAll();
assertEq("tin dài từ 120 ký tự mở cụm mới", openingEvents[0]?.segmentType, "building");
assertEq("tin giá phòng thuộc cụm tòa đang mở", openingEvents[0]?.items.at(-1)?.data?.content, "Giá phòng 4tr5");
assertEq("một tin dài chỉ tạo một cụm", openingEvents.map((event) => event.sequence).join(","), "1");

const filteredNoise = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }],
});
const filteredNoiseEvents = [];
filteredNoise.on("batch", (event) => filteredNoiseEvents.push(event));
filteredNoise.add("source", { data: { content: "📣 Thông báo nhóm: https://zalo.me/g/example" } });
filteredNoise.add("source", { data: { content: "Liên hệ 0987 654 321 để nhận thông tin" } });
filteredNoise.add("source", { data: { content: "x".repeat(120) } });
filteredNoise.add("source", { data: { content: `TC HOME Cầu Giấy — cơ chế hoa hồng theo giá phòng, xem thông tin tại https://zalo.me/g/policy ${"thông báo ".repeat(20)}` } });
filteredNoise.add("source", { data: { content: "Địa chỉ: Cầu Giấy, Hà Nội. Phòng đẹp nội thất đầy đủ và đang sẵn khách xem ngay https://zalo.me/g/room" } });
filteredNoise.flushAll();
assertEq("tin có link, số điện thoại và tin dài không mở cụm bị loại", filteredNoiseEvents.length, 1);
assertEq("tin mở cụm có link vẫn được giữ", filteredNoiseEvents[0]?.items.length, 1);
assertEq("tin mở cụm hợp lệ không bị lẫn tin rác", filteredNoiseEvents[0]?.items[0]?.data.content.includes("Địa chỉ: Cầu Giấy"), true);

const fullBuildingBatcher = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }],
});
const fullBuildingEvents = [];
const fullNotices = [];
fullBuildingBatcher.on("batch", (event) => fullBuildingEvents.push(event));
fullBuildingBatcher.on("building-full", (notice) => fullNotices.push(notice));
fullBuildingBatcher.add("source-full", { data: { content: "🏠 1B5 Đầm Trấu - Cầu Giấy. Địa chỉ ngõ 12, phòng studio đang trống, nội thất đầy đủ." } });
fullBuildingBatcher.add("source-full", { data: { content: "1B5 Đầm Trấu full toà" } });
fullBuildingBatcher.add("source-full", { data: { content: "P201 - 5tr" } });
fullBuildingBatcher.flushAll();
assertEq("full tòa phát tín hiệu riêng để cập nhật trạng thái", fullNotices[0]?.key, "1b5");
assertEq("full tòa loại bỏ cụm đang chờ và phòng theo sau", fullBuildingEvents.length, 0);
fullBuildingBatcher.add("source-full", { data: { content: "🏠 2A Đầm Trấu - Cầu Giấy. Địa chỉ ngõ 15, phòng studio đang trống, nội thất đầy đủ." } });
fullBuildingBatcher.flushAll();
assertEq("tòa khác vẫn được mở cụm bình thường", fullBuildingEvents[0]?.buildingKey, "2a");
fullBuildingBatcher.add("source-full", { data: { content: "1B5 Kim Giang - Cầu Giấy. Địa chỉ ngõ 20, phòng studio đang trống, nội thất đầy đủ." } });
fullBuildingBatcher.flushAll();
assertEq("trùng mã nhưng khác tên vẫn mở cụm", fullBuildingEvents[1]?.buildingKey, "1b5");
const fullHistory = segmentMessages([
  { data: { ts: 1, content: "🏠 1B5 Đầm Trấu - Cầu Giấy. Địa chỉ ngõ 12, phòng studio đang trống, nội thất đầy đủ." } },
  { data: { ts: 2, content: "1B5 Đầm Trấu full toà" } },
  { data: { ts: 3, content: "P201 - 5tr" } },
], { threadId: "source-history-full", areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }] });
assertEq("quét lịch sử không trả lại cụm tòa đã full", fullHistory.length, 0);
assertEq("quét lịch sử vẫn ghi nhận mô tả full tòa", fullHistory.fullBuildingNotices[0]?.label, "1B5 Đầm Trấu");
const duplicateAddressHistory = segmentMessages([
  { data: { ts: 1, content: "1B5 Đầm Trấu full tòa" } },
  { data: { ts: 2, content: "🏠 1B5 Kim Giang - Cầu Giấy. Địa chỉ ngõ 20, phòng studio đang trống, nội thất đầy đủ." } },
], { threadId: "source-history-duplicate", areas: [{ keywords: ["cau giay"], id: "dest-cau-giay" }] });
assertEq("lịch sử không loại nhầm tòa trùng mã khác tên", duplicateAddressHistory.length, 1);

const keywordLength = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [{ keywords: ["my dinh"], id: "dest-my-dinh" }],
});
const keywordLengthEvents = [];
keywordLength.on("batch", (event) => keywordLengthEvents.push(event));
keywordLength.add("source", { data: { content: "Mỹ Đình" } });
keywordLength.add("source", { data: { content: "Địa chỉ: Mỹ Đình. Phòng đẹp nội thất đầy đủ và đang sẵn khách xem ngay" } });
keywordLength.flushAll();
assertEq("từ khóa quá ngắn không tự mở cụm", keywordLengthEvents.length, 1);
assertEq("từ khóa kèm nội dung từ 30 ký tự mở cụm", keywordLengthEvents[0]?.buildingContextId, "source:1");

const addressWordOnly = new Batcher({ windowMs: 10, maxBatchItems: 20, maxWaitMs: 500, areas: [] });
const addressWordEvents = [];
addressWordOnly.on("batch", (event) => addressWordEvents.push(event));
addressWordOnly.add("source", { data: { content: "Địa chỉ: ngõ 12" } });
addressWordOnly.flushAll();
assertEq("chữ địa chỉ không còn tự mở cụm", addressWordEvents[0]?.segmentType, "generic");

const commissionHeader = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [
    { keywords: ["my dinh"], id: "dest-my-dinh" },
    { keywords: ["ba dinh"], id: "dest-ba-dinh" },
  ],
});
const commissionEvents = [];
commissionHeader.on("batch", (event) => commissionEvents.push(event));
commissionHeader.add("source", { data: { content: "Địa chỉ: Mỹ Đình. Phòng đẹp nội thất đầy đủ và đang sẵn khách xem ngay" } });
commissionHeader.add("source", { data: { content: "🌹30% 12th                      Mã Tt04" } });
await sleep(20);
commissionHeader.add("source", { data: { content: "Địa chỉ: Số 16C, Khu B4, Ngõ 195 Đội Cấn, P. Ngọc Hà, Q. Ba Đình, Hà Nội" } });
commissionHeader.flushAll();
assertEq("header hoa hồng đóng cụm cũ ngay", commissionEvents[0]?.items.length, 1);
assertEq("header mã chờ và ghép với nội dung khu vực sau", commissionEvents[1]?.items.length, 2);
assertEq("header mới đi đúng nhóm của phần địa chỉ sau", commissionEvents[1]?.inheritedDestinations[0]?.id, "dest-ba-dinh");

const commissionWithoutCode = new Batcher({
  windowMs: 10,
  maxBatchItems: 20,
  maxWaitMs: 500,
  areas: [{ keywords: ["bac tu liem"], id: "dest-bac-tu-liem" }],
});
const noCodeEvents = [];
commissionWithoutCode.on("batch", (event) => noCodeEvents.push(event));
commissionWithoutCode.add("source", { data: { content: "Địa chỉ: Số 18 Ngách 158 Ngõ 207 Xuân Đỉnh - Bắc Từ Liêm. Trống tầng 5, giá 3tr2. HH: 20%. R79" } });
commissionWithoutCode.flushAll();
assertEq("bài không có Mã nhưng có HH phần trăm vẫn mở cụm", noCodeEvents[0]?.segmentType, "building");
assertEq("bài HH không mã vẫn nhận đúng nhóm đích", noCodeEvents[0]?.inheritedDestinations[0]?.id, "dest-bac-tu-liem");

const realPostFormats = new Batcher({
  windowMs: 10,
  maxBatchItems: 100,
  maxWaitMs: 500,
  areas: [
    { keywords: ["cau giay", "trung kinh"], id: "dest-cau-giay" },
    { keywords: ["bac tu liem", "xuan dinh"], id: "dest-bac-tu-liem" },
  ],
});
const realPostEvents = [];
realPostFormats.on("batch", (event) => realPostEvents.push(event));
realPostFormats.add("source", { data: { content: `🌹7th 40%
Mã : R151

Địa chỉ: Số 18A ngõ 43/113 Trung Kính - Cầu Giấy
Trống: Tầng 2,3,4
Giá: 6tr
Phòng: Studio 30m2
Nội thất: Máy giặt riêng, bếp từ, tủ lạnh, điều hòa
Dịch vụ: Điện 4k/số, nước 35k/khối, mạng 100k/phòng
Lưu ý: Thanh toán 1 cọc 1, khách gọi trước 30 phút` } });
realPostFormats.add("source", { data: { content: `Địa chỉ: Số 18 Ngách 158 Ngõ 207 Xuân Đỉnh - Bắc Từ Liêm
Trống phòng tầng 5 thang bộ
Giá thuê: 3tr2
Thiết kế: Studio khép kín, rộng 20m2
Nội thất: Giường, tủ, điều hòa, nóng lạnh, kệ bếp
Dịch vụ: Điện 4k/số, nước 100k/người, mạng 100k/phòng
HH: 20%. R79` } });
realPostFormats.flushAll();
assertEq("hai định dạng thật được tách thành hai cụm", realPostEvents.length, 2);
assertEq("cụm có hoa hồng và Mã nhận đúng Cầu Giấy", realPostEvents[0]?.inheritedDestinations[0]?.id, "dest-cau-giay");
assertEq("cụm không Mã nhưng có HH nhận đúng Bắc Từ Liêm", realPostEvents[1]?.inheritedDestinations[0]?.id, "dest-bac-tu-liem");
assertEq("nội dung hai cụm không bị trộn", realPostEvents.every((event) => event.items.length === 1), true);
assertEq("hai cụm có context id độc lập", realPostEvents.map((event) => event.buildingContextId).join(","), "source:1,source:2");

/* ---------------- 8. sinh tự động: dấu × emoji × hoa thường ---------------- */
console.log("\n=== auto-generated: biến thể tiếng Việt/emoji/case ===");
const baseKw = ["ha dong", "ba dinh", "nguyen trai", "van quan", "phan dinh phung"];
const variants = [];
const textVariants = (kw) => [
  `Địa chỉ: ${kw.toUpperCase()}`,
  `Địa chỉ: ${kw}`,
  `Địa chỉ:   ${kw}  `,
  `🏠 Địa chỉ: ${kw} 🏠`,
  `Địa chỉ: - ${kw} -`,
  `Địa chỉ: ${kw}, Hà Nội`,
  `Địa chỉ: ${kw.replace(/a/g, "ă")}`,
];
let autoCount = 0;
for (const kw of baseKw) {
  for (const tv of textVariants(kw)) {
    autoCount++;
    const area = classifyArea(tv, areas);
    check(`auto: "${tv}" → có khu vực`, !!area, `nhận "${tv}"`);
  }
}
console.log(`  → ${autoCount} case biến thể khu vực`);

// cleanText auto: mọi tổ hợp deleteLines với dấu
const delVariants = ["🌹", "hoa hồng", "HOA HỒNG", "hoa  hồng"];
let cleanAuto = 0;
for (const d of delVariants) {
  const out = cleanText(`dòng 1\n${d} 12t\n dòng 3`, { deleteLines: ["🌹", "hoa hồng"] });
  if (!out.includes("12t")) cleanAuto++;
  check(`auto-clean: bỏ dòng chứa "${d}"`, !out.includes("12t"), out);
}
console.log(`  → ${delVariants.length} case xoá dòng`);

/* ---------------- 8b. ma trận lớn sinh tự động (hướng tới ~1000) ---------------- */
console.log("\n=== matrix lớn: chuẩn hoá × clean × classify × nameKey ===");
const accents = ["", "à", "á", "ả", "ã", "ạ"];
const cases = [
  ["hà đông", "ha dong"],
  ["ba đình", "ba dinh"],
  ["nguyễn trãi", "nguyen trai"],
  ["văn quán", "van quan"],
  ["phan đình phùng", "phan dinh phung"],
  ["hoa hồng", "hoa hong"],
  ["tìm phòng", "tim phong"],
  ["hết phòng", "het phong"],
];
let mCount = 0;
for (const [raw, norm] of cases) {
  // biến thể: hoa/thường, dấu từng ký tự, khoảng trắng, emoji, gạch ngang
  for (const prefix of ["", "  ", "🏠 ", "- ", "★ "]) {
    for (const suffix of ["", "  ", " 🏠", " -", " ★"]) {
      for (const up of [false, true]) {
        const base = up ? raw.toUpperCase() : raw;
        const t = prefix + base + suffix;
        const want = (prefix + norm + suffix).replace(/\s+/g, " ").trim();
        mCount++;
        assertEq(`norm: "${t}"`, normalizeText(t), want);
      }
    }
  }
  // cleanText: dòng chứa raw → xoá khi nằm trong deleteLines
  for (const line of [raw, raw.toUpperCase(), `  ${raw}  `, `${raw} 30%`, `địa chỉ: ${raw}`]) {
    mCount++;
    const out = cleanText(`dòng 1\n${line}\ndòng 3`, { deleteLines: [raw] });
    check(`clean bỏ "${line}"`, !out.includes("dòng 2") && !out.includes(raw), out);
  }
  // classify: text chứa raw (với khu vực tương ứng) → phải nhận đúng
  if (raw.includes("hà đông") || raw.includes("ba đình")) {
    for (const w of ["", "phòng trọ ", "CHO THUÊ ", "🏠 "]) {
      mCount++;
      const t = `Địa chỉ: ${w}${raw}`;
      const area = classifyArea(t, areas);
      check(`classify: "${t}"`, !!area, t);
    }
  }
}
console.log(`  → ${mCount} case ma trận`);
assertEq("mCount ≥ 300", mCount >= 300, true);

/* ---------------- 8c. nameKey (logic khớp tên nhóm) ---------------- */
console.log("\n=== nameKey: khớp tên nhóm có icon ===");
const nk = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const groupNames = [
  "🏠 CẦU GIẤY - PHÒNG TRỌ 🏠",
  "CẦU GIẤY - PHÒNG TRỌ",
  "★ PHÒNG TRỌ SINH VIÊN CẦU GIẤY ★",
  "HÀ ĐÔNG - CHO THUÊ PHÒNG",
  "Phòng trọ Hà Đông giá rẻ",
  "BA ĐÌNH CHÍNH CHỦ",
];
const typed = ["cau giay", "phong tro", "ha dong", "ba dinh", "gia re", "chinh chu"];
for (const g of groupNames) {
  for (const t of typed) {
    const a = nk(g);
    const b = nk(t);
    const hit = b.length >= 3 && a.length >= 3 && (a.includes(b) || b.includes(a));
    if (a.includes(b)) check(`nameKey: "${t}" ⊆ "${g}"`, true, true);
    else check(`nameKey: "${t}" ∉ "${g}"`, hit === false, `hit=${hit} (a=${a}, b=${b})`);
  }
}
console.log(`  → ${groupNames.length * typed.length} case khớp tên`);

/* ---------------- 8d. ma trận classify mở rộng ---------------- */
console.log("\n=== matrix classify: từ khoá × nhiều khu vực × defaultArea ===");
const bigAreas = [
  { keywords: ["ha dong", "nguyen trai", "van quan"], groupLink: "a" },
  { keywords: ["ba dinh", "phan dinh phung", "lang ha"], groupLink: "b" },
  { keywords: ["cau giay", "dich vong", "nghia tan"], groupLink: "c" },
  { keywords: ["thanh xuan", "nhan chinh"], groupLink: "d" },
];
const kwMatrix = ["ha dong", "BA ĐÌNH", "Cầu Giấy", "thanh xuan", "nhan chinh", "văn quán", "láng hạ", "nghĩa tân"];
let cm = 0;
for (const kw of kwMatrix) {
  for (const w of ["", "phòng ", "🏠 ", "cho thuê ", "tìm ", "   ", "★ ", "- "]) {
    for (const s of ["", " giá rẻ", " 30m2", " 🏠", " liên hệ", " có gác"]) {
      const t = `Địa chỉ: ${w}${kw}${s}`;
      cm++;
      const area = classifyArea(t, bigAreas);
      check(`matrix classify: "${t}"`, !!area, t);
      const expected =
        kw === "ha dong" || kw === "văn quán" ? "ha dong" :
        kw === "BA ĐÌNH" || kw === "láng hạ" ? "ba dinh" :
        kw === "Cầu Giấy" || kw === "nghĩa tân" ? "cau giay" : "thanh xuan";
      assertEq(`matrix khu vực: "${t}"`, area?.keywords?.[0], expected);
    }
  }
}
console.log(`  → ${cm} case classify mở rộng`);

/* ---------------- 8e. ma trận cleanText toàn diện ---------------- */
console.log("\n=== matrix cleanText: dòng xoá × bộ lọc ===");
const linesToTest = [
  "🌹( 12t ) : 30%",
  "hoa hồng 20%",
  "HOA HỒNG (chính chủ)",
  "  🌹 hoa hồng  ",
  "Giá: 4tr4",
  "💰 GIÁ 5tr/tháng",
  "Hoa hồng cho môi giới 2%",
  "hoa hồng 5% - giá tốt",
];
let ctm = 0;
for (const line of linesToTest) {
  ctm++;
  const out = cleanText(`Phòng đẹp\n${line}\nLiên hệ: 091`, {
    deleteLines: ["🌹", "hoa hồng"],
    removePercentLines: true,
    removePriceLines: true,
  });
  const n = normalizeText(line);
  const shouldKeep =
    !n.includes(normalizeText("hoa hồng")) &&
    !/[0-9]\s*%/.test(line) &&
    !n.includes(normalizeText("giá"));
  const removed = !out.includes(line.slice(0, 8));
  check(`clean dòng "${line.slice(0, 20)}..." → ${shouldKeep ? "giữ" : "xoá"}`, removed === !shouldKeep, `out=${out}`);
}
console.log(`  → ${ctm} case clean mở rộng`);

/* ---------------- 8f. resolveRange mở rộng ---------------- */
console.log("\n=== resolveRange: biên ngày ===");
const rgCases = [
  [{ days: 1 }, false, "1 ngày"],
  [{ days: 60 }, false, "60 ngày"],
  [{ days: 61 }, true, ""],
  [{ days: -1 }, true, ""],
  [{ days: 0 }, true, ""],
  [{ days: "5" }, false, ""], // string number bị coi là từ ngày → lỗi? check: days là string → typeof !== number → fallthrough → from/to null → hôm nay (không lỗi)
  [{ from: "31/12/2026" }, true, ""],
  [{ from: "01/01/2026", to: "28/02/2026" }, false, "59 ngày"],
  [{ from: "01/01/2026", to: "01/03/2026" }, false, "60 ngày"],
  [{ from: "2026-08-01", to: "2026-08-31" }, false, "31 ngày"],
  [{ from: "1/1/2026" }, true, ""],
];
for (const [args, expectErr, expectLabel] of rgCases) {
  const r = resolveRange(args);
  check(`resolveRange(${JSON.stringify(args)}) lỗi=${expectErr}`, !!r.error === expectErr, JSON.stringify(r).slice(0, 80));
  if (expectLabel && !r.error) check(`resolveRange label ${expectLabel}`, r.label.includes(expectLabel), r.label);
}
console.log(`  → ${rgCases.length} case resolveRange`);

/* ---------------- 9. parsePrice / isInPriceRange ---------------- */
console.log("\n=== parsePrice + isInPriceRange ===");
const { parsePrice, isInPriceRange } = await import("../src/processor.js");
const { parseCommissionPercent } = await import("../src/processor.js");
const { attachmentUrls, extractPhotoUrls, videoUrls } = await import("../src/media.js");
const { buildDeliveryUnits } = await import("../src/delivery.js");

const priceCases = [
  ["4tr5", 4.5],
  ["4tr", 4.0],
  ["4.5tr", 4.5],
  ["4,5tr", 4.5],
  ["4 triệu 5", 4.5],
  ["4 triệu", 4.0],
  ["giá 4tr5/tháng", 4.5],
  ["3tr5 – 5tr", 3.5],
  ["Phòng 12m2 giá 4tr5", 4.5],
  ["Cho thuê 3tr2", 3.2],
  ["10tr", 10.0],
  ["giá 2.8tr bao phí", 2.8],
  ["không có giá", null],
  ["abc", null],
  ["4tr 5", 4.5], // space before fraction → 4.5
  ["ngõ 554 Trường Chinh, Đống Đa", null],
  ["ngõ 554 Trường Chinh — 5.000.000 đ", 5],
];
for (const [text, want] of priceCases) {
  const p = parsePrice(text);
  if (want === null) check(`parsePrice("${text.slice(0, 30)}") → null`, p === null, JSON.stringify(p));
  else check(`parsePrice("${text.slice(0, 30)}") → ${want}`, p?.first === want, JSON.stringify(p));
}

// isInPriceRange
assertEq("trong khoảng", isInPriceRange("4tr5", { min: 2, max: 5 }), true);
assertEq("dưới min", isInPriceRange("1tr5", { min: 2, max: 5 }), false);
assertEq("trên max", isInPriceRange("6tr", { min: 2, max: 5 }), false);
assertEq("bằng min", isInPriceRange("2tr", { min: 2, max: 5 }), true);
assertEq("bằng max", isInPriceRange("5tr", { min: 2, max: 5 }), true);
assertEq("không có giá", isInPriceRange("cho thuê phòng", { min: 2, max: 5 }), true);
assertEq("range null", isInPriceRange("4tr5", null), true);
assertEq("range rỗng", isInPriceRange("4tr5", {}), true);
assertEq("chỉ min", isInPriceRange("3tr", { min: 2 }), true);
assertEq("chỉ max", isInPriceRange("3tr", { max: 5 }), true);
assertEq("chỉ min dưới", isInPriceRange("1tr", { min: 2 }), false);
assertEq("chỉ max trên", isInPriceRange("6tr", { max: 5 }), false);

/* ---------------- 10. parseCommissionPercent ---------------- */
assertEq("hoa hồng dạng bông hoa", parseCommissionPercent("🌹7th 40%\nMã R151"), 40);
assertEq("hoa hồng dạng chữ rose từ Zalo", parseCommissionPercent("/-rose 12th 35%\nMã TT110"), 35);
assertEq("hoa hồng dạng bó hoa thực tế", parseCommissionPercent("💐 30%12th,       Mã A410"), 30);
assertEq("hoa hồng dạng HH", parseCommissionPercent("HH: 20%. R79"), 20);
assertEq("hoa hồng dạng chữ", parseCommissionPercent("Hoa hồng cho môi giới 35%"), 35);
assertEq("phần trăm bất kỳ đều nhận diện", parseCommissionPercent("Giảm giá 10%"), 10);
assertEq(
  "ảnh chỉ nhận http/https và loại URL nguy hiểm",
  extractPhotoUrls([
    { data: { normalUrl: "https://example.test/room.jpg" } },
    { data: { originUrl: "javascript:alert(1)" } },
  ]).join(","),
  "https://example.test/room.jpg",
);
assertEq(
  "video dùng ảnh đại diện thay vì URL video không thể hiển thị bằng ảnh",
  extractPhotoUrls([{
    data: {
      msgType: "chat.video.msg",
      content: { href: "https://video.example.test/clip", thumb: "https://photo.example.test/clip.jpg" },
    },
  }])[0],
  "https://photo.example.test/clip.jpg",
);
const videoItem = {
  data: {
    msgType: "chat.video.msg",
    content: { href: "https://video.example.test/clip.mp4", thumb: "https://photo.example.test/clip.jpg" },
  },
};
assertEq("video lấy URL gốc để gửi", videoUrls(videoItem)[0], "https://video.example.test/clip.mp4");
assertEq("video giữ loại attachment riêng", attachmentUrls(videoItem)[0]?.type, "video");
const videoUnits = buildDeliveryUnits([videoItem], {});
assertEq("cụm video tạo media unit", videoUnits[0]?.kind, "media");
assertEq("media unit giữ URL video", videoUnits[0]?.urls[0]?.url, "https://video.example.test/clip.mp4");
assertEq("media unit giữ loại video", videoUnits[0]?.urls[0]?.type, "video");
const videoApi = makeApi();
let downloadedVideoType = null;
const nativeVideoCalls = [];
videoApi.sendMessage = async (message, threadId, type) => {
  videoApi._sent.push({ message, threadId, type });
};
videoApi.sendVideo = async (options, threadId, type) => {
  nativeVideoCalls.push({ options, threadId, type });
};
const videoForwarder = new Forwarder(videoApi, parseConfig({
  sourceGroups: ["video-source"],
  areas: [{ id: "video-destination", matchAll: true }],
  forward: { sendDelayMs: 0, retries: 0 },
}), () => {});
videoForwarder.download = async (_url, mediaType) => {
  downloadedVideoType = mediaType;
  const filePath = path.join(os.tmpdir(), `zalosale-video-${Date.now()}.mp4`);
  fs.writeFileSync(filePath, "video");
  return filePath;
};
const videoForwardResult = await videoForwarder.forwardPayload({ threadId: "video-source", items: [videoItem], source: "manual" });
assertEq("forward video thành công", videoForwardResult.destinations, 1);
assertEq("video luôn tải về để gửi dạng file", downloadedVideoType, "video");
assertEq("không gọi API video native", nativeVideoCalls.length, 0);
assertEq("video gửi dạng file đính kèm", videoApi._sent[0]?.message.attachments[0].endsWith(".mp4"), true);

const fallbackVideoApi = makeApi();
let fallbackVideoDownloadType = null;
fallbackVideoApi.sendVideo = async () => { throw new Error("Tham số không hợp lệ"); };
fallbackVideoApi.sendMessage = async (message, threadId, type) => {
  fallbackVideoApi._sent.push({ message, threadId, type });
};
const fallbackVideoForwarder = new Forwarder(fallbackVideoApi, parseConfig({
  sourceGroups: ["video-source"],
  areas: [{ id: "video-destination", matchAll: true }],
  forward: { sendDelayMs: 0, retries: 0 },
}), () => {});
fallbackVideoForwarder.download = async (_url, mediaType) => {
  fallbackVideoDownloadType = mediaType;
  const filePath = path.join(os.tmpdir(), `zalosale-video-fallback-${Date.now()}.mp4`);
  fs.writeFileSync(filePath, "video");
  return filePath;
};
const fallbackVideoResult = await fallbackVideoForwarder.forwardPayload({ threadId: "video-source", items: [videoItem], source: "manual" });
assertEq("video vẫn hoàn tất cụm bằng file", fallbackVideoResult.destinations, 1);
assertEq("video được tải dạng file", fallbackVideoDownloadType, "video");
assertEq("gửi đúng file video", fallbackVideoApi._sent[0]?.message.attachments[0].endsWith(".mp4"), true);

const mixedMediaApi = makeApi();
const mixedNativeVideos = [];
const mixedMediaSendOrder = [];
mixedMediaApi.sendMessage = async (message, threadId, type) => {
  mixedMediaSendOrder.push("images");
  mixedMediaApi._sent.push({ msg: message, tid: threadId, type });
};
mixedMediaApi.sendVideo = async (options) => {
  mixedMediaSendOrder.push("video");
  mixedNativeVideos.push(options);
};
const mixedMediaForwarder = new Forwarder(mixedMediaApi, parseConfig({
  sourceGroups: ["mixed-source"],
  areas: [{ id: "mixed-destination", matchAll: true }],
  forward: { sendDelayMs: 0, retries: 0 },
}), () => {});
const mixedDownloadTypes = [];
mixedMediaForwarder.download = async (_url, mediaType) => {
  mixedDownloadTypes.push(mediaType);
  return path.join(os.tmpdir(), `zalosale-${mediaType}-${Date.now()}-${mixedDownloadTypes.length}.jpg`);
};
await mixedMediaForwarder.forwardPayload({
  threadId: "mixed-source",
  source: "manual",
  items: [
    { data: { normalUrl: "https://photo.example.test/one.jpg" } },
    { data: { normalUrl: "https://photo.example.test/two.jpg" } },
    videoItem,
  ],
});
assertEq("ảnh trước video vẫn ở chung một album", mixedMediaApi._sent[0]?.msg.attachments.length, 2);
assertEq("album ảnh không chứa video", mixedMediaApi._sent[0]?.msg.attachments.some((file) => file.endsWith(".mp4")), false);
assertEq("không còn gọi video native", mixedNativeVideos.length, 0);
assertEq("video được tải dạng file sau ảnh", mixedDownloadTypes.join(","), "image,image,video");
assertEq("video file gửi sau album ảnh", mixedMediaApi._sent.length, 2);
assertEq("album ảnh được gửi trước video theo thứ tự nguồn", mixedMediaSendOrder.join(","), "images,images");
const { default: sharp } = await import("sharp");
const shrinkFw = new Forwarder(makeApi(), parseConfig({
  sourceGroups: ["shrink-source"],
  areas: [{ id: "shrink-destination", matchAll: true }],
  forward: { sendDelayMs: 0, retries: 0, imageMaxDim: 1600, imageQuality: 80 },
}), () => {});
const bigFile = path.join(os.tmpdir(), `zalosale-shrink-big-${Date.now()}.jpg`);
await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 100, b: 50 } } }).jpeg({ quality: 95 }).toFile(bigFile);
const bigBefore = fs.statSync(bigFile).size;
await shrinkFw.shrinkImage(bigFile, "jpg");
const bigMeta = await sharp(bigFile).metadata();
assertEq("ảnh lớn được thu cạnh dài về 1600", Math.max(bigMeta.width, bigMeta.height) <= 1600, true);
assertEq("ảnh sau nén nhẹ hơn", fs.statSync(bigFile).size < bigBefore, true);
const smallFile = path.join(os.tmpdir(), `zalosale-shrink-small-${Date.now()}.jpg`);
await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg({ quality: 95 }).toFile(smallFile);
const smallBefore = fs.statSync(smallFile).size;
await shrinkFw.shrinkImage(smallFile, "jpg");
assertEq("ảnh nhỏ giữ nguyên", fs.statSync(smallFile).size === smallBefore, true);
const noShrinkFw = new Forwarder(makeApi(), parseConfig({
  sourceGroups: ["shrink-source"],
  areas: [{ id: "shrink-destination", matchAll: true }],
  forward: { sendDelayMs: 0, retries: 0, imageMaxDim: 0 },
}), () => {});
await noShrinkFw.shrinkImage(bigFile, "jpg");
assertEq("imageMaxDim 0 thì tắt nén", fs.statSync(bigFile).size < bigBefore, true);
fs.rmSync(bigFile, { force: true });
fs.rmSync(smallFile, { force: true });
assertEq(
  "bỏ album ảnh chồng lên cụm tòa ngay trước đó",
  isRepeatedPhotoOnlyCluster([
    { tid: "source", ts: 1000, clean: "Mã tòa TR023", photoUrls: ["a", "b", "c", "d"] },
  ], "source", "", ["a", "b", "c", "d"], 1500),
  true,
);
assertEq(
  "không bỏ album khác thật sự",
  isRepeatedPhotoOnlyCluster([
    { tid: "source", ts: 1000, clean: "Mã tòa TR023", photoUrls: ["a", "b", "c", "d"] },
  ], "source", "", ["x", "y", "z"], 1500),
  false,
);

/* ---------------- report ---------------- */
console.log("\n========================================");
console.log(`KẾT QUẢ: ${pass} PASS, ${fail} FAIL, tổng ${pass + fail} case`);
if (failures.length) {
  console.log("Danh sách FAIL:");
  for (const f of failures) console.log(`  ✗ ${f.name} — ${f.detail}`);
  process.exit(1);
} else {
  console.log("TẤT CẢ PASS ✓");
}
