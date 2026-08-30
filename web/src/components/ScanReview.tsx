import { useState } from "react";
import type { ScanPost } from "../types";
import { api } from "../api";

function fmtTime(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

export function ScanReviewPanel({ defaultDays }: { defaultDays: number }) {
  const toLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - (defaultDays || 3) + 1);
  const [from, setFrom] = useState(toLocal(defaultFrom));
  const [to, setTo] = useState(toLocal(today));
  const [quick, setQuick] = useState(0); // 0 = tự chọn, 1/3/7 = ngày
  const [groupFilter, setGroupFilter] = useState("");
  const [posts, setPosts] = useState<ScanPost[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; k: "ok" | "err" } | null>(null);
  const [range, setRange] = useState("");
  const [destFilter, setDestFilter] = useState("");

  const pickQuick = (n: number) => {
    setQuick(n);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - n + 1);
    setFrom(toLocal(start));
    setTo(toLocal(end));
  };

  const scan = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { name: groupFilter.trim() || undefined };
      if (quick) body.days = quick;
      else {
        if (!from || !to) throw new Error("Chọn khoảng ngày (Từ ngày → Đến ngày)");
        body.from = from;
        body.to = to;
      }
      const r = (await api.control({ action: "scan", ...body })) as {
        ok: true;
        scanId: string;
        range: string;
        groups: number;
        total: number;
        posts: ScanPost[];
      };
      setScanId(r.scanId);
      setPosts(r.posts);
      setSelected(new Set());
      setRange(r.range);
      setMsg({ t: `Quét xong: ${r.total} bài từ ${r.groups} nhóm (${r.range})`, k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
    }
  };

  const sendSelected = async () => {
    if (!scanId || !selected.size) return;
    setBusy(true);
    try {
      const r = (await api.control({ action: "forwardSel", scanId, indexes: [...selected].sort((a, b) => a - b) })) as { ok: true; sent: number };
      setMsg({ t: `✓ Đã đưa ${r.sent} bài vào hàng đợi gửi — xem Nhật ký`, k: "ok" });
      setSelected(new Set());
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
    }
  };

  const sendAll = async () => {
    if (!scanId || !posts.length) return;
    setBusy(true);
    try {
      if (destFilter && filtered.length !== posts.length) {
        const idxs = filtered.map((p) => posts.indexOf(p));
        const r = (await api.control({ action: "forwardSel", scanId, indexes: idxs })) as { ok: true; sent: number };
        setMsg({ t: `✓ Đã đưa ${r.sent} bài (đã lọc) vào hàng đợi — xem Nhật ký`, k: "ok" });
      } else {
        const r = (await api.control({ action: "forwardAll", scanId })) as { ok: true; sent: number };
        setMsg({ t: `✓ Đã đưa cả ${r.sent} bài vào hàng đợi gửi — xem Nhật ký`, k: "ok" });
      }
      setSelected(new Set());
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
    }
  };

  const filtered = destFilter
    ? posts.filter((p) => {
        const hay = nameKey(`${p.areaName || ""} ${p.kw} ${p.clean}`);
        return hay.includes(nameKey(destFilter));
      })
    : posts;
  const allChecked = filtered.length > 0 && filtered.every((_, i) => selected.has(posts.indexOf(filtered[i])));

  return (
    <div className="panel">
      <h2>
        Quét & chọn tin để gửi
        <span className="hint" style={{ margin: 0 }}>
          Chế độ thủ công — quét trước, xem rồi mới gửi
        </span>
      </h2>
      <div className="row">
        <div className="row" style={{ gap: 6 }}>
          {[
            { n: 1, label: "Hôm nay" },
            { n: 3, label: "3 ngày" },
            { n: 7, label: "7 ngày" },
          ].map(({ n, label }) => (
            <button key={n} className={`mini ${quick === n ? "primary" : ""}`} onClick={() => pickQuick(n)}>
              {label}
            </button>
          ))}
        </div>
        <label className="field" style={{ maxWidth: 150 }}>
          Từ ngày
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setQuick(0); }} />
        </label>
        <label className="field" style={{ maxWidth: 150 }}>
          Đến ngày
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setQuick(0); }} />
        </label>
        <label className="field">
          Lọc theo nhóm nguồn (tuỳ chọn)
          <input type="text" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} placeholder="vd: cau giay — bỏ trống = tất cả" />
        </label>
        <button className="primary" onClick={scan} disabled={busy}>
          {busy ? "Đang quét..." : "🔍 Quét tin"}
        </button>
      </div>
      {msg && <div className={`note ${msg.k}`}>{msg.t}</div>}

      {posts.length > 0 && (
        <>
          <div className="divider" />
          <div className="row">
            <input type="text" value={destFilter} onChange={(e) => setDestFilter(e.target.value)} placeholder="Lọc tin nhắn chứa chữ (vd: cau giay, ha dong) — để trống = tất cả" style={{ flex: 1 }} />
            {destFilter && (
              <span className="hint" style={{ margin: 0 }}>
                Đang lọc: {filtered.length}/{posts.length} bài chứa "{destFilter}"
              </span>
            )}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="mini" onClick={sendSelected} disabled={busy || !selected.size}>
              📤 Gửi tin đã chọn ({selected.size})
            </button>
            <button className="mini primary" onClick={sendAll} disabled={busy}>
              📤 {destFilter && filtered.length !== posts.length ? `Gửi ${filtered.length} bài đã lọc` : `Gửi tất cả (${posts.length})`}
            </button>
            <span className="hint" style={{ margin: 0 }}>
              Tổng {posts.length} bài — {range}
            </span>
          </div>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th style={{ width: 30 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(filtered.map((p) => posts.indexOf(p))));
                      else {
                        const toRemove = new Set(filtered.map((p) => posts.indexOf(p)));
                        setSelected((prev) => new Set([...prev].filter((x) => !toRemove.has(x))));
                      }
                    }}
                  />
                </th>
                <th style={{ width: 110 }}>Nhóm đích</th>
                <th style={{ width: 130 }}>Nhóm nguồn</th>
                <th>Nội dung</th>
                <th style={{ width: 50 }}>Ảnh</th>
                <th style={{ width: 60 }}>Giá</th>
                <th style={{ width: 90 }}>Giờ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const i = posts.indexOf(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => setSelected((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                    </td>
                  <td>
                    {p.areaName ? (
                      <span className="badge dest">{p.areaName}</span>
                    ) : (
                      <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>—</span>
                    )}
                    {p.kw && <div className="hint" style={{ margin: "2px 0 0", fontSize: 11 }}>{p.kw}</div>}
                  </td>
                  <td>
                    <div>{p.name}</div>
                    <div className="hint" style={{ margin: 0, fontSize: 11 }}>{p.tid}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {p.clean ? (
                      <div style={{ whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>{p.clean}</div>
                    ) : (
                      <span className="hint">[chỉ có ảnh]</span>
                    )}
                  </td>
                  <td>{p.photos ? `🖼 ${p.photos}` : ""}</td>
                  <td style={{ fontSize: 13 }}>
                    {p.price ? `${p.price}tr` : ""}
                    {p.price && !p.inPriceRange ? <span className="badge" style={{ background: "#fef3c7", color: "#92400e", marginLeft: 4 }}>ngoài khoảng</span> : ""}
                  </td>
                  <td style={{ fontSize: 12 }}>{fmtTime(p.ts)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
