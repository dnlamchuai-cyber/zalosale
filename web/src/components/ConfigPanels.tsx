import { useEffect, useMemo, useState } from "react";
import type { AppConfig, GroupInfo } from "../types";
import { api } from "../api";

const splitList = (v: string) => v.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
const nameKey = (s: string) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function initials(name: string) {
  const k = nameKey(name).split(/\s+/).filter(Boolean);
  if (!k.length) return "?";
  if (k.length === 1) return k[0].slice(0, 2).toUpperCase();
  return (k[0][0] + k[1][0]).toUpperCase();
}

function Avatar({ src, name, size = 56 }: { src?: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (src && !err) return <img className="thumb-avatar" src={src} alt={name} style={{ width: size, height: size }} onError={() => setErr(true)} referrerPolicy="no-referrer" />;
  return (
    <div className="thumb-avatar placeholder" style={{ width: size, height: size }}>
      {initials(name)}
    </div>
  );
}

/* ================= Nhóm nguồn ================= */
export function SourceGroupsPanel({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const PAGE = 12;
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<{ t: string; k: "ok" | "err" } | null>(null);
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<number>>(new Set());
  // picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [pickerPage, setPickerPage] = useState(0);
  const [pickerSel, setPickerSel] = useState<Set<number>>(new Set());
  const [pickerBusy, setPickerBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [pickerMgr, setPickerMgr] = useState<"all" | "manager" | "owner" | "admin">("all");

  const sources = config.sourceGroups || [];
  const pages = Math.max(1, Math.ceil(sources.length / PAGE));
  const curPage = Math.min(page, pages - 1);
  const slice = sources.slice(curPage * PAGE, curPage * PAGE + PAGE);

  // map source string -> matched group for avatar
  const groupMap = useMemo(() => {
    const m = new Map<string, GroupInfo>();
    for (const g of groups) m.set(nameKey(g.name), g);
    return m;
  }, [groups]);

  const findGroup = (s: string): GroupInfo | undefined => {
    // nếu là ID (toàn số) thì tìm theo ID
    if (/^\d+$/.test(s.trim())) {
      const found = groups.find((g) => String(g.id) === s.trim());
      if (found) return found;
    }
    const k = nameKey(s);
    if (groupMap.has(k)) return groupMap.get(k);
    for (const g of groups) {
      const gk = nameKey(g.name);
      if (gk.includes(k) || k.includes(gk)) return g;
    }
    return undefined;
  };

  const addManual = async () => {
    const parts = splitList(input);
    if (!parts.length) return;
    const cur = new Set(sources);
    parts.forEach((p) => cur.add(p));
    try {
      await onSave({ ...config, sourceGroups: [...cur] });
      setInput("");
      setMsg({ t: `Đã thêm ${parts.length} nhóm nguồn ✓`, k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    }
  };

  const removeSelected = async () => {
    if (!sel.size) return;
    const toRemove = new Set([...sel].map((i) => curPage * PAGE + i));
    const next = sources.filter((_, idx) => !toRemove.has(idx));
    try {
      await onSave({ ...config, sourceGroups: next });
      setSel(new Set());
      setMsg({ t: `Đã xoá ${toRemove.size} nhóm nguồn`, k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    }
  };

  const loadGroups = async (force = false) => {
    setPickerBusy(true);
    try {
      const r = await api.groups(force);
      setGroups(r.groups || []);
      setPickerPage(0);
      setPickerSel(new Set());
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setPickerBusy(false);
    }
  };

  const openPicker = async () => {
    setPickerOpen((v) => !v);
    if (!groups.length) await loadGroups(false);
  };

  const baseFiltered = search ? groups.filter((g) => nameKey(g.name).includes(nameKey(search)) || g.id.includes(search)) : groups;
  const filtered = baseFiltered.filter((g) => {
    if (pickerMgr === "manager") return !!(g as any).isManager;
    if (pickerMgr === "owner") return !!(g as any).isOwner;
    if (pickerMgr === "admin") return !!(g as any).isAdmin && !(g as any).isOwner;
    return true;
  });

  useEffect(() => { setPickerPage(0); }, [pickerMgr, search]);
  const pPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pSlice = filtered.slice(pickerPage * PAGE, pickerPage * PAGE + PAGE);
  const allPickerChecked = pSlice.length > 0 && pSlice.every((_, i) => pickerSel.has(pickerPage * PAGE + i));

  const addFromPicker = async () => {
    const ids = [...pickerSel].sort((a, b) => a - b).map((i) => filtered[i]?.id).filter(Boolean) as string[];
    if (!ids.length) return;
    const cur = new Set(sources);
    ids.forEach((id) => cur.add(id));
    try {
      await onSave({ ...config, sourceGroups: [...cur] });
      setPickerSel(new Set());
      setMsg({ t: `Đã thêm ${ids.length} nhóm từ danh sách ✓`, k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    }
  };

  return (
    <div className="panel">
      <h2>Nhóm nguồn</h2>
      <p className="hint">
        Nhóm tổng chứa tin gốc. Thêm bằng <b>link zalo.me/g/...</b> hoặc <b>tên nhóm</b> (gõ vài từ đặc trưng, bỏ qua icon). Chọn từ danh sách đã quét để khỏi gõ.
      </p>

      <div className="row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addManual()}
          placeholder="Nhập link https://zalo.me/g/... hoặc tên nhóm, Enter để thêm (nhiều nhóm cách nhau bằng dấu phẩy)"
          style={{ flex: 1 }}
        />
        <button className="primary" onClick={addManual}>
          + Thêm
        </button>
        <button className="mini" onClick={openPicker}>
          {pickerOpen ? "▴ Đóng danh sách" : "▾ Thêm từ danh sách đã quét"}
        </button>
      </div>

      {pickerOpen && (
        <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "#fbfcfe" }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm nhóm..." style={{ flex: 1 }} />
            <select value={pickerMgr} onChange={(e) => setPickerMgr(e.target.value as any)} style={{ maxWidth: 150 }}>
              <option value="all">Tất cả</option>
              <option value="manager">Chủ / QTV</option>
              <option value="owner">Chỉ chủ</option>
              <option value="admin">Chỉ QTV</option>
            </select>
            <button className="mini" onClick={() => loadGroups(false)} disabled={pickerBusy}>
              📂 Tải danh sách
            </button>
            <button className="mini primary" onClick={() => loadGroups(true)} disabled={pickerBusy} title="Bỏ qua cache">
              🔄 Quét mới
            </button>
          </div>
          {groups.length === 0 ? (
            <p className="hint" style={{ textAlign: "center" }}>
              {pickerBusy ? "Đang tải..." : "Chưa có danh sách — bấm Tải danh sách hoặc Quét mới"}
            </p>
          ) : filtered.length === 0 ? (
            <p className="hint" style={{ textAlign: "center" }}>Không có nhóm nào khớp bộ lọc — thử đổi filter hoặc bấm Quét mới để cập nhật quyền</p>
          ) : (
            <>
              <div className="thumb-grid">
                {pSlice.map((g, i) => {
                  const idx = pickerPage * PAGE + i;
                  const checked = pickerSel.has(idx);
                  return (
                    <div key={g.id + idx} className={`thumb-card ${checked ? "selected" : ""}`} onClick={() => setPickerSel((s) => { const n = new Set(s); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; })} style={{ cursor: "pointer" }}>
                      <input type="checkbox" className="thumb-check" checked={checked} onChange={() => {}} onClick={(e) => e.stopPropagation()} />
                      <Avatar src={g.avatar || g.avt} name={g.name} />
                      <div className="thumb-name">{g.name}</div>
                      <div className="thumb-sub">{g.id.slice(0, 10)}…{g.totalMember ? ` • ${g.totalMember}` : ""}</div>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 4, flexWrap: "wrap" }}>
                        {g.isOwner ? <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>chủ</span> : g.isAdmin ? <span className="badge" style={{ background: "#dbeafe", color: "#1e40af" }}>QTV</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pager">
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={allPickerChecked} onChange={(e) => setPickerSel((prev) => { const n = new Set(prev); pSlice.forEach((_, i) => { const idx = pickerPage * PAGE + i; if (e.target.checked) n.add(idx); else n.delete(idx); }); return n; })} />
                  Chọn tất cả trang này
                </label>
                <span style={{ flex: 1 }} />
                <button className="mini" disabled={pickerPage <= 0} onClick={() => setPickerPage((p) => p - 1)}>
                  ‹ Trước
                </button>
                <span className="hint" style={{ margin: 0 }}>
                  {pickerPage + 1} / {pPages} ({filtered.length})
                </span>
                <button className="mini" disabled={pickerPage >= pPages - 1} onClick={() => setPickerPage((p) => p + 1)}>
                  Sau ›
                </button>
                <button className="primary mini" disabled={!pickerSel.size} onClick={addFromPicker}>
                  ➕ Thêm {pickerSel.size} nhóm
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {sources.length === 0 ? (
        <p className="hint" style={{ textAlign: "center", marginTop: 16 }}>Chưa có nhóm nguồn nào</p>
      ) : (
        <>
          <div className="row" style={{ marginTop: 14, marginBottom: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={slice.length > 0 && slice.every((_, i) => sel.has(i))}
                onChange={(e) => setSel(e.target.checked ? new Set(slice.map((_, i) => i)) : new Set())}
              />
              Chọn tất cả trang này
            </label>
            <span style={{ flex: 1 }} />
            <button className="mini danger" disabled={!sel.size} onClick={removeSelected}>
              🗑 Xoá đã chọn ({sel.size})
            </button>
          </div>
          <div className="thumb-grid">
            {slice.map((s, i) => {
              const g = findGroup(s);
              const checked = sel.has(i);
              return (
                <div key={s + i} className={`thumb-card ${checked ? "selected" : ""}`}>
                  <input type="checkbox" className="thumb-check" checked={checked} onChange={() => setSel((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                  <button className="thumb-close" title="Xoá" onClick={async () => { const next = sources.filter((_, idx) => idx !== curPage * PAGE + i); await onSave({ ...config, sourceGroups: next }); }}>
                    ×
                  </button>
                  <Avatar src={g?.avatar || g?.avt} name={g?.name || s} />
                  <div className="thumb-name" title={s}>{g?.name || s}</div>
                  <div className="thumb-sub" title={s}>{s.startsWith("http") ? s.slice(0, 22) + "…" : g ? g.id.slice(0, 10) + "…" : ""}</div>
                </div>
              );
            })}
          </div>
          <div className="pager">
            <button className="mini" disabled={curPage <= 0} onClick={() => setPage((p) => p - 1)}>
              ‹ Trước
            </button>
            <span className="hint" style={{ margin: 0 }}>
              {curPage + 1} / {pages} ({sources.length} nhóm)
            </span>
            <button className="mini" disabled={curPage >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              Sau ›
            </button>
          </div>
        </>
      )}
      {msg && <div className={`note ${msg.k}`}>{msg.t}</div>}
    </div>
  );
}

export function AreasPanel({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const PAGE = 8;
  const [rows, setRows] = useState(
    (config.areas || []).map((a) => ({
      keywords: (a.keywords || []).join(", "),
      link: a.groupLink || "",
      id: a.id || "",
    }))
  );
  const [msg, setMsg] = useState<{ t: string; k: "ok" | "err" } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<number>>(new Set());
  // picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [pickerPage, setPickerPage] = useState(0);
  const [pickerSel, setPickerSel] = useState<Set<number>>(new Set());
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerKw, setPickerKw] = useState("");
  const [pickerMgr, setPickerMgr] = useState<"all" | "manager" | "owner" | "admin">("all");

  useEffect(() => {
    setRows((config.areas || []).map((a) => ({ keywords: (a.keywords || []).join(", "), link: a.groupLink || "", id: a.id || "" })));
  }, [config]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const curPage = Math.min(page, pages - 1);
  const pageRows = rows.slice(curPage * PAGE, curPage * PAGE + PAGE);

  const save = async (nextRows = rows) => {
    const areas = nextRows.map((r) => ({
      keywords: splitList(r.keywords),
      groupLink: r.link.trim(),
      id: r.id.trim() || undefined,
    }));
    try {
      await onSave({ ...config, areas });
      setMsg({ t: "Đã lưu khu vực ✓", k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    }
  };

  const removeSelected = async () => {
    if (!sel.size) return;
    const toRemove = new Set([...sel].map((i) => curPage * PAGE + i));
    const next = rows.filter((_, idx) => !toRemove.has(idx));
    setSel(new Set());
    setRows(next);
    await save(next);
  };

  const resolve = async () => {
    await save();
    setResolving(true);
    setMsg({ t: "Đang kiểm tra link → tên nhóm...", k: "ok" });
    try {
      const r = (await api.control({ action: "resolve" })) as { ok: true; areas: { index: number; ok: boolean; groupId?: string; name?: string; error?: string }[] };
      const map = new Map(r.areas.map((a) => [a.index, a]));
      setMsg({
        t: r.areas.every((a) => a.ok) ? `✓ Tất cả ${r.areas.length} nhóm đích OK` : "Có khu vực chưa resolve được — xem dòng báo đỏ bên dưới",
        k: "ok",
      });
      setResolveInfo(map);
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setResolving(false);
    }
  };

  const [resolveInfo, setResolveInfo] = useState<Map<number, { ok: boolean; groupId?: string; name?: string; error?: string }>>(new Map());
  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const loadGroups = async (force = false) => {
    setPickerBusy(true);
    try {
      const r = await api.groups(force);
      setGroups(r.groups || []);
      setPickerPage(0);
      setPickerSel(new Set());
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setPickerBusy(false);
    }
  };

  const openPicker = async () => {
    setPickerOpen((v) => !v);
    if (!groups.length) await loadGroups(false);
  };

  const baseFiltered = pickerSearch ? groups.filter((g) => nameKey(g.name).includes(nameKey(pickerSearch)) || g.id.includes(pickerSearch)) : groups;
  const filtered = baseFiltered.filter((g) => {
    if (pickerMgr === "manager") return !!(g as any).isManager;
    if (pickerMgr === "owner") return !!(g as any).isOwner;
    if (pickerMgr === "admin") return !!(g as any).isAdmin && !(g as any).isOwner;
    return true;
  });

  useEffect(() => { setPickerPage(0); }, [pickerMgr, pickerSearch]);

  const pPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pSlice = filtered.slice(pickerPage * PAGE, pickerPage * PAGE + PAGE);
  const allPickerChecked = pSlice.length > 0 && pSlice.every((_, i) => pickerSel.has(pickerPage * PAGE + i));

  const addFromPicker = async () => {
    const picked = [...pickerSel].sort((a, b) => a - b).map((i) => filtered[i]).filter(Boolean);
    if (!picked.length) return;
    if (!pickerKw.trim()) {
      setMsg({ t: "Nhập từ khoá nhận diện cho nhóm đã chọn (vd: ha dong)", k: "err" });
      return;
    }
    const kws = splitList(pickerKw);
    const next = [...rows];
    for (const g of picked) {
      next.push({ keywords: kws.join(", "), link: "", id: g.id });
    }
    setRows(next);
    setPickerSel(new Set());
    setPickerKw("");
    await save(next);
  };

  // map area id/link -> group for thumbnail
  const groupById = useMemo(() => {
    const m = new Map<string, GroupInfo>();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  return (
    <div className="panel">
      <h2>
        Khu vực → nhóm đích
        <span style={{ display: "flex", gap: 8 }}>
          <button className="mini" onClick={resolve} disabled={resolving}>
            🔎 {resolving ? "Đang kiểm tra..." : "Kiểm tra link"}
          </button>
          <button className="mini primary" onClick={() => save()}>
            💾 Lưu khu vực
          </button>
        </span>
      </h2>
      <p className="hint">
        Mỗi khu vực: <b>từ khoá</b> (bài chứa từ khoá → vào nhóm đó) + <b>nhóm đích</b>. Một bài chỉ vào đúng 1 nhóm khớp mạnh nhất.
      </p>

      <div className="row">
        <button className="mini" onClick={openPicker}>
          {pickerOpen ? "▴ Đóng danh sách" : "▾ Thêm từ danh sách nhóm đã quét"}
        </button>
        <button className="mini" onClick={() => setRows((rs) => [...rs, { keywords: "", link: "", id: "" }])}>
          + Thêm khu vực thủ công
        </button>
      </div>

      {pickerOpen && (
        <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "#fbfcfe" }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <input type="text" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Tìm nhóm..." style={{ flex: 1 }} />
            <select value={pickerMgr} onChange={(e) => setPickerMgr(e.target.value as any)} style={{ maxWidth: 140 }}>
              <option value="all">Tất cả</option>
              <option value="manager">Chủ / QTV</option>
              <option value="owner">Chỉ chủ</option>
              <option value="admin">Chỉ QTV</option>
            </select>
            <input type="text" value={pickerKw} onChange={(e) => setPickerKw(e.target.value)} placeholder="Từ khoá cho nhóm đã chọn (vd: ha dong)" style={{ flex: 1 }} />
            <button className="mini" onClick={() => loadGroups(false)} disabled={pickerBusy}>
              📂 Tải
            </button>
            <button className="mini primary" onClick={() => loadGroups(true)} disabled={pickerBusy}>
              🔄 Quét mới
            </button>
          </div>
          {groups.length === 0 ? (
            <p className="hint" style={{ textAlign: "center" }}>{pickerBusy ? "Đang tải..." : "Chưa có danh sách — bấm Tải danh sách"}</p>
          ) : filtered.length === 0 ? (
            <p className="hint" style={{ textAlign: "center" }}>Không có nhóm nào khớp bộ lọc — thử đổi filter hoặc Quét mới</p>
          ) : (
            <>
              <div className="thumb-grid">
                {pSlice.map((g, i) => {
                  const idx = pickerPage * PAGE + i;
                  const checked = pickerSel.has(idx);
                  return (
                    <div key={g.id + idx} className={`thumb-card ${checked ? "selected" : ""}`} onClick={() => setPickerSel((s) => { const n = new Set(s); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; })} style={{ cursor: "pointer" }}>
                      <input type="checkbox" className="thumb-check" checked={checked} onChange={() => {}} />
                      <Avatar src={g.avatar || g.avt} name={g.name} />
                      <div className="thumb-name">{g.name}</div>
                      <div className="thumb-sub">{g.id.slice(0, 10)}…{g.totalMember ? ` • ${g.totalMember}` : ""}</div>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 4 }}>
                        {g.isOwner ? <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>chủ</span> : g.isAdmin ? <span className="badge" style={{ background: "#dbeafe", color: "#1e40af" }}>QTV</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pager">
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={allPickerChecked} onChange={(e) => setPickerSel((prev) => { const n = new Set(prev); pSlice.forEach((_, i) => { const idx = pickerPage * PAGE + i; if (e.target.checked) n.add(idx); else n.delete(idx); }); return n; })} />
                  Chọn tất cả
                </label>
                <span style={{ flex: 1 }} />
                <button className="mini" disabled={pickerPage <= 0} onClick={() => setPickerPage((p) => p - 1)}>‹ Trước</button>
                <span className="hint" style={{ margin: 0 }}>{pickerPage + 1} / {pPages} ({filtered.length})</span>
                <button className="mini" disabled={pickerPage >= pPages - 1} onClick={() => setPickerPage((p) => p + 1)}>Sau ›</button>
                <button className="primary mini" disabled={!pickerSel.size} onClick={addFromPicker}>➕ Thêm {pickerSel.size} khu vực</button>
              </div>
            </>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="hint" style={{ textAlign: "center", marginTop: 14 }}>Chưa có khu vực nào — thêm thủ công hoặc từ danh sách</p>
      ) : (
        <>
          <div className="row" style={{ marginTop: 12, marginBottom: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={pageRows.length > 0 && pageRows.every((_, i) => sel.has(i))} onChange={(e) => setSel(e.target.checked ? new Set(pageRows.map((_, i) => i)) : new Set())} />
              Chọn tất cả trang này
            </label>
            <span style={{ flex: 1 }} />
            <button className="mini danger" disabled={!sel.size} onClick={removeSelected}>🗑 Xoá đã chọn ({sel.size})</button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {pageRows.map((r, i) => {
              const absIdx = curPage * PAGE + i;
              const checked = sel.has(i);
              const g = r.id ? groupById.get(r.id) : undefined;
              const ri = resolveInfo.get(absIdx);
              const thumbName = g?.name || (r.keywords ? r.keywords.split(",")[0]?.trim() : "") || `Khu vực ${absIdx + 1}`;
              return (
                <div key={absIdx} className={`area-item ${checked ? "selected" : ""}`} style={{ position: "relative", borderColor: checked ? "var(--accent)" : undefined, background: checked ? "var(--accent-soft)" : undefined }}>
                  <input type="checkbox" style={{ position: "absolute", top: 10, left: 10 }} checked={checked} onChange={() => setSel((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                  <div style={{ display: "flex", gap: 12, paddingLeft: 22 }}>
                    <Avatar src={g?.avatar || g?.avt} name={thumbName} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <label className="field" style={{ flex: 1 }}>
                          Từ khoá
                          <input type="text" value={r.keywords} onChange={(e) => setRow(absIdx, { keywords: e.target.value })} placeholder="vd: ha dong, nguyen trai" />
                        </label>
                        <label className="field" style={{ flex: 1 }}>
                          Link nhóm đích
                          <input type="text" value={r.link} onChange={(e) => setRow(absIdx, { link: e.target.value })} placeholder="https://zalo.me/g/..." />
                        </label>
                        <label className="field" style={{ maxWidth: 160 }}>
                          ID
                          <input type="text" value={r.id} onChange={(e) => setRow(absIdx, { id: e.target.value })} placeholder="group id" />
                        </label>
                      </div>
                      {ri && <div className={`area-res ${ri.ok ? "ok" : "err"}`}>{ri.ok ? `✓ ${ri.name} — ${ri.groupId}` : `✗ ${ri.error}`}</div>}
                    </div>
                    <button className="mini danger" title="Xoá khu vực" onClick={async () => { const next = rows.filter((_, idx) => idx !== absIdx); setRows(next); await save(next); }} style={{ alignSelf: "flex-start" }}>
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pager">
            <button className="mini" disabled={curPage <= 0} onClick={() => setPage((p) => p - 1)}>‹ Trước</button>
            <span className="hint" style={{ margin: 0 }}>{curPage + 1} / {pages} ({rows.length} khu vực)</span>
            <button className="mini" disabled={curPage >= pages - 1} onClick={() => setPage((p) => p + 1)}>Sau ›</button>
          </div>
        </>
      )}
      {msg && <div className={`note ${msg.k}`}>{msg.t}</div>}
    </div>
  );
}
