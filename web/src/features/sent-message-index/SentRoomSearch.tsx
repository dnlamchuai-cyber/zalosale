// Ai viết: Codex — UI tìm lại tin phòng đã gửi
// Tại sao: một panel độc lập hiển thị dữ liệu thật từ typed API
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type { SentRoomSummary } from "../../types";

const STATUS_LABEL = {
  unknown: "Chưa xác định",
  available: "Còn phòng",
  reserved: "Đang giữ chỗ",
  rented: "Đã thuê",
} as const;

const MAX_SENT_ROOMS = 100;
const ROOMS_PER_PAGE = 8;

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function SentRoomSearch() {
  const [query, setQuery] = useState("");
  const [rooms, setRooms] = useState<SentRoomSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | SentRoomSummary["status"]>("");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);

  const loadRooms = useCallback(async (searchQuery: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.sentRooms(searchQuery, MAX_SENT_ROOMS);
      setRooms(response.rooms);
      setPage(0);
    } catch (loadError) {
      setError((loadError as Error).message || "Không tải được kho tin");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRooms(""); }, [loadRooms]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void loadRooms(query.trim());
  }

  async function clearRooms() {
    if (!window.confirm("Xóa toàn bộ kho tin local? Việc này không xóa tin trên Zalo nhưng có thể làm bài cũ được gửi lại khi quét.")) return;
    setClearing(true);
    try {
      await api.clearSentRooms();
      setRooms([]);
      resetFilters();
    } catch (clearError) {
      setError((clearError as Error).message || "Không thể xóa kho tin");
    } finally {
      setClearing(false);
    }
  }

  const destinationOptions = useMemo(() => {
    const destinations = new Map<string, string>();
    rooms.forEach((room) => room.destinations.forEach((destination) => destinations.set(destination.id, destination.name)));
    return [...destinations].sort((left, right) => left[1].localeCompare(right[1], "vi"));
  }, [rooms]);

  const filteredRooms = useMemo(() => rooms.filter((room) =>
    (!statusFilter || room.status === statusFilter)
    && (!destinationFilter || room.destinations.some((destination) => destination.id === destinationFilter)),
  ), [destinationFilter, rooms, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / ROOMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleRooms = filteredRooms.slice(currentPage * ROOMS_PER_PAGE, (currentPage + 1) * ROOMS_PER_PAGE);
  const resetFilters = () => {
    setStatusFilter("");
    setDestinationFilter("");
    setPage(0);
  };

  return (
    <section className="panel sent-room-panel" aria-labelledby="sent-room-title">
      <h2 id="sent-room-title">🔎 Kho tin đã gửi</h2>
      <p className="hint">Tìm nhanh, lọc tại chỗ và xem lịch sử gửi theo từng phòng.</p>
      <div className="sent-room-toolbar">
        <form className="sent-room-search" onSubmit={handleSubmit}>
          <label className="field">
            <span>Tìm mã phòng hoặc địa chỉ</span>
            <input type="search" value={query} maxLength={200}
              placeholder="Ví dụ: R151 hoặc Trung Kính"
              onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button className="primary" type="submit" disabled={loading}>Tìm kiếm</button>
          <button className="mini danger" type="button" onClick={() => void clearRooms()} disabled={clearing || loading}>🗑 Xóa kho local</button>
        </form>
        <div className="sent-room-filters" aria-label="Bộ lọc kho tin đã gửi">
          <label className="field">
            <span>Trạng thái</span>
            <select aria-label="Lọc trạng thái" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "" | SentRoomSummary["status"]); setPage(0); }}>
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Nhóm đích</span>
            <select aria-label="Lọc nhóm đích" value={destinationFilter} onChange={(event) => { setDestinationFilter(event.target.value); setPage(0); }}>
              <option value="">Tất cả nhóm đích</option>
              {destinationOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <button className="mini" type="button" onClick={resetFilters} disabled={!statusFilter && !destinationFilter}>Xóa lọc</button>
        </div>
      </div>
      {loading && <p className="sent-room-state" role="status">Đang tải kho tin...</p>}
      {error && <p className="sent-room-state error" role="alert">{error}</p>}
      {!loading && !error && rooms.length === 0 && (
        <p className="sent-room-state">Chưa có tin phù hợp. Tin bot gửi thành công từ bây giờ sẽ được lưu tại đây.</p>
      )}
      {!loading && !error && rooms.length > 0 && (
        <>
          {visibleRooms.length === 0 ? (
            <p className="sent-room-state">Không có tin khớp bộ lọc.</p>
          ) : (
            <div className="sent-room-results">
              <table className="sent-room-table" aria-label="Danh sách tin đã gửi">
                <thead><tr><th>Mã phòng</th><th>Nội dung</th><th>Trạng thái</th><th>Nguồn</th><th>Nhóm đích</th><th>Đã gửi</th><th>Gần nhất</th></tr></thead>
                <tbody>{visibleRooms.map((room) => (
                  <tr key={room.id}>
                    <td><strong className="sent-room-code">{room.roomCode}</strong></td>
                    <td className="sent-room-content" title={room.latestContent}>{room.latestContent || "Tin không có nội dung chữ"}</td>
                    <td><span className={`room-status status-${room.status}`}>{STATUS_LABEL[room.status]}</span></td>
                    <td>{room.sourceGroups.map((group) => group.name).join(", ") || "Không xác định"}</td>
                    <td><div className="destination-list">{room.destinations.map((destination) => <span key={destination.id}>{destination.name} ({destination.sentCount})</span>)}</div></td>
                    <td>{room.sentCount} lần</td>
                    <td>{formatTime(room.lastSentAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="pager sent-room-pager">
            <button className="mini" type="button" disabled={currentPage === 0} onClick={() => setPage((value) => value - 1)}>‹ Trước</button>
            <span className="hint">Trang {currentPage + 1} / {totalPages} · {filteredRooms.length} tin</span>
            <button className="mini" type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage((value) => value + 1)}>Sau ›</button>
          </div>
        </>
      )}
    </section>
  );
}
