// Ai viết: Muse Spark | Tại sao: khóa hành vi kho địa danh theo đúng spec 2026-09-11
// Link SPEC: yêu cầu "Kho địa danh Hà Nội & định tuyến nhiều nhóm"
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classifyAreasDetailed, extractAddressText } from "../../classifier.js";
import {
  ensureRoutingKeys, matchRules, previewOsmImport, applyOsmPreview,
  createRule, updateRule, aliasRules,
} from "./service.js";
import { loadRules } from "./repository.js";

const areas = ensureRoutingKeys([
  { id: "a", keywords: ["thanh xuan"] },
  { id: "b", keywords: ["nam tu liem"] },
  { id: "c", keywords: ["tay ho"] },
  { id: "d", keywords: ["cau giay"] },
  { id: "e", keywords: ["ba dinh"] },
]);
const keys = Object.fromEntries(areas.map((a) => [a.keywords[0].replace(/ /g, "-"), a.routingKey]));

const rules = [
  { id: "r1", name: "Giáp Nhất", normalizedName: "giap nhat", type: "duong", routingKeys: [keys["thanh-xuan"]], enabled: true, source: "manual", note: "", updatedAt: 1 },
  { id: "r2", name: "Khương Đình", normalizedName: "khuong dinh", type: "phuong", routingKeys: [keys["thanh-xuan"]], enabled: true, source: "manual", note: "", updatedAt: 1 },
  { id: "r3", name: "Đình Thôn", normalizedName: "dinh thon", type: "duong", routingKeys: [keys["nam-tu-liem"]], enabled: true, source: "manual", note: "", updatedAt: 1 },
  { id: "r4", name: "Thụy Khuê", normalizedName: "thuy khue", type: "duong", routingKeys: [keys["tay-ho"], keys["ba-dinh"]], enabled: true, source: "manual", note: "", updatedAt: 1 },
  { id: "r5", name: "Đội Cấn", normalizedName: "doi can", type: "duong", routingKeys: [keys["ba-dinh"]], enabled: true, source: "manual", note: "", updatedAt: 1 },
  { id: "r6", name: "Bưởi", normalizedName: "buoi", type: "phuong", routingKeys: [keys["tay-ho"]], enabled: true, source: "manual", note: "", updatedAt: 1 },
  { id: "r7", name: "Lạc Long Quân", normalizedName: "lac long quan", type: "duong", routingKeys: [keys["tay-ho"]], enabled: true, source: "manual", note: "", updatedAt: 1 },
];

test("bắt dòng địa chỉ mới: emoji, Ngõ/Đường/Phố/Số/KĐT/Chung cư/Hẻm", () => {
  assert.ok(extractAddressText("📍 Địa chỉ: Hẻm 4, ngách 29, ngõ 213 Giáp Nhất").includes("Giáp Nhất"));
  assert.ok(extractAddressText("🏠 NGÕ 236/8 KHƯƠNG ĐÌNH – 1N1K").includes("KHƯƠNG"));
  assert.ok(extractAddressText("Địa chỉ : Số 8 Đình Thôn - Mỹ Đình").includes("Đình Thôn"));
  assert.ok(extractAddressText("Ngõ 167 Thụy Khuê, Tây Hồ").includes("Thụy Khuê"));
  assert.equal(extractAddressText("Phòng đẹp, gần trường học"), "");
});

test("ưu tiên quận ghi rõ: đường giáp 2 quận chỉ đi quận được nêu", () => {
  const hd = { id: "f", keywords: ["ha dong"], routingKey: "ha-dong" };
  const areasPlusHD = [...areas, hd];
  const rulesPlusStreets = [...rules,
    { id: "r8", name: "Lê Văn Lương", normalizedName: "le van luong", type: "duong", routingKeys: [keys["thanh-xuan"], "ha-dong"], enabled: true, source: "manual", note: "", updatedAt: 1 },
    { id: "r9", name: "Nguyễn Trãi", normalizedName: "nguyen trai", type: "duong", routingKeys: [keys["thanh-xuan"], "ha-dong"], enabled: true, source: "manual", note: "", updatedAt: 1 },
  ];
  const only = (r) => r.destinations.map((d) => d.routingKey).sort();
  // Ghi rõ Hà Đông → chỉ Hà Đông
  assert.deepEqual(only(classifyAreasDetailed("📍 Lê Văn Lương, Hà Đông", areasPlusHD, null, rulesPlusStreets)), ["ha-dong"]);
  assert.deepEqual(only(classifyAreasDetailed("Địa chỉ: Nguyễn Trãi, Thanh Xuân", areasPlusHD, null, rulesPlusStreets)), [keys["thanh-xuan"]]);
  // Không ghi quận → giữ cả 2 như cũ
  assert.deepEqual(only(classifyAreasDetailed("Địa chỉ: Lê Văn Lương", areasPlusHD, null, rulesPlusStreets)), ["ha-dong", keys["thanh-xuan"]]);
  // Phường đặc trưng cũng tính: Nhân Chính chỉ ở Thanh Xuân
  assert.deepEqual(only(classifyAreasDetailed("Địa chỉ: Nguyễn Trãi, Nhân Chính", areasPlusHD, null, rulesPlusStreets)), [keys["thanh-xuan"]]);
  // Gần vẫn cộng thêm, không bị cắt
  assert.deepEqual(
    only(classifyAreasDetailed("Địa chỉ: Lê Văn Lương, Hà Đông. Tiện ích gần Cầu Giấy", areasPlusHD, null, rulesPlusStreets)),
    ["ha-dong", keys["cau-giay"]].sort(),
  );
});

