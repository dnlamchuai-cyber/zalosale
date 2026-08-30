// Ai viết: AI PROMPT-003
// Tại sao chọn thumbnail + calendar thay vì select text: vì UX giống ConfigPanels, dễ chọn Community
// Link: docs/03_SPEC/SPEC-001.md + docs/04_PROMPTS/PROMPT-003.md

import { useEffect, useState } from "react";
import type { GroupInfo } from "../types";
import { api } from "../api";

const PAGE_SIZE = 12; // WHY: 12 thumb vừa 1 trang, không scroll dài

export function CommunityCheckPanel() {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState(() => toISO(3));
  const [to, setTo] = useState(() => toISO(0));
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState<{ total: number; posts: any[]; range: string } | null>(null);
  const [msg, setMsg] = useState<{ t: string; k: "ok" | "err" } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.groups().then((r) => setGroups((r.groups as any[]).filter((g: any) => g.type === 2 || !g.type))).catch(() => {});
  }, []);

  const pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const slice = groups.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  async function onCheck() {
    if (!selectedId) return setMsg({ t: "Chọn 1 nhóm Community trước", k: "err" });
    if (!from || !to) return setMsg({ t: "Chọn Từ ngày và Đến ngày", k: "err" });
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/community/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedId, from, to, keyword: keyword || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult({ total: data.total, posts: data.posts, range: data.range });
      setMsg({ t: `Quét xong: ${data.total} bài (${data.range})`, k: "ok" });
    } catch (e: any) {
      setMsg({ t: e.message, k: "err" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2>Check tin nhắn Community (3 ngày)</h2>
      <p className="hint">Chọn 1 nhóm Community (thumbnail) + chọn ngày → Quét. Chỉ quét 3 ngày mặc định, max 60.</p>

      <div className="thumb-grid">
        {slice.map((g) => (
          <div
            key={g.id}
            className={`thumb-card ${selectedId === g.id ? "selected" : ""}`}
            onClick={() => setSelectedId(g.id)}
            style={{ cursor: "pointer" }}
          >
            <img className="thumb-avatar" src={(g as any).avt || (g as any).avatar || ""} alt={g.name} style={{ width: 56, height: 56 }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            <div className="thumb-name">{g.name}</div>
            <input type="radio" checked={selectedId === g.id} onChange={() => setSelectedId(g.id)} style={{ marginTop: 6 }} />
          </div>
        ))}
      </div>
      <div className="pager">
        <button className="mini" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>‹ Trước</button>
        <span className="hint" style={{ margin: 0 }}>{page + 1} / {pages} ({groups.length})</span>
        <button className="mini" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Sau ›</button>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <label className="field">Từ ngày <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field">Đến ngày <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="field">Từ khóa <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="cau giay" /></label>
        <button className="primary" onClick={onCheck} disabled={loading}>{loading ? "Đang quét..." : "Quét"}</button>
      </div>

      {msg && <div className={`note ${msg.k}`}>{msg.t}</div>}
      {result && (
        <div style={{ marginTop: 12 }}>
          <div className="hint">Kết quả: {result.total} bài — {result.range}</div>
          {result.posts.map((p: any) => (
            <div key={p.id} className="area-item">
              <div className="hint" style={{ fontSize: 11 }}>{new Date(p.ts).toLocaleString()} — {p.areaName || "—"}</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{p.clean || "[chỉ ảnh]"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function toISO(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
