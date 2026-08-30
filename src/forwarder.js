import fs from "fs";
import path from "path";
import { ThreadType } from "zca-js";
import { logger } from "./logger.js";
import { TEMP_DIR } from "./config.js";
import { cleanText, isExcluded, isInPriceRange, parsePrice } from "./processor.js";
import { classifyArea } from "./classifier.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isTextItem(item) {
  return typeof item?.data?.content === "string";
}

function photoUrls(item) {
  const d = item?.data ?? item ?? {};
  const out = [];
  for (const key of ["originUrl", "normalUrl", "hdUrl", "full", "thumb", "url"]) {
    if (typeof d[key] === "string" && d[key].startsWith("http")) out.push(d[key]);
  }
  if (typeof d.content === "string" && d.content.startsWith("{")) {
    try {
      const j = JSON.parse(d.content);
      for (const key of ["originUrl", "normalUrl", "hdUrl", "full", "thumb", "url"]) {
        if (typeof j[key] === "string" && j[key].startsWith("http")) out.push(j[key]);
      }
    } catch {
      // bỏ qua
    }
  }
  return [...new Set(out)];
}

export class Forwarder {
  constructor(api, config, onForwarded = () => {}) {
    this.api = api;
    this.config = config;
    this.onForwarded = onForwarded;
    this.queue = Promise.resolve();
    this.seen = new Set();
    this.imgIndex = 0;
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  /** giải mã link nhóm đích → threadId (cache theo area, ưu tiên area.id nếu có) */
  async resolveThreadId(area) {
    if (area._threadId) return area._threadId;
    if (area.id) {
      area._threadId = String(area.id);
      logger.info(`Nhóm đích dùng id cấu hình: ${area._threadId}`);
      return area._threadId;
    }
    const link = String(area.groupLink || "").trim();
    if (!/zalo\.me\/g\//.test(link)) {
      throw new Error(`Link nhóm đích không hợp lệ: ${area.groupLink} (cần dạng https://zalo.me/g/...)`);
    }

    // zca-js 2.1.2: getGroupLinkInfo({link}) → lấy thẳng groupId từ link
    try {
      const info = await this.api.getGroupLinkInfo({ link });
      if (info?.groupId) {
        logger.info(`Giải mã link nhóm đích → groupId ${info.groupId} (${info.name || "?"})`);
        area._threadId = String(info.groupId);
        return area._threadId;
      }
    } catch (e) {
      logger.debug(`getGroupLinkInfo thất bại: ${e.message}`);
    }

    // Chưa vào nhóm → join qua link rồi thử lại
    try {
      logger.info("Đang join nhóm đích qua link...");
      await this.api.joinGroupLink(link);
      await sleep(1500);
      const info = await this.api.getGroupLinkInfo({ link });
      if (info?.groupId) {
        area._threadId = String(info.groupId);
        logger.info(`Đã join + giải mã nhóm đích → ${area._threadId}`);
        return area._threadId;
      }
    } catch (e) {
      logger.debug(`joinGroupLink thất bại: ${e.message}`);
    }

    throw new Error(
      `Không giải mã được link nhóm đích ${link}. Hãy mở giao diện → Tab Tổng quan → "Tải danh sách" → copy ID nhóm và dán vào ô "ID" của khu vực trong Tab Khu vực.`
    );
  }

  statusInfo() {
    return this.config.areas.map((area, i) => ({
      index: i,
      keywords: area.keywords,
      link: area.groupLink,
      resolved: Boolean(area._threadId),
    }));
  }

  /**
   * Mô tả 1 bài đăng (dùng cho preview trước khi gửi) — KHÔNG gửi gì cả.
   * Trả về: { text, clean, area, areaName, kw, photoCount, excluded }
   */
  describePost(items) {
    const text = items.filter(isTextItem).map((it) => it.data.content).join("\n\n");
    const photos = items.filter((it) => photoUrls(it).length > 0);
    const clean = cleanText(text, {
      deleteLines: this.config.deleteLines,
      removePercentLines: this.config.filter.removePercentLines,
      removePriceLines: this.config.filter.removePriceLines,
    });
    const area = classifyArea(text, this.config.areas, this.config.defaultArea);
    const price = parsePrice(text);
    const inPriceRange = isInPriceRange(text, this.config.priceRange);
    return {
      text,
      clean,
      area,
      areaName: area ? (area.keywords?.[0] || "?") : null,
      kw: area ? (area.keywords || []).join(", ") : "",
      photoCount: photos.length,
      excluded: isExcluded(text, this.config.excludeKeywords),
      price: price?.first ?? null,
      inPriceRange,
    };
  }

  /** nối vào hàng đợi (không gửi song song) */
  enqueue(payload) {
    this.queue = this.queue.then(async () => {
      try {
        await this.forwardPayload(payload);
      } catch (e) {
        logger.error(`Lỗi forward: ${e.stack}`);
      }
      await sleep(this.config.forward.sendDelayMs);
    });
    this.queue.catch(() => {});
    return this.queue;
  }

  /**
   * payload: { threadId (nguồn), items: [{raw, data}], source: "live"|"history" }
   * Flow: gom text → loại trừ → làm sạch → nhận định khu vực → download ảnh → gửi
   */
  async forwardPayload(payload) {
    const { items } = payload;

    const text = items.filter(isTextItem).map((it) => it.data.content).join("\n\n");
    const photos = items.filter((it) => photoUrls(it).length > 0);

    if (!text.trim() && !photos.length) {
      logger.debug("Bỏ qua: bài đăng không có text và ảnh");
      return;
    }

    if (isExcluded(text, this.config.excludeKeywords)) {
      logger.info(`Bỏ qua (loại trừ): ${payload.source} — từ khoá loại trừ trong bài: ${JSON.stringify(this.config.excludeKeywords)}`);
      return;
    }

    if (!isInPriceRange(text, this.config.priceRange)) {
      logger.info(`Bỏ qua (giá ngoài khoảng): ${payload.source} — bài không trong khoảng giá ${JSON.stringify(this.config.priceRange)}`);
      return;
    }

    const area = classifyArea(text, this.config.areas, this.config.defaultArea);
    if (!area) {
      logger.warn(`Không nhận định được khu vực cho bài đăng từ nhóm ${payload.threadId} — bỏ qua (hãy bổ sung từ khoá hoặc defaultArea)`);
      return;
    }

    const clean = cleanText(text, {
      deleteLines: this.config.deleteLines,
      removePercentLines: this.config.filter.removePercentLines,
      removePriceLines: this.config.filter.removePriceLines,
    });
    if (!clean && !photos.length) {
      logger.warn("Sau khi làm sạch bài đăng trống — bỏ qua");
      return;
    }

    const urls = photos.flatMap(photoUrls);
    const sig = `${urls.join(",")}|${clean}`;
    if (this.seen.has(sig)) {
      logger.info("Bỏ qua: bài đăng trùng (đã forward trước đó)");
      return;
    }
    this.seen.add(sig);
    if (this.seen.size > 5000) this.seen.clear();

    const destId = await this.resolveThreadId(area);
    logger.info(`Forward ${payload.source}: nhận định = khu vực "${area.keywords?.[0] || "?"}" → nhóm ${destId} (${urls.length} ảnh)`);

    const files = [];
    try {
      for (const url of urls) {
        const p = await this.download(url);
        if (p) files.push(p);
      }
      await this.sendWithRetry(destId, clean, files);
      this.onForwarded();
      logger.info(`Đã gửi xong ${clean ? "text + " : ""}${files.length} ảnh vào nhóm ${destId}`);
    } finally {
      for (const f of files) fs.rmSync(f, { force: true });
    }
  }

  async download(url) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = (url.match(/\.(jpe?g|png|gif|webp)/i)?.[1] || "jpg").toLowerCase();
      const file = path.join(TEMP_DIR, `photo-${Date.now()}-${this.imgIndex++}.${ext}`);
      fs.writeFileSync(file, buf);
      return file;
    } catch (e) {
      logger.warn(`Tải ảnh thất bại: ${url.slice(0, 80)}... (${e.message})`);
      return null;
    }
  }

  async sendWithRetry(destId, text, files, attempt = 0) {
    const { retries } = this.config.forward;
    try {
      if (files.length) {
        try {
          // zca-js 2.1.2: sendMessage nhận attachments = đường dẫn file local, tự upload
          await this.api.sendMessage({ msg: text || "", attachments: files }, destId, ThreadType.Group);
        } catch (albumErr) {
          logger.warn(`Gửi album thất bại (${albumErr.message}), gửi từng ảnh`);
          if (text) await this.api.sendMessage(text, destId, ThreadType.Group);
          for (const f of files) {
            await this.api.sendMessage({ msg: "", attachments: [f] }, destId, ThreadType.Group);
            await sleep(this.config.forward.sendDelayMs);
          }
        }
      } else if (text) {
        await this.api.sendMessage(text, destId, ThreadType.Group);
      }
    } catch (e) {
      const delay = 2000 * 2 ** attempt;
      if (attempt >= retries) throw e;
      logger.warn(`Gửi thất bại lần ${attempt + 1} (${e.message}) — thử lại sau ${delay}ms`);
      await sleep(delay);
      return this.sendWithRetry(destId, text, files, attempt + 1);
    }
  }
}