test("địa chỉ nằm giữa dòng rao: Cho thuê nhà ngõ 172 Xuân Đỉnh → Bắc Từ Liêm", () => {
  const text = "Cho thuê nhà ngõ 172 Xuân Đỉnh Bắc Từ Liêm.Ô Tô đỗ ngày đêm\n- Diện tích: 45m2 x 5 tầng.";
  assert.ok(extractAddressText(text).includes("Xuân Đỉnh"));
  const areasPlusBTL = [...areas, { id: "f", keywords: ["bac tu liem"], routingKey: "bac-tu-liem" }];
  const rulesPlusBTL = [...rules, { id: "r8", name: "Xuân Đỉnh", normalizedName: "xuan dinh", type: "phuong", routingKeys: ["bac-tu-liem"], enabled: true, source: "manual", note: "", updatedAt: 1 }];
  const r = classifyAreasDetailed(text, areasPlusBTL, null, rulesPlusBTL);
  assert.deepEqual(r.destinations.map((d) => d.routingKey), ["bac-tu-liem"]);
  assert.equal(r.reason, "dia-chi");
});

test("dòng rao có số nhà nhận diện được địa danh đã có rule", () => {
  const text = "Cho thuê phòng đơn 281 Bùi Xương Trạch";
  const rulesPlusBuiXuongTrach = [...rules, {
    id: "r10", name: "Bùi Xương Trạch", normalizedName: "bui xuong trach", type: "duong",
    routingKeys: [keys["thanh-xuan"]], enabled: true, source: "manual", note: "", updatedAt: 1,
  }];
  assert.ok(extractAddressText(text).includes("Bùi Xương Trạch"));
  assert.deepEqual(
    classifyAreasDetailed(text, areas, null, rulesPlusBuiXuongTrach).destinations.map((area) => area.routingKey),
    [keys["thanh-xuan"]],
  );
});

test("dòng bắt đầu bằng số nhà cũng được coi là địa chỉ", () => {
  const text = "84 Trần Quang Diệu\nFull nội thất";
  const areasPlusDongDa = [...areas, { id: "f", keywords: ["dong da"], routingKey: "dong-da" }];
  const rulesPlusTranQuangDieu = [...rules, {
    id: "r11", name: "Trần Quang Diệu", normalizedName: "tran quang dieu", type: "duong",
    routingKeys: ["dong-da"], enabled: true, source: "manual", note: "", updatedAt: 1,
  }];
  assert.ok(extractAddressText(text).includes("Trần Quang Diệu"));
  assert.deepEqual(
    classifyAreasDetailed(text, areasPlusDongDa, null, rulesPlusTranQuangDieu).destinations.map((area) => area.routingKey),
    ["dong-da"],
  );
});

test("định tuyến ví dụ user: Giáp Nhất/Khương Đình → Thanh Xuân, Đình Thôn → Nam Từ Liêm", () => {
  const r1 = classifyAreasDetailed("📍 Địa chỉ: Hẻm 4, ngách 29, ngõ 213 Giáp Nhất", areas, null, rules);
  assert.deepEqual(r1.destinations.map((d) => d.routingKey), [keys["thanh-xuan"]]);
  assert.equal(r1.reason, "dia-chi");
  const r2 = classifyAreasDetailed("🏠 NGÕ 236/8 KHƯƠNG ĐÌNH – 1N1K 35M²", areas, null, rules);
  assert.deepEqual(r2.destinations.map((d) => d.routingKey), [keys["thanh-xuan"]]);
  const r3 = classifyAreasDetailed("🏠Địa chỉ : Số 8 Đình Thôn - Mỹ Đình 1 - Nam Từ Liêm", areas, null, rules);
  assert.deepEqual(r3.destinations.map((d) => d.routingKey), [keys["nam-tu-liem"]]);
});

test("một đường nhiều nhóm: Thụy Khuê → Tây Hồ + Ba Đình", () => {
  const r = classifyAreasDetailed("Địa chỉ: Ngõ 167 Thụy Khuê", areas, null, rules);
  assert.deepEqual(r.destinations.map((d) => d.routingKey).sort(), [keys["ba-dinh"], keys["tay-ho"]].sort());
});

