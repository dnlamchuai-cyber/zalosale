import type { StatusData } from "../types";

export function StatusCards({ status }: { status: StatusData | null }) {
  const uptime = status
    ? Math.max(0, Math.round((Date.now() - new Date(status.startedAt).getTime()) / 60000))
    : null;
  return (
    <div className="card-grid">
      <div className="stat-card">
        <div className="label">Mode</div>
        <div className="value">{status?.mode ?? "—"}</div>
      </div>
      <div className="stat-card">
        <div className="label">Bài đã forward</div>
        <div className="value">{status?.forwarded ?? "—"}</div>
      </div>
      <div className="stat-card">
        <div className="label">Uptime</div>
        <div className="value">{uptime == null ? "—" : `${uptime} phút`}</div>
      </div>
      <div className="stat-card">
        <div className="label">Nhóm nguồn đã học</div>
        <div className="value">{status?.knownSources.length ?? "—"}</div>
      </div>
      <div className="stat-card">
        <div className="label">Trạng thái</div>
        <div className="value" style={{ color: status?.loggedIn ? "var(--green)" : "var(--red)" }}>
          {status?.loggedIn ? "Đã đăng nhập" : "Chưa đăng nhập"}
        </div>
      </div>
    </div>
  );
}
