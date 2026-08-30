import { useEffect, useState } from "react";
import type { AppConfig, GroupInfo } from "../types";
import { api } from "../api";

export function ForwardPanel({ onForward }: { onForward: (from?: string, to?: string) => Promise<void> }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; k: "ok" | "err" } | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await onForward(from || undefined, to || undefined);
      setMsg({ t: "✓ Đã gom xong các bài — xem nhật ký phía dưới", k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Forward lịch sử theo khoảng ngày</h2>
      <div className="row">
        <label className="field">
          Từ ngày
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          Đến ngày <span style={{ fontWeight: 400 }}>(bỏ trống = hôm nay)</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="primary" onClick={run} disabled={busy}>
          {busy ? "Đang quét & forward..." : "Quét & Forward tất cả nhóm nguồn"}
        </button>
      </div>
      {msg && <div className={`note ${msg.k}`}>{msg.t}</div>}
    </div>
  );
}

function Avatar({ src, name, size = 56 }: { src?: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (() => {
    const k = nameKey(name).split(/\s+/).filter(Boolean);
    if (!k.length) return "?";
    if (k.length === 1) return k[0].slice(0, 2).toUpperCase();
    return (k[0][0] + k[1][0]).toUpperCase();
  })();
  if (src && !err) return <img className="thumb-avatar" src={src} alt={name} style={{ width: size, height: size }} onError={() => setErr(true)} referrerPolicy="no-referrer" />;
  return (
    <div className="thumb-avatar placeholder" style={{ width: size, height: size }}>
      {initials}
    </div>
  );
}

export function GroupsPanel({ onAddSources }: { onAddSources: (names: string[]) => Promise<void> }) {
  const PAGE = 12;
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; k: "ok" | "err" } | null>(null);
  const [sourceNames, setSourceNames] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [mgrFilter, setMgrFilter] = useState<"all" | "manager" | "owner" | "admin">("all");

  useEffect(() => {
    api.config().then((c) => setSourceNames(c.config.sourceGroups.map(nameKey).filter(Boolean)));
  }, []);

  const load = async (force = false) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.groups(force);
      setGroups(r.groups || []);
      setPage(0);
      setSelected(new Set());
      setMsg({
        t: r.groups?.length
          ? force
            ? `Đã quét mới: ${r.groups.length} nhóm (đã lưu cache)`
            : `Quét xong: ${r.groups.length} nhóm`
          : "Không lấy được nhóm nào (xem Nhật ký)",
        k: r.groups?.length ? "ok" : "err",
      });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
    }
  };

  const baseFiltered = search ? groups.filter((g) => nameKey(g.name).includes(nameKey(search)) || g.id.includes(search)) : groups;
  const filtered = baseFiltered.filter((g) => {
    if (mgrFilter === "manager") return !!(g as any).isManager;
    if (mgrFilter === "owner") return !!(g as any).isOwner;
    if (mgrFilter === "admin") return !!(g as any).isAdmin && !(g as any).isOwner;
    return true;
  });

  // reset về trang 1 khi đổi filter/tìm kiếm
  useEffect(() => { setPage(0); }, [mgrFilter, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const curPage = Math.min(page, pages - 1);
  const slice = filtered.slice(curPage * PAGE, curPage * PAGE + PAGE);
  const allChecked = slice.length > 0 && slice.every((_, i) => selected.has(curPage * PAGE + i));

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const addSrc = async () => {
    const names = [...selected].sort((a, b) => a - b).map((i) => filtered[i]?.name).filter(Boolean) as string[];
    if (!names.length) return;
    try {
      await onAddSources(names);
      setMsg({ t: `Đã thêm ${names.length} nhóm vào Nhóm nguồn ✓`, k: "ok" });
      setSelected(new Set());
      const c = await api.config();
      setSourceNames(c.config.sourceGroups.map(nameKey).filter(Boolean));
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    }
  };

  return (
    <div className="panel">
      <h2>
        Quét danh sách nhóm
        <span style={{ display: "flex", gap: 8 }}>
          <button className="mini" onClick={() => load(false)} disabled={busy}>
            {busy ? "Đang tải..." : "📂 Tải danh sách"}
          </button>
          <button className="mini primary" onClick={() => load(true)} disabled={busy} title="Bỏ qua cache">
            🔄 Quét mới
          </button>
        </span>
      </h2>
      <p className="hint">
        Danh sách nhóm bot đang tham gia — dạng thumbnail, chọn để thêm vào nhóm nguồn.
        <span className="badge src" style={{ marginLeft: 6 }}>nguồn</span> đã có trong cấu hình.
      </p>
      <div className="row" style={{ marginBottom: 10 }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm nhóm..." style={{ flex: 1 }} />
        <select value={mgrFilter} onChange={(e) => setMgrFilter(e.target.value as any)} style={{ maxWidth: 160 }}>
          <option value="all">Tất cả nhóm</option>
          <option value="manager">Chủ / QTV</option>
          <option value="owner">Chỉ chủ nhóm</option>
          <option value="admin">Chỉ QTV</option>
        </select>
        {filtered.length > 0 && <span className="hint" style={{ margin: 0 }}>{filtered.length} nhóm</span>}
      </div>
      {filtered.length > 0 && (
        <>
          <div className="thumb-grid">
            {slice.map((g, i) => {
              const idx = curPage * PAGE + i;
              const checked = selected.has(idx);
              const isSrc = sourceNames.some((s) => s && s.length >= 3 && (nameKey(g.name).includes(s) || s.includes(nameKey(g.name))));
              return (
                <div key={g.id + idx} className={`thumb-card ${checked ? "selected" : ""}`} onClick={() => toggle(idx)} style={{ cursor: "pointer" }}>
                  <input type="checkbox" className="thumb-check" checked={checked} onChange={() => {}} />
                  <Avatar src={g.avatar || (g as any).avt} name={g.name} />
                  <div className="thumb-name">{g.name}</div>
                  <div className="thumb-sub">{g.id.slice(0, 10)}…{g.totalMember ? ` • ${g.totalMember} TV` : ""}</div>
                  <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 4, flexWrap: "wrap" }}>
                    {g.isOwner ? <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>chủ</span> : g.isAdmin ? <span className="badge" style={{ background: "#dbeafe", color: "#1e40af" }}>QTV</span> : null}
                    {isSrc && <span className="badge src">nguồn</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pager">
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={allChecked} onChange={(e) => setSelected((prev) => { const n = new Set(prev); slice.forEach((_, i) => { const idx = curPage * PAGE + i; if (e.target.checked) n.add(idx); else n.delete(idx); }); return n; })} />
              Chọn tất cả
            </label>
            <span style={{ flex: 1 }} />
            <button className="mini" disabled={curPage <= 0} onClick={() => setPage((p) => p - 1)}>‹ Trước</button>
            <span className="hint" style={{ margin: 0 }}>{curPage + 1} / {pages} ({filtered.length})</span>
            <button className="mini" disabled={curPage >= pages - 1} onClick={() => setPage((p) => p + 1)}>Sau ›</button>
            <button className="primary mini" disabled={!selected.size} onClick={addSrc}>➕ Thêm vào nhóm nguồn ({selected.size})</button>
          </div>
        </>
      )}
      {groups.length > 0 && filtered.length === 0 && <p className="hint" style={{ textAlign: "center" }}>Không có nhóm nào khớp bộ lọc — thử đổi filter hoặc bấm Quét mới</p>}
      {groups.length === 0 && !busy && <p className="hint" style={{ textAlign: "center" }}>Chưa có danh sách — bấm Tải danh sách hoặc Quét mới</p>}
      {msg && <div className={`note ${msg.k}`}>{msg.t}</div>}
    </div>
  );
}

const nameKey = (s: string) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