test("emoji/không dấu + tên ngắn: Đội Cấn, Bưởi, Lạc Long Quân", () => {
  assert.deepEqual(classifyAreasDetailed("📍 Dia chi: Doi Can", areas, null, rules).destinations.map((d) => d.routingKey), [keys["ba-dinh"]]);
  assert.deepEqual(classifyAreasDetailed("Địa chỉ: Bưởi", areas, null, rules).destinations.map((d) => d.routingKey), [keys["tay-ho"]]);
  assert.deepEqual(classifyAreasDetailed("📌 Lạc Long Quân, Tây Hồ", areas, null, rules).destinations.map((d) => d.routingKey), [keys["tay-ho"]]);
});

test("giữ tín hiệu gần + xe buýt, bỏ câu nhắc quận không phải vị trí", () => {
  const near = classifyAreasDetailed("Phòng gần Cầu Giấy, thang máy", areas, null, rules);
  assert.deepEqual(near.destinations.map((d) => d.routingKey), [keys["cau-giay"]]);
  assert.equal(near.reason, "gan");
  const bus = classifyAreasDetailed("Địa chỉ: Quận Hoàng Mai\nTiện ích: có xe buýt đi Cầu Giấy", areas, null, rules);
  assert.ok(bus.destinations.some((d) => d.routingKey === keys["cau-giay"]));
  assert.equal(bus.reason, "xe-buyt");
  const noPos = classifyAreasDetailed("Tòa nhà có trạm xe buýt", areas, null, rules);
  assert.deepEqual(noPos.destinations, []);
  assert.equal(noPos.undetermined, true);
});

test("chưa xác định: không tự gửi, giữ ở bảng quét", () => {
  const r = classifyAreasDetailed("Phòng đẹp giá 3tr, full nội thất", areas, null, rules);
  assert.equal(r.undetermined, true);
  assert.equal(r.reason, null);
  assert.deepEqual(r.destinations, []);
});

test("rule thủ công cùng tên ghi đè rule OSM", () => {
  const mixed = [
    ...rules,
    { id: "osm1", name: "Giáp Nhất", normalizedName: "giap nhat", type: "duong", routingKeys: [keys["nam-tu-liem"]], enabled: true, source: "osm", note: "", updatedAt: 1 },
  ];
  const hit = matchRules("ngõ 213 Giáp Nhất", mixed);
  assert.deepEqual(hit.routingKeys, [keys["thanh-xuan"]]);
});

test("CRUD: trùng sau chuẩn hóa bị chặn, update trùng bị chặn", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "locrules-"));
  const p = path.join(dir, "rules.json");
  const { rule } = createRule({ name: "Phố Mới", type: "duong", routingKeys: [keys["tay-ho"]] }, p);
  assert.equal(loadRules(p).rules.length, 1);
  assert.throws(() => createRule({ name: "pho moi", type: "duong", routingKeys: [keys["tay-ho"]] }, p), /trùng/);
  const second = createRule({ name: "Phố Cũ", type: "duong", routingKeys: [keys["tay-ho"]] }, p).rule;
  assert.throws(() => updateRule(second.id, { name: "PHỐ MỚI" }, p), /trùng/);
  const renamed = updateRule(rule.id, { name: "Phố Mới 2" }, p).rule;
  assert.equal(renamed.name, "Phố Mới 2");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("alias migrate vào cùng luồng nhận diện", () => {
  const aliases = aliasRules([{ keywords: ["tay ho"], routingKey: keys["tay-ho"] }]);
  assert.ok(aliases.some((r) => r.name === "Bưởi" && r.source === "alias"));
});

test("OSM preview: gộp đường trùng nhiều khu vực, lỗi mạng báo từng khu vực, không ghi dở dang", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "locrules-osm-"));
  const p = path.join(dir, "rules.json");
  const fakeFetcher = async (label) => {
    if (label === "Cầu Giấy") return { district: label, names: ["Xuân Thủy", "Đường Chung"], error: null };
    if (label === "Tây Hồ") return { district: label, names: ["Đường Chung", "Lạc Long Quân"], error: null };
    return { district: label, names: [], error: "Timeout 25s" };
  };
  const { results, preview, total } = await previewOsmImport(["cau-giay", "tay-ho", "lach-quan"], fakeFetcher);
  assert.equal(results.find((r) => r.routingKey === "lach-quan").error, "Timeout 25s");
  const chung = preview.find((r) => r.name === "Đường Chung");
  assert.deepEqual(chung.routingKeys.sort(), ["cau-giay", "tay-ho"].sort());
  assert.equal(total, preview.length);
  assert.equal(loadRules(p).rules.length, 0); // preview không ghi gì
  // Lưu: manual cùng tên không bị thay thế
  createRule({ name: "Xuân Thủy", type: "duong", routingKeys: [keys["tay-ho"]] }, p);
  const applied = applyOsmPreview(preview, p);
  assert.equal(applied.added, preview.length - 1);
  assert.equal(applied.skipped, 1);
  const kept = loadRules(p).rules.find((r) => r.normalizedName === "xuan thuy");
  assert.equal(kept.source, "manual");
  fs.rmSync(dir, { recursive: true, force: true });
});
