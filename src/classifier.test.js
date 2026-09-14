// AI: Codex
// WHY: Prove catch-all routing and delivery using synthetic destinations, without Zalo access.
// SPEC: docs/03_SPEC/SPEC-003.md
import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyAreas, classifyAreasDetailed, detectHanoiDistrict, findAreaMatch } from "./classifier.js";
import { parseConfig } from "./config.js";
import { Forwarder } from "./forwarder.js";
import { Batcher } from "./batcher.js";

const district = { id: "district", keywords: ["ha dong"] };
const aggregate = { id: "aggregate", keywords: [], matchAll: true };
const ids = (areas) => areas.map((area) => area.id);
const items = (content) => [{ data: { content } }];

test("catch-all receives matching and unmatched posts alongside keyword destinations", () => {
  assert.deepEqual(ids(classifyAreas("Địa chỉ: Hà Đông", [aggregate, district])), ["district", "aggregate"]);
  assert.deepEqual(ids(classifyAreas("Phòng đẹp", [district, aggregate])), ["aggregate"]);
  assert.deepEqual(ids(classifyAreas("", [aggregate])), ["aggregate"]);
  assert.deepEqual(classifyAreas("Phòng đẹp", [{ keywords: [] }]), []);
});

test("catch-all does not route a post without an address or apply stale price rules", () => {
  assert.deepEqual(ids(classifyAreas("Phòng đẹp", [district, aggregate], "ha dong")), ["aggregate"]);
  const staleRules = { ...aggregate, keywords: ["ba dinh"], priceCondition: { operator: "<", value: 1 } };
  assert.deepEqual(ids(classifyAreas("Địa chỉ: Hà Đông\nGiá 5tr", [staleRules])), ["aggregate"]);
});

test("config accepts explicit boolean catch-all and rejects ambiguous values", () => {
  assert.equal(parseConfig({ sourceGroups: ["source"], areas: [aggregate] }).areas[0].matchAll, true);
  for (const matchAll of ["true", "false", 1, null]) {
    assert.throws(() => parseConfig({ sourceGroups: ["source"], areas: [{ ...aggregate, matchAll }] }), /matchAll/);
  }
});

function setup(areas = [district, aggregate], overrides = {}) {
  const sent = [];
  const config = parseConfig({ sourceGroups: ["source"], areas: structuredClone(areas), forward: { sendDelayMs: 0, skipTextOnly: false }, ...overrides });
  const forwarder = new Forwarder({ sendMessage: async (_message, id) => { sent.push(id); } }, config);
  return { forwarder, sent };
}

test("preview and delivery include aggregate even for inherited destinations", async () => {
  const { forwarder, sent } = setup();
  const post = items("Phòng 301 giá 3tr");
  assert.deepEqual(ids(forwarder.describePost(post, [district]).destinations), ["district", "aggregate"]);
  assert.deepEqual(forwarder.describePost(items("Phòng đẹp")).destinationNames, ["Tất cả bài viết"]);
  await forwarder.forwardPayload({ threadId: "source", source: "test", items: post, inheritedDestinations: [district] });
  assert.deepEqual(sent, ["district", "aggregate"]);
});

test("same destination receives only one copy when both rules match", async () => {
  const { forwarder, sent } = setup([district, { ...aggregate, id: district.id }]);
  await forwarder.forwardPayload({ threadId: "source", source: "test", items: items("Địa chỉ: Hà Đông") });
  assert.deepEqual(sent, ["district"]);
});

test("global exclusions still apply to catch-all", async () => {
  const { forwarder, sent } = setup([aggregate], { excludeKeywords: ["het phong"] });
  await forwarder.forwardPayload({ threadId: "source", source: "test", items: items("Hết phòng") });
  assert.deepEqual(sent, []);
});

test("catch-all does not split a building when a long room detail has no district keyword", () => {
  function batches(areas) {
    const batcher = new Batcher({ areas, windowMs: 3000, maxBatchItems: 20, maxWaitMs: 120000 });
    const emitted = [];
    batcher.on("batch", (batch) => emitted.push(batch));
    batcher.add("source", items("Địa chỉ Hà Đông, nội thất đầy đủ, có ban công.")[0]);
    batcher.add("source", items("Nội thất gồm bàn ghế, tủ lạnh và máy giặt riêng cho khách thuê.")[0]);
    batcher.flushAll();
    return emitted.map((batch) => ({ items: batch.items, context: batch.buildingContextId, destinations: ids(batch.inheritedDestinations) }));
  }
  assert.deepEqual(batches([district, aggregate]), batches([district]));
});

