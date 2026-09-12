// Ai viết: Muse Spark — lightbox xem ảnh dùng chung, có qua/lại
// Tại sao: bảng quét và dialog cụm trước đây mỗi nơi một lightbox đơn, không chuyển ảnh được
// Link: phản hồi user ngày 2026-09-12 (thêm mũi tên 2 bên để chuyển ảnh)

import { useEffect } from "react";

export function ImageLightbox({ photos, index, onIndex, onClose }: {
  photos: string[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const total = photos.length;
  const current = total ? Math.min(Math.max(0, index), total - 1) : 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onIndex((current - 1 + total) % total);
      if (event.key === "ArrowRight") onIndex((current + 1) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, total, onClose, onIndex]);

  if (!total) return null;
  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh phòng">
      <div className="image-lightbox-frame">
        <button className="image-lightbox-close" type="button" onClick={onClose} aria-label="Đóng ảnh">×</button>
        <div className="image-lightbox-body">
          {total > 1 && (
            <button className="image-lightbox-nav prev" type="button" aria-label="Ảnh trước" onClick={() => onIndex((current - 1 + total) % total)}>‹</button>
          )}
          <img src={photos[current]} alt={`Ảnh phòng ${current + 1}/${total}`} referrerPolicy="no-referrer" />
          {total > 1 && (
            <button className="image-lightbox-nav next" type="button" aria-label="Ảnh sau" onClick={() => onIndex((current + 1) % total)}>›</button>
          )}
        </div>
        {total > 1 && <div className="image-lightbox-count">{`${current + 1}/${total}`}</div>}
      </div>
    </div>
  );
}
