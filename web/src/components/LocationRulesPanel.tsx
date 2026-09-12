// Ai viết: Muse Spark — màn quản lý kho địa danh local
// Tại sao: CRUD + import OSM có preview, rule tham chiếu routingKey ổn định
// Link: yêu cầu "Kho địa danh Hà Nội" ngày 2026-09-11

import { useEffect, useState } from "react";
import type { Area, LocationRule, LocationRuleType, OsmPreviewRow } from "../types";

const PAGE_SIZE = 20;
const RULE_TYPES: Array<{ value: LocationRuleType; label: string }> = [
  { value: "duong", label: "Đường" },
  { value: "ngo", label: "Ngõ" },
  { value: "phuong", label: "Phường" },
  { value: "dia-danh", label: "Địa danh" },
];
const SOURCE_LABELS: Record<string, string> = { manual: "Thủ công", osm: "OSM", alias: "Phường/Quận" };

async function request(path: string, options?: RequestInit) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function keyLabel(areas: Area[], key: string) {
  return areas.find((a) => a.routingKey === key)?.keywords?.join(", ") || key;
}

export function LocationRulesPanel({ areas = [] }: { areas?: Area[] }) {
  const [rules, setRules] = useState<LocationRule[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; k: "ok" | "err" } | null>(null);
  const [editing, setEditing] = useState<Partial<LocationRule> & { id?: string } | null>(null);
  const [osmKeys, setOsmKeys] = useState<string[]>([]);
  const [preview, setPreview] = useState<OsmPreviewRow[] | null>(null);
  const [osmErrors, setOsmErrors] = useState<Array<{ routingKey: string; error: string | null }>>([]);

  const load = async (q = query) => {
    const data = await request(`/api/location-rules?q=${encodeURIComponent(q)}`);
    setRules(data.rules || []);
  };

  useEffect(() => { load("").catch(() => {}); }, []);

  const search = async () => { setPage(0); await load().catch((e) => setMsg({ t: e.message, k: "err" })); };

  const saveEditing = async () => {
    if (!editing?.name?.trim()) { setMsg({ t: "Nhập tên địa danh", k: "err" }); return; }
    if (!editing.routingKeys?.length) { setMsg({ t: "Chọn ít nhất 1 nhóm đích", k: "err" }); return; }
    setBusy(true);
    try {
      const body = {
        name: editing.name.trim(),
        type: editing.type || "duong",
        routingKeys: editing.routingKeys,
        enabled: editing.enabled !== false,
        note: editing.note || "",
      };
      if (editing.id) await request(`/api/location-rules/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      else await request("/api/location-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setEditing(null);
      await load();
      setMsg({ t: "Đã lưu rule", k: "ok" });
    } catch (e) { setMsg({ t: (e as Error).message, k: "err" }); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Xóa rule này?")) return;
    await request(`/api/location-rules/${id}`, { method: "DELETE" }).catch((e) => setMsg({ t: e.message, k: "err" }));
    await load().catch(() => {});
  };

  const toggle = async (rule: LocationRule) => {
    await request(`/api/location-rules/${rule.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !rule.enabled }) }).catch((e) => setMsg({ t: e.message, k: "err" }));
    await load().catch(() => {});
  };

  const osmPreview = async () => {
    if (!osmKeys.length) { setMsg({ t: "Chọn ít nhất 1 khu vực để nhập OSM", k: "err" }); return; }
    setBusy(true);
    setPreview(null);
    try {
      const data = await request("/api/location-rules/osm-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routingKeys: osmKeys }) });
      setPreview(data.preview || []);
      setOsmErrors(data.results?.filter((r: { error: string | null }) => r.error).map((r: { routingKey: string; error: string }) => ({ routingKey: r.routingKey, error: r.error })) || []);
      setMsg({ t: `Xem trước ${data.total} tên đường — bấm Lưu để ghi vào kho`, k: "ok" });
    } catch (e) { setMsg({ t: (e as Error).message, k: "err" }); }
    finally { setBusy(false); }
  };

  const osmImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const data = await request("/api/location-rules/osm-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview }) });
      setPreview(null);
      setOsmKeys([]);
      await load();
      setMsg({ t: `Đã nhập ${data.added} rule mới, bỏ qua ${data.skipped} rule thủ công trùng tên`, k: "ok" });
    } catch (e) { setMsg({ t: (e as Error).message, k: "err" }); }
    finally { setBusy(false); }
  };

  const totalPages = Math.max(1, Math.ceil(rules.length / PAGE_SIZE));
  const current = Math.min(page, totalPages - 1);
  const pageRules = rules.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <div className="panel">
      <h2>Kho địa danh <span className="hint" style={{ margin: 0 }}>© OpenStreetMap contributors (ODbL) — local-first</span></h2>
      <div className="row">
        <label className="field">Tìm kiếm<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên đường, phường, ghi chú..." /></label>
        <button className="mini" onClick={search}>Tìm</button>
        <button className="mini primary" onClick={() => setEditing({ name: "", type: "duong", routingKeys: [], enabled: true, note: "" })}>+ Thêm rule</button>
        <span className="hint" style={{ margin: 0 }}>{rules.length} rule</span>
      </div>
      {msg && <div className={`note ${msg.k}`}>{msg.t}</div>}

      {editing && (
        <div className="panel" style={{ marginTop: 8 }} role="dialog" aria-label="Sửa rule địa danh">
          <div className="row">
            <label className="field">Tên địa danh<input type="text" value={editing.name || ""} maxLength={120} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="vd: Giáp Nhất, Đình Thôn" /></label>
            <label className="field">Loại<select value={editing.type || "duong"} onChange={(e) => setEditing({ ...editing, type: e.target.value as LocationRuleType })}>{RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
          </div>
          <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, marginTop: 8 }}>
            <legend style={{ fontSize: 12, fontWeight: 700 }}>Nhóm đích (chọn nhiều)</legend>
            {areas.filter((a) => a.routingKey).map((a) => (
              <label key={a.routingKey} style={{ display: "inline-flex", gap: 4, marginRight: 12, fontSize: 13 }}>
                <input type="checkbox" checked={editing.routingKeys?.includes(a.routingKey as string) || false} onChange={(e) => {
                  const keys = new Set(editing.routingKeys || []);
                  if (e.target.checked) keys.add(a.routingKey as string); else keys.delete(a.routingKey as string);
                  setEditing({ ...editing, routingKeys: [...keys] });
                }} />{a.keywords?.join(", ")}
              </label>
            ))}
          </fieldset>
          <div className="row" style={{ marginTop: 8 }}>
            <label className="field">Ghi chú<input type="text" value={editing.note || ""} maxLength={300} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></label>
            <label style={{ display: "inline-flex", gap: 4, fontSize: 13 }}><input type="checkbox" checked={editing.enabled !== false} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />Bật</label>
            <button className="mini primary" onClick={saveEditing} disabled={busy}>Lưu</button>
            <button className="mini" onClick={() => setEditing(null)}>Hủy</button>
          </div>
        </div>
      )}

      <table style={{ marginTop: 10 }}>
        <thead><tr><th>Tên</th><th>Loại</th><th>Nhóm đích</th><th>Nguồn</th><th>Bật</th><th></th></tr></thead>
        <tbody>
          {pageRules.map((r) => (
            <tr key={r.id} style={{ opacity: r.enabled ? 1 : 0.55 }}>
              <td style={{ fontSize: 13 }}>{r.name}</td>
              <td style={{ fontSize: 12 }}>{RULE_TYPES.find((t) => t.value === r.type)?.label || r.type}</td>
              <td style={{ fontSize: 12 }}>{r.routingKeys.map((k) => keyLabel(areas, k)).join(", ")}</td>
              <td><span className="badge">{SOURCE_LABELS[r.source] || r.source}</span></td>
              <td><input type="checkbox" aria-label={`Bật ${r.name}`} checked={r.enabled} onChange={() => toggle(r)} /></td>
              <td>
                <button className="mini" onClick={() => setEditing(r)}>Sửa</button>
                <button className="mini" onClick={() => remove(r.id)}>Xóa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager" aria-label="Phân trang kho địa danh">
        <button className="mini" disabled={current <= 0} onClick={() => setPage((v) => v - 1)}>‹ Trước</button>
        <span className="hint" style={{ margin: 0 }}>{current + 1} / {totalPages} ({rules.length} rule)</span>
        <button className="mini" disabled={current >= totalPages - 1} onClick={() => setPage((v) => v + 1)}>Sau ›</button>
      </div>

      <div className="divider" />
      <h3 style={{ fontSize: 14 }}>Nhập đường từ OpenStreetMap</h3>
      <p className="hint">Chỉ truy vấn tên đường công khai (highway + name), không gửi nội dung tin Zalo. Xem trước rồi mới lưu.</p>
      <div className="row">
        {areas.filter((a) => a.routingKey).map((a) => (
          <label key={a.routingKey} style={{ display: "inline-flex", gap: 4, fontSize: 13 }}>
            <input type="checkbox" checked={osmKeys.includes(a.routingKey as string)} onChange={(e) => {
              setOsmKeys(e.target.checked ? [...osmKeys, a.routingKey as string] : osmKeys.filter((k) => k !== a.routingKey));
            }} />{a.keywords?.join(", ")}
          </label>
        ))}
        <button className="mini" onClick={osmPreview} disabled={busy}>{busy ? "Đang lấy..." : "Xem trước"}</button>
        {preview && <button className="mini primary" onClick={osmImport} disabled={busy}>Lưu {preview.length} rule</button>}
      </div>
      {osmErrors.length > 0 && <div className="note err">Lỗi từng khu vực: {osmErrors.map((e) => `${e.routingKey}: ${e.error}`).join(" · ")}</div>}
      {preview && <p className="hint">Xem trước {preview.length} tên (hiển thị 10 đầu): {preview.slice(0, 10).map((r) => r.name).join(" · ")}{preview.length > 10 ? " ..." : ""}</p>}
    </div>
  );
}
