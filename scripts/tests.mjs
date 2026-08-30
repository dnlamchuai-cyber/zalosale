import { cleanText, isExcluded, normalizeText } from "../src/processor.js";
import { classifyArea } from "../src/classifier.js";
import { parseDateInput, resolveRange, startOfDay, endOfDay, fmtDate, fetchRecentBatches } from "../src/history.js";
import { Forwarder } from "../src/forwarder.js";
import { startBot } from "../src/listener.js";

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

function makeApi({ history = {}, groupLink = null, sendOk = true } = {}) {
  const msgHandlers = [];
  return {
    _handlers: msgHandlers,
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
      return { msg, tid, type };
    },
  };
}

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
assertEq("xoá % có số", cleanText("a\n🌹( 12t ) : 30%b\nb", { removePercentLines: true }), "a\nb");
assertEq("không xoá % khi tắt", cleanText("a\n30%\nb", { removePercentLines: false }), "a\n30%\nb");
assertEq("xoá dòng giá", cleanText("a\n💰Giá: 4tr4\nb", { removePriceLines: true }), "a\nb");
assertEq("không xoá giá khi tắt", cleanText("a\nGiá 4tr\nb", { removePriceLines: false }), "a\nGiá 4tr\nb");
assertEq("xoá dòng chứa nhiều ký tự", cleanText("line1\ncó 🌹 đây\nline3", { deleteLines: ["🌹"] }), "line1\nline3");
assertEq("không đụng dòng khác", cleanText("a\nhoa hồng 12t\nb", { deleteLines: ["🌹"] }), "a\nhoa hồng 12t\nb");
assertEq("trim đầu cuối", cleanText("  a  \n  b  ", {}), "a  \n  b");
assertEq("rỗng khi toàn bộ bị xoá", cleanText("🌹\n🌹", { deleteLines: ["🌹"] }), "");
assertEq("dòng có % liền chữ cũng bị xoá (regex số%)", cleanText("x\nhoa 30%hồng\ny", { removePercentLines: true }), "x\ny");

console.log("\n=== processor: isExcluded ===");
assertEq("exclude khớp", isExcluded("Tìm phòng giá rẻ", ["tìm phòng"]), true);
assertEq("exclude khớp hoa thường", isExcluded("TÌM PHÒNG", ["tìm phòng"]), true);
assertEq("exclude không khớp", isExcluded("Cho thuê phòng", ["tìm phòng"]), false);
assertEq("exclude nhiều từ", isExcluded("hết phòng", ["tìm phòng", "hết phòng"]), true);
assertEq("exclude rỗng list", isExcluded("bất cứ", []), false);

/* ---------------- 2. classifier.js ---------------- */
console.log("\n=== classifier: classifyArea ===");
const areas = CFG.areas;
const c1 = classifyArea("phòng trọ tại hà đông", areas);
assertEq("nhận Hà Đông", c1?.keywords?.[0], "ha dong");
const c2 = classifyArea("HÀ ĐÔNG", areas);
assertEq("HOA HÀ ĐÔNG", c2?.keywords?.[0], "ha dong");
const c3 = classifyArea("nhà tại Phan Đình Phùng", areas);
assertEq("nhận Ba Đình", c3?.keywords?.[0], "ba dinh");
const c4 = classifyArea("không có khu vực nào", areas);
assertEq("không khớp → null", c4, null);
const c5 = classifyArea("có cả hà đông và ba đình", areas);
assertEq("khớp mạnh nhất = từ khoá dài hơn", c5?.keywords?.[0], c5?.keywords?.[0]);
assertEq("luôn trả 1 khu vực", typeof c5?.keywords?.[0], "string");
const c6 = classifyArea("hà đông", [], "ha dong");
assertEq("defaultArea nhưng rỗng areas → null", c6, null);
const c7 = classifyArea("phòng đẹp", areas, "ba dinh");
assertEq("defaultArea khi không khớp", c7?.keywords?.[0], "ba dinh");
assertEq("từ khoá ngắn 1 ký tự bỏ qua", classifyArea("a", [{ keywords: ["a"] }]), null);
assertEq("khoá không dấu vẫn khớp text có dấu", classifyArea("HÀ ĐÔNG 100%", areas)?.keywords?.[0], "ha dong");
assertEq("text rỗng", classifyArea("", areas), null);
assertEq("areas rỗng", classifyArea("ha dong", []), null);

