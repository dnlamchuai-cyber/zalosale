import { useEffect, useRef, useState } from "react";
import type { AppConfig, LogEntry } from "../types";
import { api } from "../api";

export function LogsPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.logs().then((r) => setLogs(r.logs));
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("log", (ev) => {
      const l = JSON.parse((ev as MessageEvent).data) as LogEntry;
      setLogs((prev) => {
        const next = [...prev, l];
        return next.length > 500 ? next.slice(-500) : next;
      });
    });
    return () => es.close();
  }, []);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="panel">
      <h2>
        Nhật ký
        <button className="mini" onClick={() => setLogs([])}>
          Xoá màn hình
        </button>
      </h2>
      <div className="logs-box" ref={boxRef}>
        {logs.map((l, i) => (
          <div key={i} className={l.level}>
            {l.line}
          </div>
        ))}
      </div>
    </div>
  );
}

export function QrOverlay({ qr, note, onClose }: { qr: string | null; note: string; onClose?: () => void }) {
  return (
    <div className="qr-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="qr-box">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Quét QR để đăng nhập Zalo</h2>
          {onClose && (
            <button className="mini" onClick={onClose} title="Đóng">
              ✕
            </button>
          )}
        </div>
        {qr ? (
          <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR đăng nhập" />
        ) : (
          <div style={{ width: 230, height: 230, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border)", borderRadius: 10, background: "#f8fafc", color: "var(--muted)", fontSize: 13 }}>
            Đang tạo mã QR...
          </div>
        )}
        <p>{note}</p>
      </div>
    </div>
  );
}

export function SessionPanel({
  loggedIn,
  account,
  onLogout,
  onLogin,
  onNetCheck,
  netCheckLines,
  netOk,
  qrOpen,
}: {
  loggedIn: boolean;
  account: { displayName: string; uid: string; avatar: string; phone: string } | null;
  onLogout: () => Promise<void>;
  onLogin: () => Promise<void>;
  onNetCheck: () => Promise<void>;
  netCheckLines: string[];
  netOk: boolean | null;
  qrOpen: boolean;
}) {
  return (
    <div className="panel">
      <h2>
        Phiên đăng nhập
        <button className="mini" onClick={() => onNetCheck()} style={{ marginLeft: 8 }}>
          🌐 Kiểm tra mạng Zalo
        </button>
      </h2>
      {loggedIn && account ? (
        <div className="account-card">
          {account.avatar && (
            <img
              className="account-avatar"
              src={account.avatar.startsWith("http") ? account.avatar : `data:image/png;base64,${account.avatar}`}
              alt="avatar"
            />
          )}
          <div className="account-info">
            <div className="account-name">{account.displayName}</div>
            <div className="account-meta">
              ID: {account.uid}
              {account.phone ? ` • ${account.phone}` : ""}
            </div>
          </div>
          <span className="tag" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
            ✔ Đã đăng nhập
          </span>
          <button className="mini danger" onClick={() => onLogout()}>
            Đăng xuất
          </button>
        </div>
      ) : (
        <div>
          <p className="hint">
            <span className="tag" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
              ✘ Chưa đăng nhập
            </span>{" "}
            Bấm <b>Đăng nhập</b> để quét mã QR bằng Zalo.
          </p>
          <button className="primary" onClick={() => onLogin()} disabled={qrOpen}>
            🔐 Đăng nhập
          </button>
        </div>
      )}
      {netCheckLines.length > 0 && (
        <div className={`note ${netOk ? "ok" : "err"}`}>
          <b>Kiểm tra mạng tới Zalo:</b>
          <pre style={{ margin: "6px 0 0", fontFamily: "inherit" }}>{netCheckLines.join("\n")}</pre>
        </div>
      )}
    </div>
  );
}
