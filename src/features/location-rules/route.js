// Ai viết: Muse Spark | Tại sao: mỏng ở route, logic nằm ở service để test không cần HTTP
// Link SPEC: yêu cầu "Kho địa danh Hà Nội" ngày 2026-09-11
import {
  LocationRuleSchema, UpdateLocationRuleSchema, OsmImportPreviewSchema,
} from "./schema.js";
import {
  listRules, createRule, updateRule, deleteRule,
  previewOsmImport, applyOsmPreview, ensureRoutingKeys,
} from "./service.js";
import { RULES_PATH } from "./repository.js";

const errMsg = (e) => e.errors?.[0]?.message || e.message || "Lỗi không xác định";

export function locationRulesRoutes(app, getConfig) {
  app.get("/api/location-rules", (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const rules = listRules(RULES_PATH).filter((r) =>
      !q || r.name.toLowerCase().includes(q) || (r.note || "").toLowerCase().includes(q));
    res.json({ ok: true, attribution: "© OpenStreetMap contributors (ODbL)", rules, areas: ensureRoutingKeys(getConfig().areas) });
  });

  app.post("/api/location-rules", (req, res) => {
    try {
      const parsed = LocationRuleSchema.parse(req.body);
      const areas = ensureRoutingKeys(getConfig().areas);
      const unknown = parsed.routingKeys.filter((k) => !areas.some((a) => a.routingKey === k));
      if (unknown.length) return res.status(400).json({ ok: false, error: `Nhóm đích không tồn tại: ${unknown.join(", ")}` });
      const { rule } = createRule(parsed, RULES_PATH);
      res.json({ ok: true, rule });
    } catch (e) {
      res.status(400).json({ ok: false, error: errMsg(e) });
    }
  });

  app.put("/api/location-rules/:id", (req, res) => {
    try {
      const parsed = UpdateLocationRuleSchema.parse({ ...req.body, id: req.params.id });
      const { id, ...patch } = parsed;
      const { rule } = updateRule(id, patch, RULES_PATH);
      res.json({ ok: true, rule });
    } catch (e) {
      res.status(400).json({ ok: false, error: errMsg(e) });
    }
  });

  app.delete("/api/location-rules/:id", (req, res) => {
    try {
      const store = deleteRule(String(req.params.id), RULES_PATH);
      res.json({ ok: true, total: store.rules.length });
    } catch (e) {
      res.status(400).json({ ok: false, error: errMsg(e) });
    }
  });

  // Preview OSM trước khi lưu — chỉ chạy khi user bấm nút
  app.post("/api/location-rules/osm-preview", async (req, res) => {
    try {
      const parsed = OsmImportPreviewSchema.parse(req.body);
      const data = await previewOsmImport(parsed.routingKeys);
      res.json({ ok: true, ...data });
    } catch (e) {
      res.status(400).json({ ok: false, error: errMsg(e) });
    }
  });

  app.post("/api/location-rules/osm-import", (req, res) => {
    try {
      const preview = Array.isArray(req.body?.preview) ? req.body.preview : null;
      if (!preview) return res.status(400).json({ ok: false, error: "Thiếu preview từ bước xem trước" });
      for (const row of preview) LocationRuleSchema.parse({ ...row, enabled: true, note: "" });
      const { added, skipped } = applyOsmPreview(preview, RULES_PATH);
      res.json({ ok: true, added, skipped });
    } catch (e) {
      res.status(400).json({ ok: false, error: errMsg(e) });
    }
  });
}