test("routes an explicitly nearby district even without a formal address line", () => {
  const cauGiay = { id: "cau-giay", keywords: ["cau giay"] };
  const hoangMai = { id: "hoang-mai", keywords: ["hoang mai"] };
  const hoanKiem = { id: "hoan-kiem", keywords: ["hoan kiem"] };
  const text = [
    "Địa chỉ: Số 143 Nguyễn Chính, Quận Hoàng Mai, Hà Nội",
    "Tiện ích: thang máy, phòng gần Cầu Giấy",
  ].join("\n");

  assert.deepEqual(ids(classifyAreas(text, [cauGiay, hoangMai, hoanKiem])), ["cau-giay", "hoang-mai"]);
  assert.equal(findAreaMatch(text, cauGiay), null);
  assert.equal(detectHanoiDistrict(text)?.district, "Hoàng Mai");
  assert.deepEqual(ids(classifyAreas("Phòng gần Cầu Giấy, thang máy", [cauGiay, hoanKiem])), ["cau-giay"]);
  assert.deepEqual(ids(classifyAreas(
    "Địa chỉ: Quận Hoàng Mai\nTiện ích: có xe buýt đi Cầu Giấy",
    [cauGiay, hoangMai],
  )), ["cau-giay", "hoang-mai"]);
  assert.deepEqual(ids(classifyAreas("Tòa nhà có trạm xe buýt", [cauGiay])), []);
});

test("recognizes Hoài Đức and Hòa Lạc from an address or explicit nearby description", () => {
  const hoaiDuc = { id: "hoai-duc", keywords: ["hoai duc"] };
  const hoaLac = { id: "hoa-lac", keywords: ["hoa lac"] };

  assert.deepEqual(
    ids(classifyAreas("Địa chỉ: KĐT An Khánh, Hoài Đức, Hà Nội", [hoaiDuc, hoaLac])),
    ["hoai-duc"],
  );
  assert.deepEqual(
    ids(classifyAreas("Địa chỉ: Khu công nghệ cao Hòa Lạc, Hà Nội", [hoaiDuc, hoaLac])),
    ["hoa-lac"],
  );
  assert.equal(detectHanoiDistrict("Địa chỉ: An Khánh, Hoài Đức")?.district, "Hoài Đức");
  assert.equal(detectHanoiDistrict("Địa chỉ: Hòa Lạc, Hà Nội")?.district, "Hòa Lạc");
  assert.deepEqual(ids(classifyAreas("Tiện ích: gần Hòa Lạc", [hoaLac])), ["hoa-lac"]);
});

test("routes address titles written without an explicit Địa chỉ label", () => {
  const areas = [
    { id: "cau-giay", routingKey: "cau-giay", keywords: ["cau giay"] },
    { id: "thanh-xuan", routingKey: "thanh-xuan", keywords: ["thanh xuan"] },
    { id: "hoang-mai", routingKey: "hoang-mai", keywords: ["hoang mai"] },
    { id: "hai-ba-trung", routingKey: "hai-ba-trung", keywords: ["hai ba trung"] },
  ];
  const rules = [
    { normalizedName: "minh khai", routingKeys: ["hai-ba-trung"], enabled: true },
    { normalizedName: "nguyen xien", routingKeys: ["thanh-xuan", "hoang-mai"], enabled: true },
  ];

  assert.deepEqual(
    ids(classifyAreasDetailed("🌹30 - H168\n381/64 Nguyễn Khang - Cầu Giấy", areas, null, rules).destinations),
    ["cau-giay"],
  );
  assert.deepEqual(
    ids(classifyAreasDetailed("Cho thuê căn hộ Green Pearl, Minh Khai", areas, null, rules).destinations),
    ["hai-ba-trung"],
  );
  assert.deepEqual(
    ids(classifyAreasDetailed("Cho thuê nhà mặt phố Nguyễn Xiển, Thanh Xuân", areas, null, rules).destinations),
    ["thanh-xuan"],
  );
});
