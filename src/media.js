// Ai viết: Codex — trích URL ảnh an toàn từ message Zalo
// Tại sao: dùng chung cho preview và forward, chỉ cho phép http/https
// Link: docs/04_PROMPTS/PROMPT-006.md + docs/05_TASKS/TASK-006.md

const MEDIA_URL_KEYS = [
  "originUrl", "oriUrl", "rawUrl", "normalUrl", "hdUrl", "full", "href",
  "thumbUrl", "previewThumb", "thumb", "url", "stickerUrl", "iconUrl",
];
const VIDEO_URL_KEYS = [
  "videoUrl", "video_url", "originUrl", "oriUrl", "rawUrl", "normalUrl", "hdUrl", "full", "href", "url",
];
const VIDEO_THUMBNAIL_KEYS = ["thumbUrl", "previewThumb", "thumb", "preview"];
const DEFAULT_PREVIEW_LIMIT = 8; // WHY: đủ xem album, tránh response quá lớn
const VIDEO_PREVIEW_KEYS = ["thumbUrl", "previewThumb", "thumb", "preview", ...MEDIA_URL_KEYS];

function isStickerMessage(message) {
  return String(message?.msgType || message?.type || "").toLowerCase() === "chat.sticker";
}

function isSafeImageUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function mediaObjects(item) {
  const message = item?.data ?? item ?? {};
  const objects = [message];
  if (message.content && typeof message.content === "object") objects.push(message.content);
  else if (typeof message.content === "string" && message.content.startsWith("{")) {
    try {
      objects.push(JSON.parse(message.content));
    } catch {
      // Nội dung text bắt đầu bằng "{" nhưng không phải JSON media.
    }
  }
  return { message, objects };
}

function firstSafeUrl(objects, keys) {
  for (const key of keys) {
    const url = objects.map((media) => media?.[key]).find(isSafeImageUrl);
    if (url) return url;
  }
  return "";
}

export function isVideoItem(item) {
  const { message, objects } = mediaObjects(item);
  return objects.some((media) => String(media?.msgType || media?.type || "").toLowerCase().includes("video"))
    || String(message.msgType || message.type || "").toLowerCase().includes("video");
}

export function videoUrls(item) {
  if (!isVideoItem(item)) return [];
  const { objects } = mediaObjects(item);
  const url = firstSafeUrl(objects, VIDEO_URL_KEYS);
  return url ? [url] : [];
}

export function photoUrls(item) {
  const { message, objects } = mediaObjects(item);
  if (isStickerMessage(message)) return []; // WHY: sticker nguồn không được forward như ảnh.
  const preferredKeys = isVideoItem(item) ? VIDEO_PREVIEW_KEYS : MEDIA_URL_KEYS;
  const url = firstSafeUrl(objects, preferredKeys);
  return url ? [url] : []; // WHY: các URL còn lại thường chỉ là biến thể thumbnail của cùng một ảnh.
}

export function attachmentUrls(item) {
  if (isStickerMessage(item?.data ?? item ?? {})) return [];
  if (isVideoItem(item)) {
    const directVideo = videoUrls(item)[0];
    if (directVideo) {
      const { objects } = mediaObjects(item);
      return [{ url: directVideo, type: "video", thumbnailUrl: firstSafeUrl(objects, VIDEO_THUMBNAIL_KEYS) }];
    }
    const preview = photoUrls(item)[0];
    return preview ? [{ url: preview, type: "image" }] : [];
  }
  return photoUrls(item).map((url) => ({ url, type: "image" }));
}

export function extractPhotoUrls(items, limit = DEFAULT_PREVIEW_LIMIT) {
  return [...new Set((items || []).flatMap(photoUrls))].slice(0, limit);
}
