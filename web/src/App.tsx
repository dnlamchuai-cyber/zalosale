import { useCallback, useEffect, useState } from "react";
import type { AppConfig, StatusData } from "./types";
import { api } from "./api";
import { StatusCards } from "./components/StatusCards";
import { SourceGroupsPanel, AreasPanel } from "./components/ConfigPanels";
import { SettingsPanel } from "./components/SettingsPanel";
import { LogsPanel, QrOverlay, SessionPanel } from "./components/LogsSession";
import { ScanReviewPanel } from "./components/ScanReview";
import { CommunityCheckPanel } from "./components/CommunityCheckPanel";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [conn, setConn] = useState<"off" | "on">("off");
  const [qr, setQr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrNote, setQrNote] = useState("Mở Zalo → Biểu tượng quét mã → quét ảnh này");
  const [netLines, setNetLines] = useState<string[]>([]);
  const [netOk, setNetOk] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const saveConfig = useCallback(
    async (c: AppConfig) => {
      const r = await api.saveConfig(c);
      setConfig(r.config);
      setStatus((s) => (s ? { ...s } : s));
      return;
    },
    []
  );

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s);
      if (s.loggedIn) {
        setQr(null);
        setQrOpen(false);
      }
      return s;
    } catch {
      return null;
    }
  }, []);

  // load ban đầu
  useEffect(() => {
    (async () => {
      try {
        const c = await api.config();
        setConfig(c.config);
      } catch (e) {
        console.error("Không tải được config", e);
      }
      refreshStatus();
    })();
  }, [refreshStatus]);

  // poll status 5s
  useEffect(() => {
    const t = setInterval(refreshStatus, 5000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  // SSE
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setConn("on");
    es.onerror = () => setConn("off");
    es.addEventListener("log", () => {
      // log realtime do LogsPanel tự lắng nghe
    });
    es.addEventListener("qr", (ev) => {
      try {
        const raw = JSON.parse((ev as MessageEvent).data);
        const q = typeof raw === "string" ? raw : (raw.qr as string);
        if (q) {
          setQr(q);
          setQrOpen(true);
          setQrNote("Mở Zalo → quét mã → xác nhận trên điện thoại");
        }
      } catch {}
    });
    es.addEventListener("scan", () => {
      setQrNote("Đã quét ✓ — mở Zalo trên điện thoại và bấm XÁC NHẬN");
    });
    es.addEventListener("login", () => {
      setQr(null);
      setQrOpen(false);
      refreshStatus();
    });
    es.addEventListener("ready", () => {
      setQr(null);
      setQrOpen(false);
      refreshStatus();
    });
    return () => es.close();
  }, [refreshStatus]);

  const handleLogout = async () => {
    if (!confirm("Đăng xuất? Bot sẽ ngắt kết nối, cần đăng nhập lại để chạy tiếp.")) return;
    await api.control({ action: "logout" });
    setQr(null);
    setQrOpen(false);
    refreshStatus();
  };

  const handleLogin = async () => {
    setQr(null);
    setQrNote("Đang tạo mã QR, vui lòng đợi...");
    setQrOpen(true);
    try {
      await api.control({ action: "relogin" });
    } catch (e) {
      setQrNote((e as Error).message || "Lỗi khi tạo QR, thử lại");
    }
    refreshStatus();
  };

  const handleNetCheck = async () => {
    try {
      const r = (await api.control({ action: "netcheck" })) as { ok: true; lines: string[] };
      setNetLines(r.lines);
      setNetOk(!r.lines.some((l) => l.includes("KHÔNG")));
    } catch (e) {
      setNetLines([(e as Error).message]);
      setNetOk(false);
    }
  };



  if (!config) {
    return (
      <div className="container" style={{ paddingTop: 40, textAlign: "center", color: "var(--muted)" }}>
        Đang tải cấu hình...
      </div>
    );
  }

  const loggedIn = !!status?.loggedIn;

  return (
    <>
      <header className="topbar">
        <h1>
          <span className="logo">💬</span>
          zaloSALE <small>Quản lý bot chuyển tiếp phòng</small>
        </h1>
        <div className="topbar-right">
          <span className={`dot ${conn === "on" ? "online" : "offline"}`} />
          <span className="conn-text">{conn === "on" ? (loggedIn ? "bot đã đăng nhập" : "chưa đăng nhập") : "mất kết nối"}</span>
          <button
            className={config.mode === "auto" ? "primary" : ""}
            style={{ minWidth: 150 }}
            onClick={async () => {
              const next = config.mode === "auto" ? "manual" : "auto";
              await api.control({ action: "mode", mode: next });
              setConfig((c) => (c ? { ...c, mode: next } : c));
              refreshStatus();
            }}
            title="Bật = bot tự chuyển tiếp tin mới khi treo máy. Tắt = chỉ gửi tin bạn tự chọn trên giao diện."
          >
            {config.mode === "auto" ? "⏺ Treo máy: AUTO" : "▶ Tự động: tắt (manual)"}
          </button>
        </div>
      </header>

      <div className="container">
        <StatusCards status={status} />

        <SessionPanel
          loggedIn={loggedIn}
          account={status?.accountInfo ?? null}
          onLogout={handleLogout}
          onLogin={handleLogin}
          onNetCheck={handleNetCheck}
          netCheckLines={netLines}
          netOk={netOk}
          qrOpen={qrOpen}
        />

        {!loggedIn && (
          <div className="panel" style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Chưa đăng nhập bot</p>
            <p className="hint" style={{ marginBottom: 16 }}>
              Bấm <b>🔐 Đăng nhập</b> phía trên, sau đó quét mã QR bằng Zalo trên điện thoại.
            </p>
            {!qrOpen && (
              <button className="primary" onClick={handleLogin}>
                🔐 Đăng nhập
              </button>
            )}
          </div>
        )}

        {loggedIn && (
          <>
            <ScanReviewPanel defaultDays={3} />

            <CommunityCheckPanel />

            <SourceGroupsPanel config={config} onSave={saveConfig} />
            <AreasPanel config={config} onSave={saveConfig} />

            <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>⚙ Cài đặt xử lý tin</span>
              <button className="mini" onClick={() => setShowSettings((v) => !v)}>
                {showSettings ? "▴ Thu gọn" : "▾ Mở ra"}
              </button>
            </div>
            {showSettings && <SettingsPanel config={config} onSave={saveConfig} />}

            <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>📋 Nhật ký</span>
              <button className="mini" onClick={() => setShowLogs((v) => !v)}>
                {showLogs ? "▴ Thu gọn" : "▾ Mở ra"}
              </button>
            </div>
            {showLogs && <LogsPanel />}
          </>
        )}

        <p className="hint" style={{ textAlign: "center" }}>
          Bot hoạt động bằng tài khoản Zalo của bạn qua API unofficial — đừng đăng nhập bot trên nhiều thiết bị cùng lúc.
        </p>
      </div>

      {qrOpen && <QrOverlay qr={qr} note={qrNote} onClose={() => setQrOpen(false)} />}
    </>
  );
}
