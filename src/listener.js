import { ThreadType } from "zca-js";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.js";
import { normalizeText, parseCommissionPercent } from "./processor.js";
import { photoUrls } from "./media.js";
import { GROUPS_CACHE_PATH } from "./config.js";
import { readPersistedGroups, toPersistedGroups } from "./group-cache.js";
import { readPersistedScanSync, writePersistedScanSync } from "./scan-state.js";
import { messageIdsOf } from "./forwarder.js";
import { extractStickerId } from "./closing-sticker.js";
import { parseFullBuildingNotice } from "./full-building.js";

const norm = (s) => normalizeText(s);
/** Khoá so khớp tên nhóm: bỏ emoji/icon/dấu câu, chỉ giữ chữ + số + khoảng trắng */
const nameKey = (s) =>
  norm(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isGroupLink = (s) => /zalo\.me\/g\//.test(String(s || ""));
const ALBUM_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const MIN_OVERLAPPING_PHOTOS = 3;
const GROUP_INFO_BATCH_SIZE = 5;
// WHY: Giảm thời gian "Quét mới" nhưng không dồn hàng chục request vào Zalo cùng lúc.
const GROUP_INFO_CONCURRENCY = 5;
// WHY: Lịch sử nhóm nặng hơn metadata; giữ pool nhỏ để không tạo tải đột biến cho Zalo.
const HISTORY_SCAN_CONCURRENCY = 3;

async function mapWithLimitedConcurrency(values, concurrency, worker) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function consume() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await worker(values[index], index);
    }
  }

  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, consume));
  return results;
}

async function getGroupInfoBatches(api, batches) {
  return mapWithLimitedConcurrency(batches, GROUP_INFO_CONCURRENCY, async (batch, batchIndex) => {
    try {
      return await api.getGroupInfo(batch);
    } catch {
      logger.warn(`getGroupInfo lô ${batchIndex + 1} lỗi — bỏ qua`);
      return null;
    }
  });
}

/** Zalo đôi khi trả lại các lát chồng nhau của cùng album; chỉ bỏ lát ảnh không chữ bị lặp. */
export function isRepeatedPhotoOnlyCluster(posts, threadId, clean, urls, timestamp) {
  if (clean || urls.length < MIN_OVERLAPPING_PHOTOS) return false;
  return posts.some((post) => {
    if (post.tid !== threadId || Math.abs((post.ts || 0) - timestamp) > ALBUM_DUPLICATE_WINDOW_MS) return false;
    const previousUrls = new Set(post.photoUrls || []);
    return urls.filter((url) => previousUrls.has(url)).length >= MIN_OVERLAPPING_PHOTOS;
  });
}

/** Xóa kết quả quét cũ của nguồn không còn được cấu hình, kể cả payload có thể đem đi gửi. */
export function pruneScanSources(scan, isAllowedSource) {
  if (!scan || !Array.isArray(scan.posts)) return false;
  const posts = scan.posts.filter((post) => isAllowedSource(String(post.tid || "")));
  if (posts.length === scan.posts.length) return false;

  const postIds = new Set(posts.map((post) => post.id));
  scan.posts = posts;
  if (scan.raw instanceof Map) scan.raw = new Map([...scan.raw].filter(([postId]) => postIds.has(postId)));
  scan.fullBuildings = (scan.fullBuildings || []).filter((notice) => isAllowedSource(String(notice.threadId || "")));
  scan.groups = new Set(posts.map((post) => post.tid)).size;
  return true;
}

/** Xóa raw payload ngay khi gửi xong để tin không thể xuất hiện lại trong lượt quét sau. */
export function removeScanPosts(scan, postIds) {
  if (!scan || !Array.isArray(scan.posts) || !postIds?.size) return false;
  const posts = scan.posts.filter((post) => !postIds.has(post.id));
  if (posts.length === scan.posts.length) return false;

  const remainingIds = new Set(posts.map((post) => post.id));
  scan.posts = posts;
  if (scan.raw instanceof Map) scan.raw = new Map([...scan.raw].filter(([postId]) => remainingIds.has(postId)));
  scan.groups = new Set(posts.map((post) => post.tid)).size;
  return true;
}

/**
 * Khởi tạo bot: lắng nghe tin nhắn, nhận diện nhóm nguồn,
 * gom bài qua batcher, forward qua forwarder, xử lý lệnh DM.
 */
