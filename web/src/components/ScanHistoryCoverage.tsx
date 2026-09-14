// AI: Codex | WHY: cảnh báo thiếu lịch sử phải ở lại sau khi gửi hoặc tải lại bảng.
// SPEC: docs/03_SPEC/SPEC-007_HistoryAndOrderedDelivery.md (PROMPT-007)
import type { HistoryCoverage } from "../types";

const REASONS: Record<string, string> = {
  no_progress: "nguồn không trả thêm tin cũ",
  source_limit: "nguồn giới hạn số tin trả về",
  message_limit: "đạt giới hạn của một lượt quét",
  timeout: "hết thời gian quét",
  request_error: "lỗi lấy lịch sử",
  local_store: "đang dùng lịch sử lưu trên máy",
};

export function ScanHistoryCoverage({ entries }: { entries: HistoryCoverage[] }) {
  const incomplete = entries.filter((entry) => !entry.complete);
  if (!incomplete.length) return null;
  return (
    <div className="note err" role="alert">
      <strong>Chưa xác minh đủ lịch sử cho {incomplete.length} nhóm trong khoảng ngày đã chọn.</strong>
      <ul>
        {incomplete.map((entry) => (
          <li key={entry.threadId}>
            {entry.sourceName}: đã lấy {entry.received.toLocaleString("vi-VN")} tin
            {entry.oldestTs ? `, cũ nhất ${new Date(entry.oldestTs).toLocaleString("vi-VN")}` : ""}
            {` — ${REASONS[entry.reason] || "nguồn chưa xác nhận đã lấy hết lịch sử"}`}.
          </li>
        ))}
      </ul>
      <span>Bạn vẫn có thể xem và gửi các cụm đã lấy được.</span>
    </div>
  );
}
