// Ai viết: Codex — điều khiển lọc/sắp xếp kết quả quét
// Tại sao: tách UI filter khỏi bảng để ScanReview giữ trách nhiệm gửi và chọn tin
// Link: docs/05_TASKS/TASK-006.md — yêu cầu lọc bảng quét

export type ScanSort = "newest" | "oldest" | "source" | "price-high" | "price-low" | "commission-high";

export function ScanFilters({
  sources, keywords, source, onSource, keyword, onKeyword, status, onStatus, query, onQuery, media, onMedia, commission, onCommission, priceMin, onPriceMin, priceMax, onPriceMax, commissionMin, onCommissionMin, sort, onSort, onReset,
}: {
  sources: string[]; keywords: string[]; source: string; onSource: (value: string) => void; keyword: string; onKeyword: (value: string) => void; query: string; onQuery: (value: string) => void;
  status: string; onStatus: (value: string) => void;
  media: string; onMedia: (value: string) => void; commission: string; onCommission: (value: string) => void;
  priceMin: string; onPriceMin: (value: string) => void; priceMax: string; onPriceMax: (value: string) => void;
  commissionMin: string; onCommissionMin: (value: string) => void;
  sort: ScanSort; onSort: (value: ScanSort) => void; onReset: () => void;
}) {
  return <div className="scan-filters" aria-label="Bộ lọc kết quả quét">
    <select aria-label="Lọc nhóm nguồn" value={source} onChange={(event) => onSource(event.target.value)}><option value="">Tất cả nhóm nguồn</option>{sources.map((name) => <option key={name}>{name}</option>)}</select>
    <select aria-label="Lọc từ khóa đích" value={keyword} onChange={(event) => onKeyword(event.target.value)}><option value="">Từ khóa đích: tất cả</option>{keywords.map((name) => <option key={name}>{name}</option>)}</select>
    <select aria-label="Lọc trạng thái" value={status} onChange={(event) => onStatus(event.target.value)}><option value="">Trạng thái: tất cả</option><option value="missing_location">Thiếu địa danh</option><option value="building_full">Thông báo hết phòng</option><option value="text_only">Chỉ có chữ</option><option value="media_only">Chỉ có ảnh/video</option><option value="missing_opening">Thiếu tin mở cụm</option><option value="pending">Chưa gửi</option><option value="sent">Đã gửi</option><option value="error">Lỗi</option><option value="duplicate">Trùng</option></select>
    <input aria-label="Lọc nội dung hoặc mã phòng" type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Lọc mã/nội dung" />
    <select aria-label="Lọc ảnh" value={media} onChange={(event) => onMedia(event.target.value)}><option value="">Ảnh: tất cả</option><option value="yes">Có ảnh</option><option value="no">Không ảnh</option></select>
    <select aria-label="Lọc hoa hồng" value={commission} onChange={(event) => onCommission(event.target.value)}><option value="">Hoa hồng: tất cả</option><option value="yes">Có hoa hồng</option><option value="no">Không hoa hồng</option></select>
    <input aria-label="Giá thấp nhất (triệu)" type="number" min={0} value={priceMin} onChange={(event) => onPriceMin(event.target.value)} placeholder="Giá từ (tr)" />
    <input aria-label="Giá cao nhất (triệu)" type="number" min={0} value={priceMax} onChange={(event) => onPriceMax(event.target.value)} placeholder="Đến (tr)" />
    <input aria-label="Hoa hồng tối thiểu (%)" type="number" min={0} max={100} value={commissionMin} onChange={(event) => onCommissionMin(event.target.value)} placeholder="HH từ (%)" />
    <select aria-label="Sắp xếp kết quả" value={sort} onChange={(event) => onSort(event.target.value as ScanSort)}><option value="oldest">Cũ → mới</option><option value="newest">Mới → cũ</option><option value="source">Theo nhóm nguồn</option><option value="price-high">Giá cao → thấp</option><option value="price-low">Giá thấp → cao</option><option value="commission-high">Hoa hồng cao → thấp</option></select>
    <button className="mini" type="button" onClick={onReset}>Xóa lọc</button>
  </div>;
}