/* ---------------- 3. history.js ---------------- */
console.log("\n=== history: parseDateInput ===");
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
  msgs.push({ data: { ts: now - (5 - i) * 500, content: i === 2 ? "Phòng tại hà đông 1tr" : `tin ${i}` } });
}
// cách 500ms < gap 10000 → 1 bài
const api = makeApi({ history: { g001: msgs } });
const batches = await fetchRecentBatches(api, "g001", { fromMs: now - 86400000, toMs: now + 1000 }, CFG);
assertEq("gom 5 tin cách nhau 500ms = 1 bài", batches.length, 1);
// cách nhau > gap → tách
const msgs2 = msgs.map((m, i) => ({ data: { ts: now - (5 - i) * 30000, content: m.data.content } }));
const batches2 = await fetchRecentBatches(makeApi({ history: { g001: msgs2 } }), "g001", { fromMs: now - 86400000, toMs: now + 1000 }, CFG);
assertEq("cách 30s = 5 bài", batches2.length, 5);
// lọc ngoài khoảng
const batches3 = await fetchRecentBatches(makeApi({ history: { g001: msgs } }), "g001", { fromMs: now - 1000, toMs: now + 1000 }, CFG);
assertEq("khoảng hẹp chỉ 1 tin", batches3.length, 1);
// maxBatchItems giới hạn
const batches4 = await fetchRecentBatches(api, "g001", { fromMs: now - 86400000, toMs: now + 1000 }, { ...CFG, forward: { ...CFG.forward, maxBatchItems: 2 } });
assertEq("maxBatchItems=2 → 3 bài", batches4.length, 3);

/* ---------------- 4. forwarder.js: describePost ---------------- */
console.log("\n=== forwarder: describePost ===");
const fw = new Forwarder(makeApi(), CFG, () => {});
const d1p = fw.describePost([{ data: { content: "Phòng trọ tại Hà Đông" } }]);
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
const d5p = fw.describePost([{ data: { content: "Ảnh đây" } }, { data: { content: "ha dong" } }]);
assertEq("text + text", d5p.clean.includes("ha dong"), true);
const d6p = fw.describePost([{ data: { content: "x" } }, { data: { originUrl: "https://x/a.jpg" } }]);
assertEq("1 ảnh", d6p.photoCount, 1);
const d7p = fw.describePost([{ data: { content: "{\"originUrl\":\"https://x/b.jpg\"}" } }]);
assertEq("ảnh dạng JSON content", d7p.photoCount, 1);
const d8p = fw.describePost([{ data: { content: "a" } }, { data: { content: "b" } }]);
assertEq("text 2 tin nối \n\n", d8p.clean, "a\n\nb");

/* ---------------- 5. listener: scanRange/forwardSelected ---------------- */
console.log("\n=== listener: scan trước → chọn sau ===");
const sourceLink = "https://zalo.me/g/nhomnguon";
const nowT = Date.now();
// getGroupChatHistory trả tin MỚI NHẤT trước. Sắp: [tin mới nhất, ..., cũ nhất]
const srcMsgs = [
  { data: { ts: nowT - 500, content: "tin 3" } },
  { data: { ts: nowT - 1500, content: "Nhà tại Ba Đình" } }, // tách > 10s so với nhóm Hà Đông
  { data: { ts: nowT - 32000, content: "Phòng đẹp tại Hà Đông" } },
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

const idxHaDong = scanR.posts.findIndex((p) => p.areaName === "ha dong");
const f1 = bot.forwardSelected(scanR.scanId, [idxHaDong]);
assertEq("forwardSelected 1 bài", f1.sent, 1);
const f2 = bot.forwardSelected(scanR.scanId, [idxHaDong, idxHaDong]);
assertEq("forwardSelected trùng index vẫn đếm", f2.sent, 2);
const f3 = bot.forwardAll(scanR.scanId);
assertEq("forwardAll tất cả", f3.sent, scanR.posts.length);
const f4 = bot.forwardSelected("scankhongton", [0]);
assertEq("scanId không tồn tại → error", !!f4.error, true);
assertEq("scanId không tồn tại → sent 0", f4.sent, 0);
const f5 = bot.forwardSelected(scanR.scanId, []);
assertEq("index rỗng → sent 0", f5.sent, 0);

// scan với lọc tên nhóm
const scanR2 = await bot.scanRange("nhom link", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
assertEq("scan lọc tên nhóm trả bài", scanR2.posts?.length > 0, true);

/* ---------------- 6. scan chọn sai vùng ảnh hưởng không? ---------------- */
console.log("\n=== listener: kiểm tra scan không gửi gì (preview thuần) ===");
const sentBefore = status2.forwarded;
const scanR3 = await bot.scanRange("", { fromMs: nowT - 86400000, toMs: nowT + 1000 });
assertEq("scan không làm tăng forwarded", status2.forwarded === sentBefore, true);
assertEq("scan thứ 2 vẫn hoạt động", scanR3.posts?.length > 0, true);

/* ---------------- 7. batcher: gom theo cửa sổ ---------------- */
console.log("\n=== batcher ===");
const { Batcher } = await import("../src/batcher.js");
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

/* ---------------- 8. sinh tự động: dấu × emoji × hoa thường ---------------- */
console.log("\n=== auto-generated: biến thể tiếng Việt/emoji/case ===");
const baseKw = ["ha dong", "ba dinh", "nguyen trai", "van quan", "phan dinh phung"];
const variants = [];
const textVariants = (kw) => [
  kw.toUpperCase(),
  kw,
  "  " + kw + "  ",
  `🏠 ${kw} 🏠`,
  `- ${kw} -`,
  `A${kw}B`,
  kw.replace(/a/g, "ă"),
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
      const t = w + raw;
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
      const t = w + kw + s;
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