export function startBot({ api, config, batcher, forwarder, status, groupsCachePath = GROUPS_CACHE_PATH, scanStatePath = null, closingStickerStore = null, wasSourceContentSent = async () => false, wasMessageClusterSent = async () => 0 }) {
  const { listener } = api;
  let sourceNames = config.sourceGroups.filter((s) => !isGroupLink(s)).map(nameKey).filter(Boolean);
  let sourceLinks = config.sourceGroups.filter((s) => isGroupLink(s)).map((s) => String(s).trim());
  const knownSources = new Map(); // threadId -> tên nhóm
  const resolvedSourceLinks = new Map(); // link -> threadId
  const threadNames = new Map(); // threadId -> tên (cache)
  const recentList = new Map(); // dmThreadId -> [{index, tid, name, item}]
  const awaitingClosingSticker = new Set();

  /** resolve link nhóm nguồn → threadId + tên (đưa thẳng vào knownSources) */
  async function resolveSourceLinks() {
    const activeLinks = new Set(sourceLinks);
    for (const link of resolvedSourceLinks.keys()) {
      if (!activeLinks.has(link)) resolvedSourceLinks.delete(link);
    }
    for (const link of sourceLinks) {
      try {
        const info = await api.getGroupLinkInfo({ link });
        if (info?.groupId) {
          const groupId = String(info.groupId);
          knownSources.set(groupId, info.name || groupId);
          resolvedSourceLinks.set(link, groupId);
          logger.info(`Nhóm nguồn từ link: "${info.name}" (${info.groupId})`);
        }
      } catch (e) {
        logger.warn(`Không resolve được link nhóm nguồn ${link} (${e.message}) — kiểm tra lại khi nhận tin từ nhóm`);
      }
    }
    syncStatus();
    pruneCurrentScan();
  }

  function isConfiguredSource(threadId) {
    if (config.sourceGroups.some((source) => String(source).trim() === threadId)) return true;
    if ([...resolvedSourceLinks.values()].includes(threadId)) return true;
    const sourceName = nameKey(knownSources.get(threadId) || threadNames.get(threadId) || "");
    const isConfiguredName = config.sourceGroups
      .filter((source) => !isGroupLink(source) && !/^\d+$/.test(String(source).trim()))
      .some((source) => {
        const configuredName = nameKey(source);
        return sourceName.length >= 3 && configuredName.length >= 3
          && (sourceName.includes(configuredName) || configuredName.includes(sourceName));
      });
    if (isConfiguredName) return true;
    return sourceLinks.length > resolvedSourceLinks.size;
  }

  async function threadName(threadId) {
    if (threadNames.has(threadId)) return threadNames.get(threadId);
    try {
      const res = await api.getGroupInfo(threadId);
      const g = res?.gridInfoMap?.[threadId];
      if (g?.name) {
        threadNames.set(threadId, g.name);
        return g.name;
      }
    } catch {
      // bỏ qua
    }
    return String(threadId);
  }

  function syncStatus() {
    status.knownSources = [...knownSources.entries()].map(([threadId, name]) => ({ threadId, name }));
  }

  async function detectSource(threadId) {
    if (knownSources.has(threadId)) return true;
    if (!sourceNames.length) return false;
    const name = await threadName(threadId);
    const n = nameKey(name);
    const hit =
      n.length >= 3 &&
      sourceNames.some((s) => s && s.length >= 3 && (n.includes(s) || s.includes(n)));
    if (hit) {
      knownSources.set(threadId, name);
      syncStatus();
      logger.info(`Đã nhận diện nhóm nguồn: "${name}"`);
    }
    return hit;
  }

  async function reply(uid, msg) {
    try {
      await api.sendMessage({ msg }, uid, ThreadType.User);
    } catch (e) {
      logger.error(`Gửi phản hồi DM thất bại: ${e.stack}`);
    }
  }

  /**
   * Danh sách nhóm bot đang tham gia.
   * - Lưu metadata vào config/groups-cache.json → mở web dùng ngay, không chờ Zalo quét lại
   * - force=true (nút "Quét mới") → bỏ qua cache, quét lại từ Zalo
   */
  async function listGroups(force = false) {
    if (!force) {
      const cachedGroups = readPersistedGroups(groupsCachePath);
      if (cachedGroups.length) {
        logger.info(`Dùng metadata nhóm đã lưu (${cachedGroups.length} nhóm) — bấm Quét mới để cập nhật`);
        return cachedGroups;
      }
    }

    const out = [];
    const seen = new Set();
    // lấy uid của bot để xác định chủ/QTV
    let myId = null;
    try {
      const me = await api.fetchAccountInfo?.();
      myId = me?.profile?.userId || null;
    } catch {}
    const push = (name, id, avt, extra = {}) => {
      const key = String(id);
      if (!seen.has(key) && key && key !== "?") {
        seen.add(key);
        out.push({ name: String(name || id), id: key, avt: avt || "", avatar: avt || "", ...extra });
      }
    };
    // Toàn bộ nhóm bot đang tham gia (getAllGroups đã được patch kèm tham số)
    try {
      const { gridVerMap } = await api.getAllGroups();
      const ids = Object.keys(gridVerMap || {});
      const batches = [];
      for (let i = 0; i < ids.length && i < 300; i += GROUP_INFO_BATCH_SIZE) {
        batches.push(ids.slice(i, i + GROUP_INFO_BATCH_SIZE));
      }
      const groupInfoResults = await getGroupInfoBatches(api, batches);
      for (const res of groupInfoResults) {
        if (res?.gridInfoMap) {
          for (const g of Object.values(res.gridInfoMap)) {
            const isOwner = !!(myId && g?.creatorId && String(g.creatorId) === String(myId));
            const isAdmin = !!(myId && Array.isArray(g?.adminIds) && g.adminIds.map(String).includes(String(myId)));
            push(g?.name || g?.groupId || "?", g?.groupId || "?", g?.avt || g?.fullAvt || g?.avatar || "", {
              type: g?.type ?? 1,
              subType: g?.subType ?? 0,
              isOwner,
              isAdmin,
              isManager: isOwner || isAdmin,
              totalMember: g?.totalMember ?? g?.memberIds?.length ?? 0,
              creatorId: g?.creatorId || "",
            });
          }
        }
      }
    } catch (e) {
      logger.warn(`getAllGroups lỗi (${e.message}) — thử dùng cache cũ`);
      const cachedGroups = readPersistedGroups(groupsCachePath);
      for (const g of cachedGroups) push(g.name, g.id, g.avt || g.avatar || "", { isOwner: g.isOwner, isAdmin: g.isAdmin, isManager: g.isManager, totalMember: g.totalMember, creatorId: g.creatorId });
      if (cachedGroups.length) logger.info(`Đã dùng metadata nhóm đã lưu (${cachedGroups.length} nhóm) do mạng lỗi`);
      if (!out.length) logger.warn("Không có cache cũ — chỉ hiện nhóm đã biết (areas + knownSources)");
    }
    // Nhóm đích từ config (resolve link → tên + id thật)
    for (const area of config.areas) {
      const link = String(area.groupLink || "").trim();
      if (/zalo\.me\/g\//.test(link)) {
        try {
          const info = await api.getGroupLinkInfo({ link });
          if (info?.groupId) push(info.name || "?", info.groupId, info?.avt || info?.avatar || "");
        } catch {
          // bỏ qua
        }
      }
    }
    // Nhóm nguồn đã học từ tin nhắn
    for (const [id, name] of knownSources) push(name, id, "");

    // lưu cache — chỉ lưu khi có dữ liệu, tránh ghi đè cache tốt bằng cache rỗng khi mạng lỗi
    if (out.length > 0) {
      try {
        fs.mkdirSync(path.dirname(groupsCachePath), { recursive: true });
        fs.writeFileSync(groupsCachePath, JSON.stringify({ savedAt: Date.now(), groups: toPersistedGroups(out) }, null, 2));
      } catch (e) {
        logger.warn(`Lưu cache nhóm lỗi: ${e.message}`);
      }
    } else {
      logger.warn("Không lưu cache rỗng — giữ cache cũ nếu có");
    }
    return out;
  }

  /** chọn threadId nguồn theo tên khớp; không có tên = tất cả đã biết */
  function pickSources(nameArg) {
    // Không có tên cụ thể nghĩa là quét đúng danh sách đã tích trong cấu hình,
    // tuyệt đối không mở rộng sang nhóm từng xuất hiện trong phiên trước.
    if (!nameArg) return [];
    const k = nameKey(nameArg);
    const hit = [...knownSources.entries()].filter(([, name]) => {
      const nk = nameKey(name);
      return k.length >= 3 && nk.length >= 3 && (nk.includes(k) || k.includes(nk));
    });
    return hit.map(([id]) => id);
  }

  /** Đảm bảo có ID nhóm nguồn ngay cả khi chưa học (vừa thêm cấu hình chưa có tin nhắn) */
  async function ensureSourceIds(nameArg) {
    const resolved = new Set(pickSources(nameArg));
    // Luôn resolve toàn bộ cấu hình: một nhóm đã học không được che mất nhóm còn lại.
    const targetGroups = nameArg
      ? config.sourceGroups.filter((s) => {
          const k = nameKey(s);
          const q = nameKey(nameArg);
          return k.includes(q) || q.includes(k);
        })
      : config.sourceGroups.slice();
    if (!targetGroups.length) return [...resolved];
    // ID thuần (toàn số) → dùng trực tiếp
    for (const s of targetGroups) {
      if (/^\d+$/.test(String(s).trim())) {
        const gid = String(s).trim();
        resolved.add(gid);
        // thử lấy tên từ cache nếu có
        try {
          const g = await api.getGroupInfo(gid);
          const name = g?.gridInfoMap?.[gid]?.name || gid;
          knownSources.set(gid, name);
        } catch {
          knownSources.set(gid, gid);
        }
      }
    }
    // Link → lấy groupId qua getGroupLinkInfo
    for (const s of targetGroups) {
      if (!isGroupLink(s)) continue;
      try {
        const info = await api.getGroupLinkInfo({ link: String(s).trim() });
        if (info?.groupId) {
          const gid = String(info.groupId);
          resolved.add(gid);
          knownSources.set(gid, info.name || gid);
          resolvedSourceLinks.set(String(s).trim(), gid);
        }
      } catch {}
    }
    // Tên → tìm trong danh sách nhóm qua listGroups (cache)
    const hasName = targetGroups.some((s) => !isGroupLink(s));
    if (hasName) {
      try {
        const matchGroups = (allGroups) => {
          for (const s of targetGroups) {
            if (isGroupLink(s) || /^\d+$/.test(String(s).trim())) continue;
            const k = nameKey(s);
            if (!k || k.length < 3) continue;
            for (const g of allGroups) {
              const gk = nameKey(g.name);
              if (gk && gk.length >= 3 && (gk.includes(k) || k.includes(gk))) {
                resolved.add(String(g.id));
                knownSources.set(String(g.id), g.name);
              }
            }
          }
        };
        matchGroups(await listGroups(false));
        // Cache cũ không có nhóm mới → làm mới một lần rồi thử lại.
        if (!resolved.size) matchGroups(await listGroups(true));
      } catch {}
    }
    if (resolved.size) syncStatus();
    return [...resolved];
  }

  /**
   * Phân tích tham số /forward:
   * - 2 ngày (dd/MM[/yyyy] hoặc yyyy-MM-dd) → khoảng từ→đến
   * - 1 ngày → từ ngày đó đến cuối ngày hôm nay
   * - 1 số → N ngày gần nhất
   * Phần còn lại = tên nhóm nguồn (tuỳ chọn)
   */
  function parseForwardArgs(rest) {
    const dates = [];
    const other = [];
    for (const token of rest) {
      const m = token.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);
      if (m) dates.push(token);
      else if (/^\d{1,2}$/.test(token)) dates.push(token);
      else other.push(token);
    }

    const fmtDate = (ms) => {
      const d = new Date(ms);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    const toMs = (s) => {
      if (/^\d{1,2}$/.test(s)) {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(s)).getTime();
      }
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yyyy = m[3] ? Number(m[3]) : new Date().getFullYear();
      return new Date(yyyy, mm - 1, dd).getTime();
    };

    if (dates.length >= 2) {
      const fromMs = toMs(dates[0]);
      const toMs2 = toMs(dates[1]);
      if (fromMs > toMs2) return { error: "Ngày bắt đầu phải trước ngày kết thúc" };
      const days = Math.round((toMs2 - fromMs) / 86400000) + 1;
      if (days < 1) return { error: `Ngày kết thúc (${fmtDate(toMs2)}) phải sau ngày bắt đầu (${fmtDate(fromMs)})` };
      if (days > 60) return { error: `Khoảng thời gian quá dài (${days} ngày). Tối đa 60 ngày.` };
      return { range: { fromMs, toMs: toMs2 }, label: `${fmtDate(fromMs)} → ${fmtDate(toMs2)} (${days} ngày)`, nameArg: other.join(" ") };
    }
    if (dates.length === 1) {
      if (/^\d{1,2}$/.test(dates[0])) {
        const days = Number(dates[0]);
        if (days < 1 || days > 60) return { error: `Số ngày phải trong khoảng 1–60 (nhận: ${days})` };
        const now = new Date();
        const fromMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1).getTime();
        const toMs2 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
        return { range: { fromMs, toMs: toMs2 }, label: `${fmtDate(fromMs)} → hôm nay (${days} ngày)`, nameArg: other.join(" ") };
      }
      const fromMs = toMs(dates[0]);
      const toMs2 = new Date(new Date(fromMs).getFullYear(), new Date(fromMs).getMonth(), new Date(fromMs).getDate(), 23, 59, 59).getTime();
      const days = 1;
      return { range: { fromMs, toMs: toMs2 }, label: `${fmtDate(fromMs)} (${days} ngày)`, nameArg: other.join(" ") };
    }
    return { error: 'Cú pháp /forward sai. Ví dụ: /forward 15/08/2026 20/08/2026 [tên nhóm] | /forward 3 [tên nhóm]' };
  }

  /** quét lịch sử các nhóm nguồn đã học theo khoảng ngày rồi đưa vào hàng đợi forward */
  async function forwardRangeForSources(nameArg, range) {
    const { scanGroupRange } = await import("./history.js");
    const ids = await ensureSourceIds(nameArg);
    if (!ids.length) {
      logger.warn("Chưa tìm thấy nhóm nguồn nào khớp — kiểm tra lại tên/link nhóm nguồn");
      return { total: 0, groups: 0 };
    }
    logger.info(`Bắt đầu quét lịch sử ${ids.length} nhóm nguồn: ${range.label}`);
    let total = 0;
    for (const id of ids) {
      const name = knownSources.get(id) || id;
      try {
        const count = await scanGroupRange(api, id, range, forwarder, config);
        total += count;
        logger.info(`Nhóm "${name}": đã đưa ${count} bài vào hàng đợi`);
      } catch (e) {
        logger.error(`Quét nhóm "${name}" lỗi: ${e.stack}`);
      }
    }
    return { total, groups: ids.length };
  }

  /** quét lịch sử 1 threadId bất kỳ (dùng từ web khi forward từng nhóm trong danh sách) */
  async function forwardRangeForThread(threadId, range) {
    const { scanGroupRange } = await import("./history.js");
    logger.info(`Bắt đầu quét lịch sử nhóm ${threadId}: ${range.label}`);
    const total = await scanGroupRange(api, threadId, range, forwarder, config);
    logger.info(`Nhóm ${threadId}: đã đưa ${total} bài vào hàng đợi`);
    return { total, groups: 1 };
  }

  /* ---------- quét trước → chọn sau (manual) ---------- */
  const scans = new Map(); // scanId -> { range, groups: number, posts: [...], raw: Map(postId -> {tid, items}) }
  let scanSeq = 0;
  let latestScanId = null;
  let manualProgress = null;

  const persistedScan = scanStatePath ? readPersistedScanSync(scanStatePath) : null;
  if (persistedScan) {
    scans.set(persistedScan.scanId, persistedScan);
    latestScanId = persistedScan.scanId;
    logger.info(`Đã khôi phục ${persistedScan.posts.length} bài quét thủ công từ phiên trước`);
    pruneSentScanPosts(persistedScan).catch((error) => {
      logger.warn(`Không lọc được tin đã gửi trong phiên quét cũ: ${error.message}`);
    });
  }

  function persistScan(scan) {
    if (!scanStatePath) return;
    try {
      writePersistedScanSync(scanStatePath, scan);
    } catch (e) {
      logger.warn(`Lưu kết quả quét lỗi: ${e.message}`);
    }
  }

  function pruneCurrentScan() {
    const scan = latestScanId ? scans.get(latestScanId) : null;
    if (!scan || !pruneScanSources(scan, isConfiguredSource)) return;
    persistScan(scan);
    logger.info(`Đã bỏ tin quét của nhóm nguồn không còn cấu hình — còn ${scan.posts.length} bài`);
  }

  async function pruneSentScanPosts(scan) {
    if (!scan?.posts?.length) return;
    const completedPostIds = new Set();
    for (const post of scan.posts) {
      if (post.clean && await wasSourceContentSent({ sourceId: post.tid, content: post.clean })) {
        completedPostIds.add(post.id);
      }
    }
    if (!removeScanPosts(scan, completedPostIds)) return;
    persistScan(scan);
    logger.info(`Đã bỏ ${completedPostIds.size} tin quét cũ đã gửi thành công`);
  }

  function pruneScans() {
    const ids = [...scans.keys()];
    while (ids.length > 3) {
      const oldest = ids.shift();
      scans.delete(oldest);
    }
  }

  async function scanRange(nameArg, range, keywordArg = "") {
    const { fetchRecentBatches } = await import("./history.js");
    const ids = await ensureSourceIds(nameArg);
    if (!ids.length) {
      return { error: "Chưa tìm thấy nhóm nguồn nào khớp. Kiểm tra lại tên/link nhóm nguồn hoặc bấm Quét mới để tải danh sách nhóm." };
    }
    const scanQueryKey = `${normalizeText(String(nameArg || ""))}|${normalizeText(String(keywordArg || ""))}|${range.fromMs}|${range.toMs}`;
    // Mỗi lần bấm Quét = bảng mới hoàn toàn theo đúng khoảng ngày + nguồn + từ khóa
    // hiện tại. Không cộng dồn kết quả cũ để tránh danh sách phình to sai số ngày.
    const scanId = `s${Date.now()}-${++scanSeq}`;
    // Một lượt quét mới thay bảng cũ, không giữ thông báo tiến độ của lượt gửi trước.
    manualProgress = null;
    const posts = [];
    const raw = new Map();
    const fullBuildings = [];
    const postsByThreadId = new Map();
    let added = 0;
    let groups = 0;
    const keyword = normalizeText(String(keywordArg).trim());
    const scanJobs = ids.map((id) => {
      const name = knownSources.get(id) || id;
      const sourcePosts = [];
      postsByThreadId.set(id, sourcePosts);
      return { id, name, fromMs: range.fromMs, sourcePosts };
    });
    const scanResults = await mapWithLimitedConcurrency(
      scanJobs,
      HISTORY_SCAN_CONCURRENCY,
      async (job) => {
        try {
          const batches = await fetchRecentBatches(api, job.id, { ...range, fromMs: job.fromMs }, config);
          return { ...job, batches };
        } catch (e) {
          logger.warn(`Quét nhóm "${job.name}" lỗi: ${e.message}`);
          return { ...job, batches: null };
        }
      },
    );
    for (const { id, name, sourcePosts, batches } of scanResults) {
      if (!batches) continue;
      groups++;
      for (const notice of batches.fullBuildingNotices || []) {
        if (!fullBuildings.some((entry) => entry.threadId === id && entry.key === notice.key)) {
          fullBuildings.push({ threadId: id, sourceName: name, key: notice.key, label: notice.label, text: notice.text, status: "full" });
        }
      }
      let idx = 0;
      for (const items of batches) {
        const batchMeta = items.batchMeta ?? {};
        const sourceText = items
          .map((item) => (typeof item.data?.content === "string" ? item.data.content : ""))
          .join("\n\n");
        if (keyword && !normalizeText(sourceText).includes(keyword)) continue;
        const d = forwarder.describePost(items, batchMeta.inheritedDestinations, batchMeta.inheritedRouteVia, batchMeta.inheritedMatchedRules);
        if (d.excluded) continue;
        if (!d.clean && !d.photoCount) continue;
        if (d.clean && await wasSourceContentSent({ sourceId: id, content: d.clean })) {
          logger.info(`Bỏ qua cụm đã gửi từ nhóm nguồn ${id}`);
          continue;
        }
        // Quét lại gặp đúng ID tin đã gửi (kể cả khác nhóm) thì loại, không thêm lại.
        const clusterMsgIds = messageIdsOf(items);
        if (clusterMsgIds.length && (await wasMessageClusterSent(clusterMsgIds)) >= clusterMsgIds.length) {
          logger.info(`Bỏ qua cụm đã gửi (trùng ID tin nhắn) từ nhóm ${name}`);
          continue;
        }
        const t = Number(items[0]?.data?.ts || items[0]?.ts || 0);
        if (isRepeatedPhotoOnlyCluster(sourcePosts, id, d.clean, d.photoUrls, t)) continue;
        const postId = `${scanId}:${id}:${idx++}`;
        const post = {
          id: postId,
          tid: id,
          name,
          areaName: d.areaName,
          detectedArea: d.detectedArea,
          destinationNames: d.destinationNames,
          routingReason: d.routingReason || null,
          routingKeys: d.routingKeys || [],
          matchedRules: d.matchedRules || [],
          undetermined: Boolean(d.undetermined),
          kw: d.kw,
          clean: (d.clean || "").slice(0, 400),
          photos: d.photoCount,
          photoUrls: d.photoUrls,
          price: d.price,
          commissionPercent: parseCommissionPercent(sourceText),
          inPriceRange: d.inPriceRange,
          status: d.undetermined ? "undetermined" : "pending",
          ts: t,
          clusterItems: items.map((item) => ({
            text: typeof item.data?.content === "string" ? item.data.content.slice(0, 1000) : "",
            photoUrls: photoUrls(item),
            ts: Number(item.data?.ts || item.ts || 0),
          })),
        };
        posts.push(post);
        sourcePosts.push(post);
        raw.set(postId, { tid: id, items, batchMeta });
        added++;
      }
    }
    // Chống trùng khi 2 nhóm nguồn đăng cùng nội dung: giữ bài đầu, đánh dấu các bản sau.
    // Lúc gửi, kho tin đã gửi vẫn chặn gửi trùng vào cùng nhóm đích.
    const seenContent = new Map();
    for (const post of posts) {
      const key = normalizeText(post.clean || "");
      if (!key) continue;
      if (seenContent.has(key)) {
        post.status = "duplicate";
        post.duplicateOf = seenContent.get(key);
      } else {
        seenContent.set(key, post.id);
      }
    }
    pruneScans();
    const scan = { scanId, scanQueryKey, range, groups, posts, raw, fullBuildings };
    scans.set(scanId, scan);
    latestScanId = scanId;
    persistScan(scan);
    return { scanId, range: range.label, groups, total: posts.length, added, posts };
  }

  function scanState() {
    const scan = latestScanId ? scans.get(latestScanId) : null;
    if (!scan) return null;
    return {
      scanId: scan.scanId,
      range: scan.range.label,
      groups: scan.groups,
      total: scan.posts.length,
      posts: scan.posts,
      fullBuildings: scan.fullBuildings || [],
      progress: manualProgress,
    };
  }

  function requestStopAfterCurrent() {
    if (!manualProgress?.running) return false;
    manualProgress.stopRequested = true;
    logger.info("Đã nhận yêu cầu dừng — sẽ dừng sau khi gửi xong cụm hiện tại");
    return true;
  }

  async function forwardSelected(scanId, indexes, destinationKeyword = "", forceResend = false) {
    const scan = scans.get(scanId);
    if (!scan) return { sent: 0, error: "Không tìm thấy kết quả quét này — hãy quét lại." };
    const target = destinationKeyword
      ? config.areas.find((area) => normalizeText(area.keywords?.[0] || "") === normalizeText(destinationKeyword)
        || String(area.routingKey || "") === normalizeText(destinationKeyword).replace(/[^a-z0-9]+/g, "-"))
      : null;
    if (destinationKeyword && !target) return { sent: 0, error: "Không tìm thấy nhóm đích cho từ khóa này — hãy tải lại cấu hình." };
    const selectedPosts = [...new Set(indexes)]
      .map((index) => ({ post: scan.posts[index], raw: scan.raw.get(scan.posts[index]?.id) }))
      .filter(({ post, raw }) => post && raw)
      .sort((left, right) => (left.post.ts - right.post.ts) || left.post.id.localeCompare(right.post.id));
    let sent = 0;
    let failed = 0;
    manualProgress = {
      running: true,
      current: 0,
      total: selectedPosts.length,
      sourceName: "",
      destinationName: target?.keywords?.[0] || "",
      imageCount: 0,
      startedAt: Date.now(),
      stopRequested: false,
    };
    for (const [position, { post, raw }] of selectedPosts.entries()) {
      if (manualProgress.stopRequested) break;
      manualProgress.current = position + 1;
      manualProgress.sourceName = post.name;
      manualProgress.destinationName = target?.keywords?.[0] || post.destinationNames?.join(", ") || "Chưa có nhóm đích";
      manualProgress.imageCount = post.photos || 0;
      logger.info(`Gửi cụm ${position + 1}/${selectedPosts.length} theo thứ tự cũ → mới: ${post.name}`);
      const outcome = await forwarder.enqueue({
        threadId: raw.tid,
        items: raw.items,
        source: "manual",
        ...raw.batchMeta,
        inheritedDestinations: target ? [target] : raw.batchMeta.inheritedDestinations,
        forceResend,
      });
      if (outcome?.sent && !outcome?.error) {
        // Tin đã gửi ở lại bảng (trạng thái sent) để còn Gửi lại.
        post.status = "sent";
        sent++;
      } else if (outcome?.error) {
        post.status = "error";
        failed++;
      } else if (outcome?.duplicate && post.status !== "sent") {
        post.status = "duplicate";
      }
    }
    manualProgress.running = false;
    manualProgress.stopped = manualProgress.stopRequested;
    manualProgress.endedAt = Date.now();
    persistScan(scan);
    return { sent, failed, stopped: manualProgress.stopped };
  }

  async function forwardAll(scanId) {
    const scan = scans.get(scanId);
    if (!scan) return { sent: 0, error: "Không tìm thấy kết quả quét này — hãy quét lại." };
    // Bỏ qua tin đã gửi (muốn gửi lại thì bấm Gửi lại từng tin).
    const indexes = scan.posts
      .map((post, i) => ({ post, i }))
      .filter(({ post }) => post.status !== "sent")
      .map(({ i }) => i);
    return forwardSelected(scanId, indexes);
  }

  /* ---------- lệnh DM ---------- */

  async function cmdGroups(uid) {
    const gs = await listGroups();
    if (!gs.length) return reply(uid, "Không lấy được danh sách nhóm (kiểm tra log).");
    const text = gs.map((g, i) => `${i + 1}. ${g.name} — ${g.id}`).join("\n");
    await reply(uid, `📋 ${gs.length} nhóm đang tham gia:\n${text}`);
  }

  async function cmdStatus(uid) {
    const src = knownSources.size;
    const lines = [
      `• Mode: ${status.mode}`,
      `• Đã forward: ${status.forwarded} bài`,
      `• Nhóm nguồn đã học: ${src}`,
      `• Khu vực đích: ${(config.areas || []).map((a) => (a.keywords || []).join(", ") || "?").join(" | ") || "chưa cấu hình"}`,
    ];
    if (src) {
      lines.push(`• Chi tiết nhóm nguồn:\n${[...knownSources.entries()].map(([, n]) => `  - ${n}`).join("\n")}`);
    }
    await reply(uid, lines.join("\n"));
  }

  async function cmdHelp(uid) {
    await reply(uid, HELP);
  }

  async function cmdForward(uid, rest) {
    const parsed = parseForwardArgs(rest);
    if (parsed.error) return reply(uid, parsed.error);
    await reply(uid, `Bắt đầu quét ${parsed.label}${parsed.nameArg ? ` (nhóm khớp: ${parsed.nameArg})` : " (tất cả nhóm nguồn)"}...`);
    const { total, groups } = await forwardRangeForSources(parsed.nameArg, parsed.range);
    await reply(uid, `✅ Xong: ${total} bài từ ${groups} nhóm (${parsed.label}). Xem nhật ký để biết chi tiết.`);
  }

  async function cmdLast(uid, rest) {
    const count = Math.min(Math.max(Number(rest[0]) || 5, 1), 20);
    const nameArg = rest.slice(1).join(" ") || "";
    const ids = pickSources(nameArg);
    if (!ids.length) return reply(uid, "Chưa có nhóm nguồn nào được học.");
    const list = [];
    for (const id of ids) {
      try {
        const res = await api.getGroupChatHistory(id, count * 3);
        const msgs = res?.groupMsgs || [];
        const recent = msgs
          .map((m, idx) => ({ idx, tid: id, name: knownSources.get(id) || id, item: m }))
          .slice(-count);
        list.push(...recent);
      } catch (e) {
        logger.warn(`/last nhóm ${id} lỗi: ${e.message}`);
      }
    }
    list.sort((a, b) => Number(b.item?.ts || 0) - Number(a.item?.ts || 0));
    const top = list.slice(0, count);
    recentList.set(uid, top);
    const text = top
      .map((r, i) => {
        const rawContent = typeof r.item?.content === "string" ? r.item.content : "";
        const fullNotice = parseFullBuildingNotice(rawContent);
        const content = fullNotice
          ? `⛔ FULL TÒA: ${fullNotice.label}`
          : rawContent ? rawContent.replace(/\n+/g, " ").slice(0, 80) : "[ảnh/tệp]";
        return `${i + 1}. (${r.name}) ${content}`;
      })
      .join("\n");
    await reply(uid, `📌 ${top.length} tin mới nhất:\n${text}\n\nGõ /f <số> để forward đúng tin đó.`);
  }

  async function cmdF(uid, arg) {
    const idx = Number(arg) - 1;
    const list = recentList.get(uid) || [];
    const pick = list[idx];
    if (!pick) return reply(uid, `Không có tin số ${arg}. Gõ /last trước để nạp danh sách.`);
    forwarder.enqueue({ threadId: pick.tid, items: [{ raw: pick.item, data: pick.item }], source: "dm" });
    await reply(uid, `Đã đưa tin ${arg} (${pick.name}) vào hàng đợi forward.`);
  }

  async function cmdMode(uid, arg) {
    const mode = String(arg || "").trim();
    if (mode !== "auto" && mode !== "manual") {
      return reply(uid, 'Mode phải là "auto" (treo máy, forward realtime) hoặc "manual" (chỉ forward khi gõ lệnh).');
    }
    status.mode = mode;
    logger.info(`Đổi mode qua DM: ${mode}`);
    await reply(uid, `Đã đổi mode: ${mode}`);
  }

  async function cmdSetSticker(uid) {
    if (!closingStickerStore) return reply(uid, "Bot chưa bật bộ lưu sticker kết thúc.");
    awaitingClosingSticker.add(String(uid));
    await reply(uid, "Hãy gửi đúng 1 sticker Zalo trong tin nhắn tiếp theo. Gõ /cancel để huỷ.");
  }

  async function cmdSticker(uid, arg) {
    const action = String(arg || "status").toLowerCase();
    if (!closingStickerStore) return reply(uid, "Bot chưa bật bộ lưu sticker kết thúc.");
    if (action === "off") {
      closingStickerStore.clear();
      awaitingClosingSticker.delete(String(uid));
      return reply(uid, "Đã tắt sticker kết thúc cụm.");
    }
    const sticker = closingStickerStore.get();
    await reply(uid, sticker
      ? `Sticker kết thúc đang bật (ID ${sticker.id}).`
      : "Sticker kết thúc đang tắt. Gõ /setsticker để chọn.");
  }

  async function saveClosingSticker(message) {
    const uid = String(message.threadId);
    if (!awaitingClosingSticker.has(uid)) return false;
    const stickerId = extractStickerId(message.data);
    if (!stickerId) {
      await reply(uid, "Tin này không phải sticker Zalo. Hãy gửi một sticker, hoặc gõ /cancel.");
      return true;
    }
    try {
      const details = await api.getStickersDetail(stickerId);
      const sticker = closingStickerStore.save(Array.isArray(details) ? details[0] : details);
      awaitingClosingSticker.delete(uid);
      await reply(uid, `Đã lưu sticker ID ${sticker.id}. Từ cụm tiếp theo bot sẽ gửi sticker này ở cuối.`);
    } catch (error) {
      logger.warn(`Không lưu được sticker kết thúc (${error.message})`);
      await reply(uid, "Không đọc được sticker này từ Zalo. Hãy thử gửi lại sticker khác, hoặc gõ /cancel.");
    }
    return true;
  }

  async function handleCommand(message, content) {
    const uid = message.threadId;
    const [cmd, ...rest] = content.slice(1).trim().split(/\s+/);
    switch (cmd) {
      case "help":
        await cmdHelp(uid);
        break;
      case "status":
        await cmdStatus(uid);
        break;
      case "groups":
        await cmdGroups(uid);
        break;
      case "forward":
        await cmdForward(uid, rest);
        break;
      case "last":
        await cmdLast(uid, rest);
        break;
      case "f":
        await cmdF(uid, rest[0]);
        break;
      case "mode":
        await cmdMode(uid, rest[0]);
        break;
      case "setsticker":
        await cmdSetSticker(uid);
        break;
      case "sticker":
        await cmdSticker(uid, rest[0]);
        break;
      case "cancel":
        awaitingClosingSticker.delete(String(uid));
        await reply(uid, "Đã huỷ thao tác chọn sticker.");
        break;
      default:
        await reply(uid, `Không hiểu lệnh "${cmd}". Gõ /help`);
    }
  }

  listener.on("message", async (message) => {
    try {
      if (message.isSelf) return;

      if (message.type === ThreadType.User) {
        const content = typeof message.data?.content === "string" ? message.data.content.trim() : "";
        if (content.startsWith("/")) await handleCommand(message, content);
        else await saveClosingSticker(message);
        return;
      }

      if (message.type !== ThreadType.Group) return;
      if (!(await detectSource(message.threadId))) return;
      batcher.add(message.threadId, { data: message.data, raw: message });
    } catch (e) {
      logger.error(`Lỗi xử lý tin nhắn: ${e.stack}`);
    }
  });

  try {
    listener.start({ retryOnClose: true });
  } catch (e) {
    logger.warn(`listener.start: ${e.message}`);
  }
  resolveSourceLinks().catch((e) => logger.warn(`resolve nhóm nguồn lúc khởi động lỗi: ${e.message}`));

  async function accountInfo() {
    try {
      const res = await api.fetchAccountInfo?.();
      const p = res?.profile;
      if (!p) return null;
      return {
        displayName: p.displayName || p.zaloName || "",
        uid: p.userId || "",
        avatar: p.avatar || "",
        phone: p.phoneNumber || "",
      };
    } catch (e) {
      logger.warn(`Lấy thông tin tài khoản lỗi: ${e.message}`);
      return null;
    }
  }

  async function resolveAreas() {
    const out = [];
    for (let i = 0; i < (config.areas || []).length; i++) {
      const area = config.areas[i];
      try {
        const groupId = await forwarder.resolveThreadId(area);
        let name = "?";
        const link = String(area.groupLink || "").trim();
        if (/zalo\.me\/g\//.test(link)) {
          try {
            const info = await api.getGroupLinkInfo({ link });
            if (info?.name) name = info.name;
          } catch {
            // giữ name mặc định
          }
        } else if (area.id) {
          try {
            const g = await api.getGroupInfo(String(area.id));
            name = g?.gridInfoMap?.[String(area.id)]?.name || name;
          } catch {
            // bỏ qua
          }
        }
        out.push({ index: i, ok: true, groupId, name });
      } catch (e) {
        out.push({ index: i, ok: false, error: e.message });
      }
    }
    return out;
  }

  return {
    refresh(nextConfig = config) {
      config = nextConfig;
      forwarder.config = nextConfig;
      if (batcher) {
        Object.assign(batcher, nextConfig.forward, {
          areas: nextConfig.areas,
          defaultArea: nextConfig.defaultArea,
        });
      }
      sourceNames.length = 0;
      sourceLinks.length = 0;
      for (const s of config.sourceGroups) {
        if (isGroupLink(s)) sourceLinks.push(String(s).trim());
        else {
          const n = nameKey(s);
          if (n) sourceNames.push(n);
        }
      }
      pruneCurrentScan();
      syncStatus();
      resolveSourceLinks().catch(() => {});
      logger.info("Đã áp dụng cấu hình mới (nhóm nguồn, khu vực, từ khoá...)");
    },
    forwardRangeForSources,
    forwardRangeForThread,
    scanRange,
    scanState,
    requestStopAfterCurrent,
    forwardSelected,
    forwardAll,
    listGroups,
    areaInfos: () => forwarder.statusInfo(),
    accountInfo,
    resolveAreas,
    knownSources: () => [...knownSources.keys()],
    stop() {
      try {
        listener.removeAllListeners?.();
        listener.stop?.();
        forwarder.stop?.();
      } catch (e) {
        logger.warn(`Dừng listener lỗi: ${e.message}`);
      }
      logger.info("Đã ngắt kết nối listener (ngắt kết nối bot)");
    },
  };
}

const HELP = `🤖 Hướng dẫn lệnh (chat riêng với bot):
• /status — trạng thái bot
• /groups — danh sách nhóm đang tham gia
• /forward <từ> <đến> [tên nhóm] — quét lịch sử theo khoảng ngày:
    vd: /forward 15/08/2026 20/08/2026 | /forward 15/08 20/08 | /forward 3 (3 ngày gần nhất)
• /last <số tin> [tên nhóm] — liệt kê tin gần nhất để chọn
• /f <số> — forward đúng tin đã chọn ở /last
• /mode auto|manual — bật/tắt forward realtime
• /setsticker — chờ bạn gửi sticker dùng ở cuối mỗi cụm
• /sticker status — xem sticker kết thúc đang bật hay tắt
• /sticker off — tắt sticker kết thúc cụm
• /cancel — huỷ thao tác chọn sticker
• /help — hướng dẫn này`;
