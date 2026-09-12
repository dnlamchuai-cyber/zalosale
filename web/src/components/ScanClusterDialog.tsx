// Ai viết: Codex — xem chi tiết các phần của một cụm tin đã quét
// Tại sao: bảng chỉ nên tóm tắt, dialog giữ đủ thứ tự chữ và album để duyệt trước khi gửi
// Link: docs/05_TASKS/TASK-006.md — yêu cầu xem phòng trong cụm

import { useState } from "react";
import type { ScanClusterItem } from "../types";
import { ImageLightbox } from "./ImageLightbox";

// Tin đầu là bài mở cụm; từng tin chữ phía sau là một phòng/caption do người đăng gửi.
export function roomTextItems(items: ScanClusterItem[]) {
  return items.slice(1).filter((item) => Boolean(item.text.trim()));
}

export function ScanClusterDialog({ items, onClose }: { items: ScanClusterItem[]; onClose: () => void }) {
  const rooms = roomTextItems(items);
  const [zoom, setZoom] = useState<{ photos: string[]; index: number } | null>(null);
  const allPhotos = items.flatMap((item) => item.photoUrls);
  const openPhoto = (url: string) => setZoom({ photos: allPhotos, index: Math.max(0, allPhotos.indexOf(url)) });
  return (
    <div className="cluster-dialog" role="dialog" aria-modal="true" aria-label="Chi tiết cụm tin">
      <div className="cluster-dialog-card">
        <button className="cluster-dialog-close" type="button" onClick={onClose} aria-label="Đóng chi tiết cụm">×</button>
        <h3>Chi tiết cụm tin</h3>
        <p className="hint">{items.length} phần theo đúng thứ tự gửi</p>
        {rooms.length > 0 && <>
          <h4>Danh sách phòng ({rooms.length})</h4>
          <ol className="cluster-rooms">{rooms.map((item, index) => <li key={`${item.ts}-${index}`}>{item.text}</li>)}</ol>
        </>}
        <ol className="cluster-items">
          {items.map((item, index) => (
            <li key={`${item.ts}-${index}`}>
              {item.text && <div className="cluster-text">{item.text}</div>}
              {item.photoUrls.length > 0 && (
                <div className="cluster-photos">
                  {item.photoUrls.map((url, photoIndex) => (
                    <button
                      key={url}
                      type="button"
                      className="cluster-photo-button"
                      aria-label={`Xem ảnh ${photoIndex + 1} của phần ${index + 1}`}
                      onClick={() => openPhoto(url)}
                    >
                      <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
      {zoom && (
        <ImageLightbox
          photos={zoom.photos}
          index={zoom.index}
          onIndex={(index) => setZoom((current) => (current ? { ...current, index } : current))}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}
