// AI: Codex | WHY: Preview and delivery share catch-all destination selection.
// SPEC: docs/03_SPEC/SPEC-003.md
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { ThreadType } from "zca-js";
import { logger } from "./logger.js";
import { TEMP_DIR } from "./config.js";
import { cleanText, isExcluded, isInPriceRange, normalizeText, parsePrice } from "./processor.js";
import { classifyArea, classifyAreas, classifyAreasDetailed, destinationLabel, detectHanoiDistrict, findAreaMatch } from "./classifier.js";
import { buildingKeyFromText, buildingNoticeMatchesText, parseFullBuildingNotice } from "./full-building.js";
import { extractPhotoUrls, photoUrls, videoUrls } from "./media.js";
import { buildDeliveryUnits } from "./delivery.js";
import { isStickerMessage } from "./closing-sticker.js";
import { contentHash } from "./features/sent-message-index/normalize.js";
import { loadRulesCached } from "./features/location-rules/repository.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// WHY: lệnh gửi Zalo treo là cả hàng đợi đứng theo — quá hạn thì bỏ cụm đó để đi tiếp
// (chấp nhận rủi ro nhỏ gửi trùng nếu server thực ra đã nhận; kho tin chặn trùng ở lượt sau).
function sendWithTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} quá ${Math.round(ms / 1000)}s không phản hồi`)), ms);
  });
  return Promise.race([
    promise.then(
      (value) => {
        clearTimeout(timer);
        return value;
      },
      (error) => {
        clearTimeout(timer);
        throw error;
      },
    ),
    timeout,
  ]);
}
const MAX_PARALLEL_IMAGE_DOWNLOADS = 6; // WHY: tải 6 ảnh cùng lúc cho kịp cụm đông, vẫn nhẹ mạng.

function isRecognizedOpeningSegment(payload) {
  const segmentType = payload?.segmentType ?? payload?.items?.batchMeta?.segmentType;
  return segmentType === "building" || segmentType === "lead";
}

function parseAttachmentLimit(error) {
  const message = String(error?.message || error || "");
  const match = message.match(/maximum\s+file(?:s)?\s+of\s+(\d+)/i);
  const limit = Number(match?.[1]);
  return Number.isInteger(limit) && limit > 0 ? limit : null;
}

function splitFiles(files, limit) {
  const chunks = [];
  for (let index = 0; index < files.length; index += limit) {
    chunks.push(files.slice(index, index + limit));
  }
  return chunks;
}

function mediaKey(unitIndex, mediaIndex) {
  return `${unitIndex}:${mediaIndex}`;
}

/** Tách video native khỏi album ảnh nhưng vẫn giữ nguyên thứ tự media nguồn. */
function prepareDeliveryUnits(deliveryUnits, downloadedFiles) {
  const prepared = [];
  for (const [unitIndex, unit] of deliveryUnits.entries()) {
    if (unit.kind === "text") {
      prepared.push({ kind: "text", text: unit.text });
      continue;
    }
    let imageFiles = [];
    const flushImages = () => {
      if (imageFiles.length) prepared.push({ kind: "images", files: imageFiles });
      imageFiles = [];
    };
    for (const [mediaIndex, media] of unit.urls.entries()) {
      if (media.type === "video") {
        flushImages();
        prepared.push({ kind: "video", videoUrl: media.url, thumbnailUrl: media.thumbnailUrl });
      } else {
        const file = downloadedFiles.get(mediaKey(unitIndex, mediaIndex));
        if (file) imageFiles.push(file);
      }
    }
    flushImages();
  }
  return prepared;
}

function isTextItem(item) {
  return typeof item?.data?.content === "string" && !isStickerMessage(item?.data ?? item);
}

/** Loại từng tin chữ theo từ khóa, không hủy cả cụm còn tin/ảnh hợp lệ. */
export function filterExcludedTextItems(items, excludeKeywords = []) {
  return (items || []).filter((item) => {
    if (!isTextItem(item)) return true;
    return !isExcluded(item.data.content, excludeKeywords);
  });
}

/** ID tin Zalo trong cụm (msgId/cliMsgId) — để quét lại loại đúng tin cũ đã gửi. */
export function messageIdsOf(items) {
  const ids = [];
  for (const item of items || []) {
    const data = item?.data ?? {};
    if (data.msgId) ids.push(String(data.msgId));
    if (data.cliMsgId) ids.push(String(data.cliMsgId));
  }
  return [...new Set(ids)];
}

export async function mapWithConcurrency(values, limit, worker) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), values.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await worker(values[index], index);
    }
  }));
  return results;
}

export class Forwarder {
  constructor(api, config, onForwarded = () => {}, onDelivery = async () => {}, isPreviouslySent = async () => false, closingStickerStore = null) {
    this.api = api;
    this.config = config;
    this.onForwarded = onForwarded;
    this.onDelivery = onDelivery;
    this.isPreviouslySent = isPreviouslySent;
    this.closingStickerStore = closingStickerStore;
    this.pendingPayloads = [];
    this.activeForwardWorkers = 0;
    this.availableSendLanes = [0, 1];
    this.scheduled = new Set();
    this.nextSendAtByLane = [0, 0];
    this.destinationTails = new Map();
    this.fullBuildings = new Map();
    this.seen = new Set();
    this.sending = new Set();
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

  /** Chỉ chấp nhận đích kế thừa vẫn tồn tại trong config, tránh metadata giả gửi sai nhóm. */
  resolveInheritedDestinations(candidates = []) {
    const configured = Array.isArray(this.config.areas) ? this.config.areas : [];
    const matched = candidates.flatMap((candidate) => {
      const hit = configured.find((area) =>
        area === candidate
        || (candidate?.id && String(area.id) === String(candidate.id))
        || (candidate?.groupLink && area.groupLink === candidate.groupLink)
      );
      return hit ? [hit] : [];
    });
    return [...new Set(matched)];
  }

  selectDestinations(text, candidates = []) {
    const inherited = this.resolveInheritedDestinations(candidates);
    if (!inherited.length) return classifyAreas(text, this.config.areas, this.config.defaultArea, this.locationRules());
    const catchAll = this.config.areas.filter((area) => area.matchAll === true);
    return [...new Set([...inherited, ...catchAll])];
  }

  /** Kho địa danh local (tự mới khi file đổi). Test có thể gán forwarder._rulesOverride. */
  locationRules() {
    if (this._rulesOverride !== undefined) return this._rulesOverride;
    try {
      return loadRulesCached().rules;
    } catch {
      return [];
    }
  }

  /**
   * Mô tả 1 bài đăng (dùng cho preview trước khi gửi) — KHÔNG gửi gì cả.
   * Trả về: { text, clean, area, areaName, kw, photoCount, excluded, fullBuilding }
   */
  describePost(items, inheritedDestinations = [], inheritedReason = null, inheritedMatched = []) {
    const originalTextCount = (items || []).filter(isTextItem).length;
    items = filterExcludedTextItems(items, this.config.excludeKeywords);
    const hasRemainingText = items.some(isTextItem);
    const text = items.filter(isTextItem).map((it) => it.data.content).join("\n\n");
    const photos = items.filter((it) => photoUrls(it).length > 0);
    const fullBuilding = parseFullBuildingNotice(text);
    const clean = cleanText(text, {
      deleteLines: this.config.deleteLines,
      removePercentLines: this.config.filter.removePercentLines,
      removePriceLines: this.config.filter.removePriceLines,
    });
    const destinations = this.selectDestinations(text, inheritedDestinations);
    const area = destinations[0] ?? classifyArea(text, this.config.areas, this.config.defaultArea);
    const areaMatch = area ? findAreaMatch(text, area) : null;
    const routing = classifyAreasDetailed(text, this.config.areas, this.config.defaultArea, this.locationRules());
    const detectedArea = areaMatch ?? detectHanoiDistrict(text);
    const price = parsePrice(text);
    const inPriceRange = isInPriceRange(text, this.config.priceRange);
    return {
      text,
      clean,
      area,
      destinations,
      destinationNames: destinations.map(destinationLabel),
      areaName: area ? destinationLabel(area) : null,
      detectedArea: detectedArea
        ? (normalizeText(detectedArea.district) === normalizeText(detectedArea.keyword)
          ? detectedArea.district
          : `${detectedArea.district} · ${detectedArea.keyword}`)
        : null,
      kw: area ? (area.keywords || []).join(", ") : "",
      photoCount: photos.length,
      photoUrls: extractPhotoUrls(items),
      // Chỉ đánh dấu loại trừ nếu mọi tin chữ của cụm đều đã bị loại.
      // Một reply/thông báo bị loại không được làm mờ cả cụm còn lại.
      excluded: originalTextCount > 0 && !hasRemainingText,
      price: price?.first ?? null,
      inPriceRange,
      isFullBuilding: Boolean(fullBuilding),
      fullBuilding: fullBuilding?.label || null,
      routingReason: routing.reason || inheritedReason || null,
      routingKeys: routing.destinations.map((d) => d.routingKey || ""),
      matchedRules: routing.matchedRules.length ? routing.matchedRules.map((r) => ({ name: r.name, type: r.type })) : (inheritedMatched || []),
      // Chưa xác định = không có nhóm đích nào (kể cả thừa kế từ cụm mở).
      undetermined: destinations.length === 0,
    };
  }

  /** Nối vào tối đa hai luồng gửi; từng luồng vẫn giữ đúng thứ tự media của cụm. */
  enqueue(payload) {
    const notBefore = Number(payload.notBefore || 0);
    if (notBefore > Date.now()) {
      return new Promise((resolve) => {
        const entry = { timer: null, resolve };
        entry.timer = setTimeout(() => {
          this.scheduled.delete(entry);
          this.enqueueNow(payload).then(resolve, resolve);
        }, notBefore - Date.now());
        this.scheduled.add(entry);
      });
    }
    return this.enqueueNow(payload);
  }

  enqueueNow(payload) {
    return new Promise((resolve) => {
      this.pendingPayloads.push({ payload, resolve });
      this.drainQueue();
    });
  }

  parallelSendLimit() {
    return Math.min(2, Math.max(1, Math.floor(Number(this.config.forward.parallelSends) || 1)));
  }

  drainQueue() {
    while (this.pendingPayloads.length && this.activeForwardWorkers < this.parallelSendLimit()) {
      const entry = this.pendingPayloads.shift();
      const sendLane = this.availableSendLanes.shift();
      this.activeForwardWorkers++;
      void this.runQueuedPayload(entry, sendLane).finally(() => {
        this.activeForwardWorkers--;
        this.availableSendLanes.push(sendLane);
        this.drainQueue();
      });
    }
  }

  async runQueuedPayload(entry, sendLane) {
    let outcome;
    try {
      const { payload } = entry;
      if (payload.beforeSend && !(await payload.beforeSend())) {
        logger.info(`Bỏ qua bài ${payload.source || "queued"}: không còn tồn tại ở nhóm nguồn`);
        outcome = { sent: false, skipped: true };
        return;
      }
      outcome = await this.forwardPayload({ ...payload, sendLane });
    } catch (e) {
      logger.error(`Lỗi forward: ${e.stack}`);
      outcome = { sent: false, error: true };
    } finally {
      entry.resolve(outcome || { sent: false, error: true });
    }
  }

  stop() {
    for (const entry of this.scheduled) {
      clearTimeout(entry.timer);
      entry.resolve({ sent: false, skipped: true, cancelled: true });
    }
    this.scheduled.clear();
    for (const entry of this.pendingPayloads.splice(0)) {
      entry.resolve({ sent: false, skipped: true, cancelled: true });
    }
  }

  async waitForSendSlot(sendLane = 0) {
    const interval = Math.max(0, Number(this.config.forward.sendDelayMs) || 0);
    const lane = Number.isInteger(sendLane) && sendLane >= 0 ? sendLane : 0;
    const waitMs = Math.max(0, (this.nextSendAtByLane[lane] || 0) - Date.now());
    if (waitMs) await sleep(waitMs);
    this.nextSendAtByLane[lane] = Date.now() + interval;
  }

  /** Giữ chữ, ảnh và sticker của một cụm liền nhau trong cùng nhóm đích. */
  async sendInDestinationOrder(destId, send) {
    const previous = this.destinationTails.get(destId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    this.destinationTails.set(destId, current);
    await previous;
    try {
      return await send();
    } finally {
      release();
      if (this.destinationTails.get(destId) === current) this.destinationTails.delete(destId);
    }
  }

  markBuildingFull(threadId, notice) {
    if (!notice?.key) return;
    this.fullBuildings.set(`${String(threadId)}|${notice.key}`, notice);
  }

  isBuildingFull(threadId, buildingKey, text = "", options = {}) {
    const key = String(buildingKey || "");
    if (!key) return false;
    const notice = this.fullBuildings.get(`${String(threadId)}|${key}`);
    return Boolean(notice && buildingNoticeMatchesText(text, notice, options));
  }

  /**
   * payload: { threadId (nguồn), items: [{raw, data}], source: "live"|"history" }
   * Flow: gom text → loại trừ → làm sạch → nhận định khu vực → download ảnh → gửi
   */
  async forwardPayload(payload) {
    const items = filterExcludedTextItems(payload.items, this.config.excludeKeywords);
    const excludedItemCount = (payload.items?.length || 0) - items.length;
    if (excludedItemCount) logger.info(`Bỏ ${excludedItemCount} tin chứa từ khoá loại trừ khỏi cụm ${payload.threadId}`);

    const text = items.filter(isTextItem).map((it) => it.data.content).join("\n\n");
    const photos = items.filter((it) => photoUrls(it).length > 0);
    const hasVideo = items.some((item) => videoUrls(item).length > 0);
    const hasVisualMedia = photos.length > 0 || hasVideo;
    const isStandalonePhotoCluster = photos.length > 0 && !hasVideo && !text.trim();
    const segmentType = payload.segmentType ?? items?.batchMeta?.segmentType;

    // Cụm lấy từ bot phải có tin mở thật. Nhãn P101 + ảnh là phần phụ của
    // cụm, không được tự gửi nếu không có tin mở để nhận diện bài đăng.
    if (this.config.forward.skipTextOnly !== false && segmentType && !isRecognizedOpeningSegment(payload)) {
      logger.info(`Bỏ qua cụm không có tin mở từ nhóm ${payload.threadId}`);
      return { sent: false, skipped: true, reason: "missing-opening-segment" };
    }

    if (!text.trim() && !photos.length) {
      logger.debug("Bỏ qua: bài đăng không có text và ảnh");
      return { sent: false };
    }
    if (this.config.forward.skipTextOnly !== false && (!hasVisualMedia || isStandalonePhotoCluster) && !payload.videoOnly) {
      logger.info(`Bỏ qua cụm thiếu mô tả/ảnh-video từ nhóm ${payload.threadId}`);
      return { sent: false, skipped: true, reason: "incomplete-visual-cluster" };
    }

    const fullNotice = parseFullBuildingNotice(text);
    if (fullNotice) {
      this.markBuildingFull(payload.threadId, fullNotice);
      logger.info(`Bỏ qua thông báo full tòa ${fullNotice.label} — không forward`);
      return { sent: false, skipped: true, reason: "building-full", fullBuilding: fullNotice.label };
    }
    const buildingKey = payload.buildingKey || buildingKeyFromText(text);
    const requireName = buildingKeyFromText(text) === String(buildingKey || "").toLowerCase();
    if (this.isBuildingFull(payload.threadId, buildingKey, text, { requireName })) {
      logger.info(`Bỏ qua bài thuộc tòa đã full: ${buildingKey}`);
      return { sent: false, skipped: true, reason: "building-full", fullBuilding: buildingKey };
    }

    if (isExcluded(text, this.config.excludeKeywords)) {
      logger.info(`Bỏ qua (loại trừ): ${payload.source} — từ khoá loại trừ trong bài: ${JSON.stringify(this.config.excludeKeywords)}`);
      return { sent: false };
    }

    if (!isInPriceRange(text, this.config.priceRange)) {
      logger.info(`Bỏ qua (giá ngoài khoảng): ${payload.source} — bài không trong khoảng giá ${JSON.stringify(this.config.priceRange)}`);
      return { sent: false };
    }

    // Gửi lại từ kho phải giữ nguyên các nhóm đã chọn trước đó, không chạy lại định tuyến.
    const destinations = Array.isArray(payload.resendDestinations) && payload.resendDestinations.length
      ? payload.resendDestinations
      : this.selectDestinations(text, payload.inheritedDestinations);
    if (!destinations.length) {
      logger.warn(`Không nhận định được khu vực cho bài đăng từ nhóm ${payload.threadId} — bỏ qua (hãy bổ sung từ khoá hoặc defaultArea)`);
      return { sent: false };
    }

    const clean = cleanText(text, {
      deleteLines: this.config.deleteLines,
      removePercentLines: this.config.filter.removePercentLines,
      removePriceLines: this.config.filter.removePriceLines,
    });
    if (!clean && !photos.length) {
      logger.warn("Sau khi làm sạch bài đăng trống — bỏ qua");
      return { sent: false };
    }

    const cleanOptions = {
      deleteLines: this.config.deleteLines,
      removePercentLines: this.config.filter.removePercentLines,
      removePriceLines: this.config.filter.removePriceLines,
    };
    const deliveryUnits = buildDeliveryUnits(items, cleanOptions);
    const urls = deliveryUnits.flatMap((unit) => (unit.urls || []).map(({ url }) => url));
    const files = [];
    try {
      // Cấu hình có thể đổi lúc tải trước: chỉ dùng media khớp kế hoạch gửi hiện tại.
      const media = payload.preparedMedia?.key === JSON.stringify(deliveryUnits)
        ? payload.preparedMedia : await this.preparePayloadMedia(payload);
      files.push(...media.files);
      const downloadedMedia = media.downloadedMedia;
      const preparedUnits = prepareDeliveryUnits(deliveryUnits, downloadedMedia);
      const hasVideo = preparedUnits.some((unit) => unit.kind === "video");
      const imageTotal = preparedUnits
        .filter((unit) => unit.kind === "images")
        .reduce((total, unit) => total + (unit.files?.length || 0), 0);
      // videoOnly: gửi lại riêng video (không gửi trùng chữ/ảnh).
      const videoOnly = payload.videoOnly === true;
      const bypassDedup = videoOnly || payload.forceResend === true;
      let sentCount = 0;
      let failedCount = 0;
      let duplicateCount = 0;
      let videoSent = false;
      for (const destination of destinations) {
        const destId = await this.resolveThreadId(destination);
        const signature = `${destId}|${urls.join(",")}|${clean}`;
        const alreadyStored = bypassDedup
          ? false
          : await this.isPreviouslySent({ destinationId: destId, content: clean });
        if (!bypassDedup && (this.seen.has(signature) || this.sending.has(signature) || alreadyStored)) {
          logger.info(`Bỏ qua: bài đăng trùng trong nhóm ${destId}`);
          duplicateCount++;
          continue;
        }
        logger.info(`Forward ${payload.source}: khu vực "${destinationLabel(destination)}" → nhóm ${destId} (${urls.length} media)`);
        this.sending.add(signature);
        try {
          await this.sendInDestinationOrder(destId, async () => {
            for (const unit of preparedUnits) {
              if (unit.kind === "video") {
                if (await this.sendVideoAsFile(destId, unit, files, payload.sendLane)) videoSent = true;
              } else if (!videoOnly) {
                await this.sendWithRetry(destId, unit.text, unit.files || [], payload.sendLane);
              }
            }
            await this.sendClosingSticker(destId, payload.sendLane);
          });
          // Gửi lại riêng video thì nội dung đã lưu rồi — không ghi trùng kho.
          if (!videoOnly) {
            try {
              await this.onDelivery({
                sourceGroupId: String(payload.threadId || ""),
                destinationGroup: { id: destId, name: destinationLabel(destination) },
                originalContent: text,
                sentContent: clean,
                sentAt: Date.now(),
                imageTotal: files.length,
                messageIds: messageIdsOf(items),
              });
            } catch {
              logger.error(`Đã gửi nhóm ${destId} nhưng không lưu được vào kho tin`);
            }
          }
          this.seen.add(signature);
          sentCount++;
        } catch (error) {
          failedCount++;
          logger.error(`Gửi nhóm ${destId} thất bại: ${error.stack}`);
        } finally {
          this.sending.delete(signature);
        }
      }
      if (this.seen.size > 5000) this.seen.clear();
      if (sentCount) this.onForwarded();
      logger.info(`Đã gửi bài vào ${sentCount}/${destinations.length} nhóm đích`);
      return {
        sent: sentCount > 0,
        destinations: sentCount,
        duplicate: sentCount === 0 && failedCount === 0 && duplicateCount > 0,
        error: failedCount > 0,
        videoStatus: !hasVideo ? "none" : videoSent ? "sent" : "failed",
        sentImages: sentCount > 0 && !videoOnly ? imageTotal : 0,
      };
    } finally {
      for (const f of files) fs.rmSync(f, { force: true });
    }
  }

  async preparePayloadMedia(payload, signal) {
    const items = filterExcludedTextItems(payload.items, this.config.excludeKeywords);
    const deliveryUnits = buildDeliveryUnits(items, {
      deleteLines: this.config.deleteLines,
      removePercentLines: this.config.filter.removePercentLines,
      removePriceLines: this.config.filter.removePriceLines,
    });
    const requests = deliveryUnits.flatMap((unit, unitIndex) => unit.kind === "media" && !payload.videoOnly
      ? unit.urls.map((media, mediaIndex) => ({ unitIndex, mediaIndex, ...media })).filter((media) => media.type !== "video") : []);
    const downloads = await mapWithConcurrency(requests, MAX_PARALLEL_IMAGE_DOWNLOADS, async ({ url, type }) => {
      if (signal?.aborted) return { file: null };
      try { return { file: await this.download(url, type, 30000, signal) }; }
      catch (error) { return { error }; }
    });
    const files = downloads.map((download) => download.file).filter(Boolean);
    const failure = downloads.find((download) => download.error);
    if (failure) {
      this.releasePreparedMedia({ files });
      throw failure.error;
    }
    const downloadedMedia = new Map();
    downloads.forEach(({ file }, index) => {
      if (file) downloadedMedia.set(mediaKey(requests[index].unitIndex, requests[index].mediaIndex), file);
    });
    return { key: JSON.stringify(deliveryUnits), files, downloadedMedia };
  }

  releasePreparedMedia(media) {
    for (const file of media?.files || []) fs.rmSync(file, { force: true });
  }

  async download(url, mediaType = "image", timeoutMs = 30000, signal) {
    try {
      // WHY: CDN treo là cả hàng đợi đứng theo — quá timeout thì bỏ file đó, đi tiếp.
      const timeout = AbortSignal.timeout(timeoutMs);
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const urlExtension = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1]?.toLowerCase();
      const imageExtension = ["jpg", "jpeg", "png", "gif", "webp"].includes(urlExtension) ? urlExtension : "jpg";
      const videoExtension = ["mp4", "mov", "m4v", "webm"].includes(urlExtension) ? urlExtension : "mp4";
      const ext = mediaType === "video" ? videoExtension : imageExtension;
      const file = path.join(TEMP_DIR, `photo-${Date.now()}-${this.imgIndex++}.${ext}`);
      fs.writeFileSync(file, buf);
      if (mediaType !== "video") await this.shrinkImage(file, ext);
      return file;
    } catch (e) {
      logger.warn(`Tải media thất bại: ${url.slice(0, 80)}... (${e.message})`);
      return null;
    }
  }

  /**
   * WHY: ảnh gốc 1–3MB làm hàng đợi 900 cụm tắc nghẽn ở khâu up/down.
   * Thu cạnh dài về imageMaxDim (mặc định 1600px, JPEG 80): mắt thường xem
   * điện thoại không phân biệt được, dung lượng giảm 3–5 lần. Bỏ qua gif.
   */
  async shrinkImage(file, ext) {
    if (!["jpg", "jpeg", "png", "webp"].includes(String(ext).toLowerCase())) return;
    const maxDim = Number(this.config.forward.imageMaxDim) || 0;
    if (maxDim <= 0) return;
    const quality = Math.min(100, Math.max(10, Number(this.config.forward.imageQuality) || 80));
    try {
      const before = fs.statSync(file).size;
      const meta = await sharp(file).metadata();
      if (!meta.width || !meta.height) return;
      if (Math.max(meta.width, meta.height) <= maxDim) return;
      const format = meta.format === "png" ? "png" : meta.format === "webp" ? "webp" : "jpeg";
      const tmp = `${file}.small`;
      await sharp(file)
        .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
        .toFormat(format, { quality })
        .toFile(tmp);
      const after = fs.statSync(tmp).size;
      if (after >= before) {
        fs.rmSync(tmp, { force: true });
        return;
      }
      fs.renameSync(tmp, file);
      logger.debug(`Nén ảnh ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB (${meta.width}x${meta.height})`);
    } catch (e) {
      logger.debug(`Bỏ qua nén ảnh ${file} (${e.message}) — gửi bản gốc`);
      try {
        fs.rmSync(`${file}.small`, { force: true });
      } catch {}
    }
  }

  async sendWithRetry(destId, text, files, sendLane = 0) {
    const pendingBatches = [{ text: text || "", files: [...files] }];
    while (pendingBatches.length) {
      const batch = pendingBatches.shift();
      try {
        await this.sendBatchWithRetry(destId, batch.text, batch.files, sendLane);
      } catch (error) {
        const limit = parseAttachmentLimit(error);
        if (!limit || batch.files.length <= limit) throw error;
        const chunks = splitFiles(batch.files, limit);
        logger.warn(`Album ${batch.files.length} media vượt giới hạn ${limit} — tách thành ${chunks.length} album theo thứ tự`);
        pendingBatches.unshift(...chunks.map((chunk, index) => ({
          text: index === 0 ? batch.text : "",
          files: chunk,
        })));
      }
    }
  }

  // WHY: Zalo luôn từ chối video native ("Tham số không hợp lệ") — bỏ native,
  // tải video về và gửi thẳng dạng file đính kèm. Video nặng nên chờ lâu hơn ảnh;
  // tải lỗi thì bỏ video, vẫn gửi chữ + ảnh còn lại (trả về false).
  async sendVideoAsFile(destId, unit, cleanupFiles, sendLane = 0) {
    const videoFile = await this.download(unit.videoUrl, "video", 120000);
    if (!videoFile) {
      logger.warn("Bỏ video (tải quá 120s hoặc lỗi) — vẫn gửi chữ và ảnh còn lại của cụm");
      return false;
    }
    cleanupFiles.push(videoFile);
    await this.sendWithRetry(destId, "", [videoFile], sendLane);
    return true;
  }

  async sendBatchWithRetry(destId, text, files, sendLane = 0) {
    const { retries, sendTimeoutMs = 60000 } = this.config.forward;
    const pendingFiles = [...files];
    let attempt = 0;

    while (true) {
      try {
        if (pendingFiles.length) {
          // Gửi tuần tự từng batch để API giữ đúng thứ tự media.
          await this.waitForSendSlot(sendLane);
          await sendWithTimeout(
            this.api.sendMessage({ msg: text || "", attachments: pendingFiles }, destId, ThreadType.Group),
            sendTimeoutMs,
            "Gửi tin",
          );
          return;
        }
        if (text) {
          await this.waitForSendSlot(sendLane);
          await sendWithTimeout(this.api.sendMessage(text, destId, ThreadType.Group), sendTimeoutMs, "Gửi tin");
        }
        return;
      } catch (e) {
        const limit = parseAttachmentLimit(e);
        if (limit && pendingFiles.length > limit) throw e;
        const delay = 1000 * 2 ** attempt;
        if (attempt >= retries) throw e;
        logger.warn(`Gửi thất bại lần ${attempt + 1} (${e.message}) — thử lại sau ${delay}ms`);
        attempt++;
        await sleep(delay);
      }
    }
  }

  async sendClosingSticker(destId, sendLane = 0) {
    const sticker = this.closingStickerStore?.get();
    if (!sticker) return;
    const { retries, sendTimeoutMs = 60000 } = this.config.forward;
    let attempt = 0;
    while (true) {
      try {
        await this.waitForSendSlot(sendLane);
        await sendWithTimeout(this.api.sendSticker(sticker, destId, ThreadType.Group), sendTimeoutMs, "Gửi sticker");
        return;
      } catch (error) {
        if (attempt >= retries) {
          logger.warn(`Nội dung cụm đã gửi nhưng sticker kết thúc lỗi (${error.message})`);
          return;
        }
        const delay = 1000 * 2 ** attempt;
        attempt++;
        await sleep(delay);
      }
    }
  }
}
