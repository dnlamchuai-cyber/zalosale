import { useEffect, useState } from "react";
import type { AppConfig } from "../types";

const splitList = (v: string) => v.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);

export function SettingsPanel({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [form, setForm] = useState({
    deleteLines: (config.deleteLines || []).join("\n"),
    exclude: (config.excludeKeywords || []).join("\n"),
    defaultArea: config.defaultArea ?? "",
    removePercent: config.filter?.removePercentLines ?? false,
    removePrice: config.filter?.removePriceLines ?? false,
    priceMin: config.priceRange?.min?.toString() ?? "",
    priceMax: config.priceRange?.max?.toString() ?? "",
    windowMs: config.forward.windowMs,
    maxBatchItems: config.forward.maxBatchItems,
    maxWaitMs: config.forward.maxWaitMs,
    sendDelayMs: config.forward.sendDelayMs,
    retries: config.forward.retries,
    historyGapMs: config.forward.historyGapMs,
  });
  const [msg, setMsg] = useState<{ t: string; k: "ok" | "err" } | null>(null);

  useEffect(() => {
    setForm({
      deleteLines: (config.deleteLines || []).join("\n"),
      exclude: (config.excludeKeywords || []).join("\n"),
      defaultArea: config.defaultArea ?? "",
      removePercent: config.filter?.removePercentLines ?? false,
      removePrice: config.filter?.removePriceLines ?? false,
      priceMin: config.priceRange?.min?.toString() ?? "",
      priceMax: config.priceRange?.max?.toString() ?? "",
      windowMs: config.forward.windowMs,
      maxBatchItems: config.forward.maxBatchItems,
      maxWaitMs: config.forward.maxWaitMs,
      sendDelayMs: config.forward.sendDelayMs,
      retries: config.forward.retries,
      historyGapMs: config.forward.historyGapMs,
    });
  }, [config]);

  const save = async () => {
    try {
      await onSave({
        ...config,
        deleteLines: splitList(form.deleteLines),
        excludeKeywords: splitList(form.exclude),
        defaultArea: form.defaultArea.trim() || null,
        priceRange: !form.priceMin && !form.priceMax ? null : { min: +form.priceMin || 0, max: +form.priceMax || 0 },
        filter: { removePercentLines: form.removePercent, removePriceLines: form.removePrice },
        forward: {
          windowMs: +form.windowMs || config.forward.windowMs,
          maxBatchItems: +form.maxBatchItems || config.forward.maxBatchItems,
          maxWaitMs: +form.maxWaitMs || config.forward.maxWaitMs,
          sendDelayMs: +form.sendDelayMs || config.forward.sendDelayMs,
          retries: +form.retries || config.forward.retries,
          historyGapMs: +form.historyGapMs || config.forward.historyGapMs,
        },
      });
      setMsg({ t: "Đã lưu cài đặt ✓", k: "ok" });
    } catch (e) {
      setMsg({ t: (e as Error).message, k: "err" });
    }
  };

  const set = (k: keyof typeof form, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="panel">
      <h2>
        Cài đặt xử lý tin
        <button className="mini" onClick={save}>
          💾 Lưu cài đặt
        </button>
      </h2>
      <div className="grid2">
        <label className="field">
          Xoá nguyên dòng chứa chữ (1 dòng 1 chữ)
          <textarea value={form.deleteLines} onChange={(e) => set("deleteLines", e.target.value)} rows={3} placeholder={"🌹\nhoa hồng"} />
        </label>
        <label className="field">
          Loại trừ toàn bộ bài chứa từ khoá (1 dòng 1 chữ)
          <textarea value={form.exclude} onChange={(e) => set("exclude", e.target.value)} rows={3} placeholder={"tìm phòng\nhết phòng"} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <label className="field">
          Khu vực dự phòng (khi không nhận định được)
          <input type="text" value={form.defaultArea} onChange={(e) => set("defaultArea", e.target.value)} placeholder="vd: ha dong — hoặc để trống" />
        </label>
      </div>
      <div className="row">
        <label className="chk" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={form.removePercent} onChange={(e) => set("removePercent", e.target.checked)} />
          Xoá nguyên dòng chứa % hoa hồng (vd “🌹 12th: 30%”)
        </label>
        <label className="chk" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={form.removePrice} onChange={(e) => set("removePrice", e.target.checked)} />
          Xoá dòng chứa “giá”
        </label>
      </div>
      <div className="divider" />
      <h2 style={{ fontSize: 14 }}>Khoảng giá</h2>
      <div className="row">
        <label className="field" style={{ maxWidth: 150 }}>
          Từ (triệu)
          <input type="number" min={0} step={0.5} value={form.priceMin} onChange={(e) => set("priceMin", e.target.value)} placeholder="vd: 2" />
        </label>
        <label className="field" style={{ maxWidth: 150 }}>
          Đến (triệu)
          <input type="number" min={0} step={0.5} value={form.priceMax} onChange={(e) => set("priceMax", e.target.value)} placeholder="vd: 5" />
        </label>
        <span className="hint" style={{ margin: 0 }}>
          Bỏ trống = không lọc. Bài không có giá vẫn được chuyển tiếp.
        </span>
      </div>
      <div className="divider" />
      <h2 style={{ fontSize: 14 }}>Thời gian & chống ban</h2>
      <div className="row">
        <label className="field">
          Gom cửa sổ (ms)
          <input type="number" value={form.windowMs} onChange={(e) => set("windowMs", e.target.value)} />
        </label>
        <label className="field">
          Tối đa tin / bài
          <input type="number" value={form.maxBatchItems} onChange={(e) => set("maxBatchItems", e.target.value)} />
        </label>
        <label className="field">
          Chờ tối đa 1 bài (ms)
          <input type="number" value={form.maxWaitMs} onChange={(e) => set("maxWaitMs", e.target.value)} />
        </label>
        <label className="field">
          Delay giữa các lần gửi (ms)
          <input type="number" value={form.sendDelayMs} onChange={(e) => set("sendDelayMs", e.target.value)} />
        </label>
        <label className="field">
          Số lần thử lại
          <input type="number" value={form.retries} onChange={(e) => set("retries", e.target.value)} />
        </label>
        <label className="field">
          Gap lịch sử (ms)
          <input type="number" value={form.historyGapMs} onChange={(e) => set("historyGapMs", e.target.value)} />
        </label>
      </div>
      {msg && <div className={`note ${msg.k}`}>{msg.t}</div>}
    </div>
  );
}
