// Ai viết: Codex — đơn giản hóa luồng quét nhóm nguồn
// Tại sao: màn quét dùng trực tiếp sourceGroups đã cấu hình, tránh hai nơi chọn nguồn khác nhau
// Link: PLAN.md — yêu cầu UI ngày 2026-08-30

import { useEffect, useState } from "react";
import type { Area, ScanPost, ScanProgress } from "../types";
import { api } from "../api";
import { roomTextItems, ScanClusterDialog } from "./ScanClusterDialog";
import { ScanFilters } from "./ScanFilters";
import { ImageLightbox } from "./ImageLightbox";
import { useScanFilters } from "./useScanFilters";

function fmtTime(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtElapsed(startedAt: number, endedAt?: number) {
  const totalSeconds = Math.max(0, Math.floor(((endedAt || Date.now()) - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;
}

const STATUS_LABELS = {
  pending: "Chưa gửi",
  sent: "Đã gửi",
  duplicate: "Trùng",
  error: "Lỗi",
  undetermined: "Chưa xác định",
  no_images: "Không ảnh/video · bỏ qua",
  no_opening: "Không có tin mở · bỏ qua",
} as const;

const STATUS_COLORS = {
  pending: { background: "#f3f4f6", color: "#4b5563" },
  sent: { background: "#dcfce7", color: "#166534" },
  duplicate: { background: "#fef3c7", color: "#92400e" },
  error: { background: "#fee2e2", color: "#b91c1c" },
  undetermined: { background: "#e0e7ff", color: "#3730a3" },
  no_images: { background: "#f3f4f6", color: "#6b7280" },
  no_opening: { background: "#f3f4f6", color: "#6b7280" },
} as const;

const ROUTE_REASON_LABELS: Record<string, string> = {
  "dia-chi": "địa chỉ",
  gan: "gần",
  "xe-buyt": "xe buýt",
};

const SCAN_PAGE_SIZE = 20; // Giữ bảng nhẹ và vẫn đủ ngữ cảnh khi rà soát tin.

export function ScanReviewPanel({ defaultDays, areas = [], sourceGroups = [] }: { defaultDays: number; areas?: Area[]; sourceGroups?: string[] }) {
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
  const [sourceGroup, setSourceGroup] = useState("");
  const [keyword, setKeyword] = useState("");
  const [posts, setPosts] = useState<ScanPost[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ t: string; k: "ok" | "err" } | null>(null);
  const [range, setRange] = useState("");
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [preview, setPreview] = useState<{ photos: string[]; index: number } | null>(null);
  const [clusterPreview, setClusterPreview] = useState<ScanPost | null>(null);
  const [showTable, setShowTable] = useState(true);
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, { name: string; routingKey: string }>>({});
  const {
    sourceFilter, setSourceFilter, keywordFilter, setKeywordFilter, statusFilter, setStatusFilter, contentFilter, setContentFilter,
    mediaFilter, setMediaFilter, commissionFilter, setCommissionFilter,
    priceMin, setPriceMin, priceMax, setPriceMax, commissionMin, setCommissionMin,
    sort, setSort, filteredEntries, resetFilters,
  } = useScanFilters(posts);

  useEffect(() => {
    setPage(0);
  }, [sourceFilter, keywordFilter, statusFilter, contentFilter, mediaFilter, commissionFilter, priceMin, priceMax, commissionMin, sort]);

  useEffect(() => {
    api.control({ action: "scanState" }).then((response) => {
      const scan = (response as { scan?: { scanId: string; range: string; posts: ScanPost[]; progress?: ScanProgress | null } | null }).scan;
      if (!scan) return;
      setScanId(scan.scanId);
      setPosts(scan.posts);
      setRange(scan.range);
      setProgress(scan.progress || null);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if ((!progress?.running && !sending) || !scanId) return;
    let active = true;
    const refreshProgress = () => {
      api.control({ action: "scanState" }).then((response) => {
        const scan = (response as { scan?: { posts?: ScanPost[]; progress?: ScanProgress | null } | null }).scan;
        if (!active || !scan) return;
        if (scan.posts) setPosts(scan.posts);
        setProgress(scan.progress || null);
      }).catch(() => {});
    };
    refreshProgress();
    const timer = window.setInterval(refreshProgress, 500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [progress?.running, sending, scanId]);

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
      const body: Record<string, unknown> = {};
      if (sourceGroup) body.name = sourceGroup;
      if (keyword.trim()) body.keyword = keyword.trim();
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
        added: number;
        posts: ScanPost[];
      };
      setScanId(r.scanId);
      setPosts(r.posts);
      setSelected(new Set());
      setPage(0);
      setRange(r.range);
      setProgress(null);
      setMsg({ t: `Quét xong: ${r.total} bài (${r.range}) — bảng mới thay bảng cũ`, k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
    }
  };

  const sendSelected = async (overrideIndexes?: number[]) => {
    const indexes = [...(overrideIndexes ?? [...selected])].sort((a, b) => a - b);
    if (!scanId || !indexes.length) return;
    setBusy(true);
    setSending(true);
    try {
      const r = (await api.control({ action: "forwardSel", scanId, indexes })) as { ok: true; sent: number; failed?: number; stopped?: boolean; posts?: ScanPost[]; progress?: ScanProgress | null };
      if (r.posts) setPosts(r.posts);
      if (r.progress) setProgress(r.progress);
      setMsg(r.stopped ? { t: `Đã dừng sau cụm ${r.progress?.current || 0}/${r.progress?.total || 0}`, k: "ok" } : r.failed ? { t: `Đã gửi ${r.sent} bài, ${r.failed} bài lỗi — xem cột Trạng thái`, k: "err" } : { t: `✓ Đã đưa ${r.sent} bài vào hàng đợi gửi — xem Nhật ký`, k: "ok" });
      setSelected(new Set());
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
      setSending(false);
    }
  };

  const sendAll = async () => {
    if (!scanId || !posts.some((post) => post.status !== "sent" && post.status !== "no_images" && post.status !== "no_opening")) return;
    setBusy(true);
    setSending(true);
    try {
      const r = (await api.control({ action: "forwardAll", scanId })) as { ok: true; sent: number; failed?: number; stopped?: boolean; posts?: ScanPost[]; progress?: ScanProgress | null };
      if (r.posts) setPosts(r.posts);
      setMsg(r.stopped ? { t: `Đã dừng sau cụm ${r.progress?.current || 0}/${r.progress?.total || 0}`, k: "ok" } : r.failed ? { t: `Đã gửi ${r.sent} bài, ${r.failed} bài lỗi — xem cột Trạng thái`, k: "err" } : { t: `✓ Đã đưa cả ${r.sent} bài vào hàng đợi gửi — xem Nhật ký`, k: "ok" });
      setSelected(new Set());
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
      setSending(false);
    }
  };

  const sendDestination = async (destinationKeyword: string) => {
    if (!scanId) return;
    const indexes = posts.flatMap((post, index) => post.destinationNames.includes(destinationKeyword) ? [index] : []);
    if (!indexes.length) return;
    setBusy(true);
    setSending(true);
    try {
      const r = (await api.control({ action: "forwardSel", scanId, indexes, destinationKeyword })) as { ok: true; sent: number; failed?: number; stopped?: boolean; posts?: ScanPost[]; progress?: ScanProgress | null };
      if (r.posts) setPosts(r.posts);
      if (r.progress) setProgress(r.progress);
      setMsg(r.stopped ? { t: `Đã dừng sau cụm ${r.progress?.current || 0}/${r.progress?.total || 0}`, k: "ok" } : r.failed ? { t: `Đã gửi ${r.sent} cụm, ${r.failed} cụm lỗi — xem cột Trạng thái`, k: "err" } : { t: `✓ Đã gửi ${r.sent} cụm vào nhóm ${destinationKeyword}`, k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
      setSending(false);
    }
  };

  const sendPostToDestination = async (postIndex: number, destinationKeyword: string) => {
    if (!scanId || busy) return;
    const post = posts[postIndex];
    setBusy(true);
    setSending(true);
    try {
      const r = (await api.control({ action: "forwardSel", scanId, indexes: [postIndex], destinationKeyword, force: post?.status === "sent" })) as { ok: true; sent: number; failed?: number; posts?: ScanPost[]; progress?: ScanProgress | null };
      if (r.posts) setPosts(r.posts);
      if (r.progress) setProgress(r.progress);
      setMsg(r.failed ? { t: `Gửi tin vào nhóm ${destinationKeyword} bị lỗi — xem cột Trạng thái`, k: "err" } : { t: `✓ Đã đưa tin vào nhóm ${destinationKeyword}`, k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
      setSending(false);
    }
  };

  const sendPostAgain = async (postIndex: number) => {    const post = posts[postIndex];
    if (!scanId || busy || !post?.destinationNames.length) return;
    setBusy(true);
    setSending(true);
    try {
      let sent = 0;
      let failed = 0;
      for (const destinationKeyword of post.destinationNames) {
        const r = (await api.control({ action: "forwardSel", scanId, indexes: [postIndex], destinationKeyword, force: true })) as { ok: true; sent: number; failed?: number; posts?: ScanPost[]; progress?: ScanProgress | null };
        sent += r.sent;
        failed += r.failed || 0;
        if (r.posts) setPosts(r.posts);
        if (r.progress) setProgress(r.progress);
      }
      setMsg(failed ? { t: `Gửi lại xong: ${sent} nơi ok, ${failed} nơi lỗi`, k: "err" } : { t: `✓ Đã gửi lại vào ${sent} nhóm`, k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
      setSending(false);
    }
  };

  const sendVideoAgain = async (postIndex: number) => {
    const post = posts[postIndex];
    if (!scanId || busy || !post?.destinationNames.length) return;
    setBusy(true);
    setSending(true);
    try {
      let sent = 0;
      let failed = 0;
      for (const destinationKeyword of post.destinationNames) {
        const r = (await api.control({ action: "forwardSel", scanId, indexes: [postIndex], destinationKeyword, videoOnly: true })) as { ok: true; sent: number; failed?: number; posts?: ScanPost[]; progress?: ScanProgress | null };
        sent += r.sent;
        failed += r.failed || 0;
        if (r.posts) setPosts(r.posts);
        if (r.progress) setProgress(r.progress);
      }
      setMsg(failed ? { t: `Gửi lại video: ${sent} nơi ok, ${failed} nơi lỗi`, k: "err" } : { t: `✓ Đã gửi lại video vào ${sent} nhóm (không gửi lại ảnh)`, k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
      setSending(false);
    }
  };

  const saveRuleFromPost = async (post: ScanPost) => {
    const draft = ruleDrafts[post.id];
    if (!draft?.name.trim() || !draft?.routingKey) {
      setMsg({ t: "Nhập tên địa danh và chọn nhóm đích để lưu rule", k: "err" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/location-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name.trim(), type: "duong", routingKeys: [draft.routingKey] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setRuleDrafts((d) => { const n = { ...d }; delete n[post.id]; return n; });
      setMsg({ t: `Đã lưu rule "${draft.name.trim()}" — quét lại để áp dụng`, k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    } finally {
      setBusy(false);
    }
  };

  const stopAfterCurrent = async () => {
    try {
      const r = (await api.control({ action: "stopForward" })) as { ok: true; stopped: boolean; progress?: ScanProgress | null };
      if (r.progress) setProgress(r.progress);
      setMsg(r.stopped ? { t: "Sẽ dừng ngay sau khi gửi xong cụm hiện tại.", k: "ok" } : { t: "Không có cụm nào đang gửi.", k: "err" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    }
  };

  const failedCount = posts.filter((post) => post.status === "error").length;

  const sendFailed = async () => {
    const indexes = posts.flatMap((post, index) => (post.status === "error" ? [index] : []));
    if (!indexes.length) return;
    setSelected(new Set(indexes));
    await sendSelected(indexes);
  };

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / SCAN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const unsentCount = posts.filter((post) => post.status !== "sent" && post.status !== "no_images" && post.status !== "no_opening").length;
  const pageEntries = filteredEntries.slice(currentPage * SCAN_PAGE_SIZE, (currentPage + 1) * SCAN_PAGE_SIZE);
  const allChecked = pageEntries.length > 0 && pageEntries.every(({ index }) => selected.has(index));

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
          Nhóm nguồn cần quét
          <select aria-label="Nhóm nguồn cần quét" value={sourceGroup} onChange={(e) => setSourceGroup(e.target.value)}>
            <option value="">Tất cả nhóm nguồn</option>
            {sourceGroups.map((source, index) => <option key={`${source}-${index}`} value={source}>{source}</option>)}
          </select>
        </label>
        <label className="field">
          Từ khóa
          <input type="text" value={keyword} maxLength={50} onChange={(e) => setKeyword(e.target.value)} placeholder="vd: hà đông — bỏ trống = tất cả" />
        </label>
        <button className="primary" onClick={scan} disabled={busy}>
          {busy ? "Đang quét..." : "🔍 Quét tin"}
        </button>
      </div>
      {msg && <div className={`note ${msg.k}`}>{msg.t}</div>}
      {sending && !progress?.running && (
        <div className="note ok" role="status">
          <strong>Đang gửi — chờ cụm đầu tiên...</strong>
          <button className="mini" style={{ marginLeft: 8 }} onClick={stopAfterCurrent}>Dừng sau cụm hiện tại</button>
        </div>
      )}
      {progress && (
        <div className={`note ${progress.running ? "ok" : progress.stopped ? "err" : "ok"}`} role="status">
          <strong>{progress.running ? `Đang gửi cụm ${progress.current}/${progress.total} (còn ${Math.max(0, progress.total - progress.current)})` : progress.stopped ? `Đã dừng sau cụm ${progress.current}/${progress.total}` : `Đã gửi xong ${progress.total} cụm`}</strong>
          <span> · {progress.sourceName || "Đang chuẩn bị"} → {progress.destinationName || "Đang xác định nhóm đích"}</span>
          <span> · {progress.imageCount} ảnh · {fmtElapsed(progress.startedAt, progress.endedAt)}</span>
          {progress.running && <button className="mini" style={{ marginLeft: 8 }} onClick={stopAfterCurrent} disabled={progress.stopRequested}>{progress.stopRequested ? "Sẽ dừng sau cụm này" : "Dừng sau cụm hiện tại"}</button>}
        </div>
      )}
      {posts.length > 0 && (
        <>
          <div className="divider" />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="mini" onClick={() => { void sendSelected(); }} disabled={busy || !selected.size}>
              📤 Gửi tin đã chọn ({selected.size})
            </button>
            <button className="mini primary" onClick={sendAll} disabled={busy || !unsentCount}>
              📤 Gửi tất cả ({unsentCount})
            </button>
            {failedCount > 0 && (
              <button className="mini" onClick={sendFailed} disabled={busy}>
                ↻ Gửi lại {failedCount} tin lỗi
              </button>
            )}
            <button className="mini" onClick={() => setSelected(new Set(filteredEntries.map(({ index }) => index)))} disabled={busy || !filteredEntries.length}>
              ☑ Chọn {filteredEntries.length} bài đang xem
            </button>
            {selected.size > 0 && (
              <button className="mini" onClick={() => setSelected(new Set())} disabled={busy}>
                Bỏ chọn
              </button>
            )}
            <span className="hint" style={{ margin: 0 }}>
              Tổng {posts.length} bài — {range}
            </span>
          </div>
          <div className="row scan-destination-actions">
            {areas.map((area) => area).filter((area) => Boolean(area.keywords?.[0])).map((area) => {
              const keyword = area.keywords?.[0] as string;
              const label = (area.keywords || []).join(", ");
              const count = posts.filter((post) => post.destinationNames.includes(keyword)).length;
              return <button key={keyword} className="mini" disabled={busy || count === 0} onClick={() => sendDestination(keyword)}>📤 Gửi nhóm {label} ({count})</button>;
            })}
          </div>
          <ScanFilters
            sources={[...new Set(posts.map((post) => post.name))]} keywords={[...new Set(posts.flatMap((post) => post.destinationNames))]}
            source={sourceFilter} onSource={setSourceFilter} keyword={keywordFilter} onKeyword={setKeywordFilter}
            status={statusFilter} onStatus={setStatusFilter}
            query={contentFilter} onQuery={setContentFilter} media={mediaFilter} onMedia={setMediaFilter}
            commission={commissionFilter} onCommission={setCommissionFilter}
            priceMin={priceMin} onPriceMin={setPriceMin} priceMax={priceMax} onPriceMax={setPriceMax}
            commissionMin={commissionMin} onCommissionMin={setCommissionMin}
            sort={sort} onSort={setSort}
            onReset={resetFilters}
          />
          <p className="hint">Đang xem {filteredEntries.length}/{posts.length} bài. “Gửi tất cả” vẫn gửi toàn bộ kết quả quét.{" "}
            <button className="mini" type="button" onClick={() => setShowTable((v) => !v)}>
              {showTable ? "▴ Thu gọn bảng" : "▾ Mở bảng"}
            </button>
          </p>
          {showTable && (
          <>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th style={{ width: 30 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => {
                      if (e.target.checked) setSelected((current) => new Set([...current, ...pageEntries.map(({ index }) => index)]));
                      else {
                        const toRemove = new Set(pageEntries.map(({ index }) => index));
                        setSelected((prev) => new Set([...prev].filter((x) => !toRemove.has(x))));
                      }
                    }}
                  />
                </th>
                <th style={{ width: 110 }}>Nhóm đích</th>
                <th style={{ width: 82 }}>Trạng thái</th>
                <th style={{ width: 120 }}>Khu vực</th>
                <th style={{ width: 130 }}>Nhóm nguồn</th>
                <th style={{ width: 220 }}>Nội dung</th>
                <th style={{ width: 80 }}>Phòng</th>
                <th style={{ width: 75 }}>Hoa hồng</th>
                <th style={{ width: 120 }}>Ảnh</th>
                <th style={{ width: 60 }}>Giá</th>
                <th style={{ width: 90 }}>Giờ</th>
              </tr>
            </thead>
            <tbody>
              {pageEntries.map(({ post: p, index: i }) => {
                const rooms = roomTextItems(p.clusterItems ?? []);
                return (
                  <tr key={p.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => setSelected((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                    </td>
                  <td>
                    {p.destinationNames?.length ? (
                      <div className="scan-destination-cell">
                        {p.destinationNames.map((destination, destinationIndex) => (
                          <div className="scan-destination-item" key={`${destination}-${destinationIndex}`}>
                            <span className="badge dest">{destination}</span>
                            <button className="mini scan-send-now" type="button" aria-label={`Gửi ngay ${destination}`} disabled={busy} onClick={() => sendPostToDestination(i, destination)}>
                              Gửi ngay
                            </button>
                          </div>
                        ))}
                        {p.routingReason && (
                          <div className="hint" style={{ margin: "2px 0 0", fontSize: 11 }}>via {ROUTE_REASON_LABELS[p.routingReason] || p.routingReason}{p.matchedRules?.length ? `: ${p.matchedRules.map((r) => r.name).join(", ")}` : ""}</div>
                        )}
                        {p.status === "sent" && (
                          <button className="mini" type="button" disabled={busy} onClick={() => sendPostAgain(i)} style={{ marginTop: 4 }}>
                            ↻ Gửi lại
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="scan-destination-cell">
                        <span className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>Chưa xác định</span>
                        <input
                          type="text"
                          placeholder="Tên đường để lưu rule"
                          aria-label={`Tên địa danh cho tin ${i + 1}`}
                          value={ruleDrafts[p.id]?.name || ""}
                          onChange={(e) => setRuleDrafts((d) => ({ ...d, [p.id]: { name: e.target.value, routingKey: d[p.id]?.routingKey || "" } }))}
                          style={{ fontSize: 12, maxWidth: 150 }}
                        />
                        <select
                          aria-label={`Nhóm đích cho tin ${i + 1}`}
                          value={ruleDrafts[p.id]?.routingKey || ""}
                          onChange={(e) => setRuleDrafts((d) => ({ ...d, [p.id]: { name: d[p.id]?.name || "", routingKey: e.target.value } }))}
                          style={{ fontSize: 12, maxWidth: 150 }}
                        >
                          <option value="">Chọn nhóm đích</option>
                          {areas.map((a) => a.routingKey || a.keywords?.[0]).filter(Boolean).map((key) => (
                            <option key={key} value={key}>{areas.find((a) => (a.routingKey || a.keywords?.[0]) === key)?.keywords?.join(", ") || key}</option>
                          ))}
                        </select>
                        <button className="mini" type="button" disabled={busy} onClick={() => saveRuleFromPost(p)}>Lưu rule</button>
                      </div>
                    )}
                    {p.kw && <div className="hint" style={{ margin: "2px 0 0", fontSize: 11 }}>{p.kw}</div>}
                  </td>
                  <td>
                    {(() => {
                      const status = p.status ?? "pending";
                      return <span className="badge" style={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</span>;
                    })()}
                  </td>
                  <td style={{ fontSize: 12 }}>{p.detectedArea ?? "—"}</td>
                  <td>
                    <div>{p.name}</div>
                    <div className="hint" style={{ margin: 0, fontSize: 11 }}>{p.tid}</div>
                  </td>
                  <td className="scan-content-cell" style={{ fontSize: 13 }}>
                    {p.clean ? (
                      <div style={{ whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>{p.clean}</div>
                    ) : (
                      <span className="hint">[chỉ có ảnh]</span>
                    )}
                    <button className="mini scan-cluster-button" type="button" title={`Xem cụm ${(p.clusterItems?.length ?? 0)} phần`} onClick={() => setClusterPreview(p)}>
                      Xem thêm
                    </button>
                  </td>
                  <td>{rooms.length > 0 ? <button className="mini scan-cluster-button" type="button" onClick={() => setClusterPreview(p)}>{rooms.length} phòng</button> : "—"}</td>
                  <td>{p.commissionPercent != null ? `${p.commissionPercent}%` : "—"}</td>
                  <td>
                    {p.photoUrls?.length ? (
                      <div className="scan-thumbnails">
                        {p.photoUrls.slice(0, 3).map((url, photoIndex) => (
                          <button
                            type="button"
                            className="scan-thumbnail-button"
                            key={url}
                            aria-label={`Xem ảnh ${photoIndex + 1} của tin ${p.clean || p.id}`}
                            onClick={() => setPreview({ photos: p.photoUrls, index: photoIndex })}
                          >
                            <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                        {p.photoUrls.length > 3 && <span className="photo-more">+{p.photoUrls.length - 3}</span>}
                      </div>
                    ) : p.photos ? `🖼 ${p.photos}` : "—"}
                    {p.videoStatus === "failed" && (
                      <div className="hint" style={{ marginTop: 4, fontSize: 11 }}>
                        Đã gửi {p.sentImages ?? p.photos ?? 0} ảnh, video lỗi
                        <button className="mini" type="button" disabled={busy} onClick={() => sendVideoAgain(i)} style={{ marginTop: 4 }}>
                          Gửi lại video
                        </button>
                      </div>
                    )}
                  </td>
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
          <div className="pager" aria-label="Phân trang tin đã quét">
            <button className="mini" disabled={currentPage <= 0} onClick={() => setPage((value) => value - 1)}>‹ Trước</button>
            <span className="hint" style={{ margin: 0 }}>{currentPage + 1} / {totalPages} ({filteredEntries.length} bài)</span>
            <button className="mini" disabled={currentPage >= totalPages - 1} onClick={() => setPage((value) => value + 1)}>Sau ›</button>
          </div>
          </>
          )}
        </>
      )}
      {preview && (
        <ImageLightbox
          photos={preview.photos}
          index={preview.index}
          onIndex={(index) => setPreview((current) => (current ? { ...current, index } : current))}
          onClose={() => setPreview(null)}
        />
      )}
      {clusterPreview && <ScanClusterDialog items={clusterPreview.clusterItems ?? []} onClose={() => setClusterPreview(null)} />}
    </div>
  );
}
