import { ThreadType } from "zca-js";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.js";
import { normalizeText } from "./processor.js";
import { GROUPS_CACHE_PATH } from "./config.js";

const norm = (s) => normalizeText(s);
/** Khoá so khớp tên nhóm: bỏ emoji/icon/dấu câu, chỉ giữ chữ + số + khoảng trắng */
const nameKey = (s) =>
  norm(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isGroupLink = (s) => /zalo\.me\/g\//.test(String(s || ""));

/**
 * Khởi tạo bot: lắng nghe tin nhắn, nhận diện nhóm nguồn,
 * gom bài qua batcher, forward qua forwarder, xử lý lệnh DM.
 */
export function startBot({ api, config, batcher, forwarder, status }) {
  const { listener } = api;
  let sourceNames = config.sourceGroups.filter((s) => !isGroupLink(s)).map(nameKey).filter(Boolean);
  let sourceLinks = config.sourceGroups.filter((s) => isGroupLink(s)).map((s) => String(s).trim());
  const knownSources = new Map(); // threadId -> tên nhóm
  const threadNames = new Map(); // threadId -> tên (cache)
  const recentList = new Map(); // dmThreadId -> [{index, tid, name, item}]

  /** resolve link nhóm nguồn → threadId + tên (đưa thẳng vào knownSources) */
  async function resolveSourceLinks() {
    for (const link of sourceLinks) {
      try {
        const info = await api.getGroupLinkInfo({ link });
        if (info?.groupId) {
          knownSources.set(String(info.groupId), info.name || String(info.groupId));
          logger.info(`Nhóm nguồn từ link: "${info.name}" (${info.groupId})`);
        }
      } catch (e) {
        logger.warn(`Không resolve được link nhóm nguồn ${link} (${e.message}) — kiểm tra lại khi nhận tin từ nhóm`);
      }
    }
    syncStatus();
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
   * - Lưu cache vào config/groups-cache.json (TTL 10 phút) → lần sau bấm "Tải danh sách" không gọi lại API
   * - force=true (nút "Quét mới") → bỏ qua cache, quét lại từ Zalo
   */
  async function listGroups(force = false) {
    const CACHE_TTL = 10 * 60 * 1000;
    if (!force) {
      try {
        const cached = JSON.parse(fs.readFileSync(GROUPS_CACHE_PATH, "utf8"));
        if (cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.groups) && cached.groups.length > 0) {
          // cache cũ chưa có thông tin chủ/QTV → bỏ qua để quét mới có đủ dữ liệu
          const hasMgr = cached.groups[0]?.hasOwnProperty("isManager");
          if (!hasMgr) throw new Error("cache thiếu isManager");
          logger.info(`Dùng danh sách nhóm từ cache (${cached.groups.length} nhóm, ${Math.round((Date.now() - cached.savedAt) / 60000)} phút trước)`);
          return cached.groups;
        }
      } catch {
        // chưa có cache hoặc lỗi → quét mới
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
      for (let i = 0; i < ids.length && i < 300; i += 5) {
        const batch = ids.slice(i, i + 5);
        try {
          const res = await api.getGroupInfo(batch);
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
        } catch {
          logger.warn(`getGroupInfo lô ${i / 5 + 1} lỗi — bỏ qua`);
        }
      }
    } catch (e) {
      logger.warn(`getAllGroups lỗi (${e.message}) — thử dùng cache cũ`);
      try {
        const cached = JSON.parse(fs.readFileSync(GROUPS_CACHE_PATH, "utf8"));
        if (Array.isArray(cached.groups) && cached.groups.length) {
          for (const g of cached.groups) push(g.name, g.id, g.avt || g.avatar || "", { isOwner: g.isOwner, isAdmin: g.isAdmin, isManager: g.isManager, totalMember: g.totalMember, creatorId: g.creatorId });
          logger.info(`Đã dùng cache cũ (${cached.groups.length} nhóm) do mạng lỗi`);
        }
      } catch {}
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
        fs.mkdirSync(path.dirname(GROUPS_CACHE_PATH), { recursive: true });
        fs.writeFileSync(GROUPS_CACHE_PATH, JSON.stringify({ savedAt: Date.now(), groups: out }, null, 2));
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
    if (!nameArg) return [...knownSources.keys()];
    const k = nameKey(nameArg);
    const hit = [...knownSources.entries()].filter(([, name]) => {
      const nk = nameKey(name);
      return k.length >= 3 && nk.length >= 3 && (nk.includes(k) || k.includes(nk));
    });
    return hit.map(([id]) => id);
  }

  /** Đảm bảo có ID nhóm nguồn ngay cả khi chưa học (vừa thêm cấu hình chưa có tin nhắn) */
  async function ensureSourceIds(nameArg) {
    let ids = pickSources(nameArg);
    if (ids.length) return ids;
    // Chưa học nhóm nào → thử resolve trực tiếp từ config
    const targetGroups = nameArg
      ? config.sourceGroups.filter((s) => {
          const k = nameKey(s);
          const q = nameKey(nameArg);
          return k.includes(q) || q.includes(k);
        })
      : config.sourceGroups.slice();
    if (!targetGroups.length) return [];
    const resolved = new Set();
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
        }
      } catch {}
    }
    // Tên → tìm trong danh sách nhóm qua listGroups (cache)
    const hasName = targetGroups.some((s) => !isGroupLink(s));
    if (hasName) {
      try {
        const allGroups = await listGroups(false);
        for (const s of targetGroups) {
          if (isGroupLink(s)) continue;
          if (/^\d+$/.test(String(s).trim())) continue;
          const k = nameKey(s);
          if (!k || k.length < 3) continue;
          for (const g of allGroups) {
            const gk = nameKey(g.name);
            if (!gk || gk.length < 3) continue;
            if (gk.includes(k) || k.includes(gk)) {
              resolved.add(String(g.id));
              knownSources.set(String(g.id), g.name);
            }
          }
        }
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
    const scanId = `s${Date.now()}-${++scanSeq}`;
    const posts = [];
    const raw = new Map();
    let groups = 0;
    const keyword = normalizeText(String(keywordArg).trim());
    for (const id of ids) {
      const name = knownSources.get(id) || id;
      let batches = [];
      try {
        batches = await fetchRecentBatches(api, id, range, config);
      } catch (e) {
        logger.warn(`Quét nhóm "${name}" lỗi: ${e.message}`);
        continue;
      }
      groups++;
      let idx = 0;
      for (const items of batches) {
        const sourceText = items
          .map((item) => (typeof item.data?.content === "string" ? item.data.content : ""))
          .join("\n\n");
        if (keyword && !normalizeText(sourceText).includes(keyword)) continue;
        const d = forwarder.describePost(items);
        if (d.excluded) continue;
        if (!d.clean && !d.photoCount) continue;
        const postId = `${scanId}:${id}:${idx++}`;
        const t = Number(items[0]?.data?.ts || items[0]?.ts || 0);
        posts.push({
          id: postId,
          tid: id,
          name,
          areaName: d.areaName,
          kw: d.kw,
          clean: (d.clean || "").slice(0, 400),
          photos: d.photoCount,
          price: d.price,
          inPriceRange: d.inPriceRange,
          ts: t,
        });
        raw.set(postId, { tid: id, items });
      }
    }
    pruneScans();
    scans.set(scanId, { range, groups, posts, raw });
    return { scanId, range: range.label, groups, total: posts.length, posts };
  }

  function forwardSelected(scanId, indexes) {
    const scan = scans.get(scanId);
    if (!scan) return { sent: 0, error: "Không tìm thấy kết quả quét này — hãy quét lại." };
    let sent = 0;
    for (const i of indexes) {
      const post = scan.posts[i];
      const r = scan.raw.get(post?.id);
      if (!r) continue;
      forwarder.enqueue({ threadId: r.tid, items: r.items, source: "manual" });
      sent++;
    }
    return { sent };
  }

  function forwardAll(scanId) {
    const scan = scans.get(scanId);
    if (!scan) return { sent: 0, error: "Không tìm thấy kết quả quét này — hãy quét lại." };
    return forwardSelected(scanId, scan.posts.map((_, i) => i));
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
        const content = typeof r.item?.content === "string" ? r.item.content.replace(/\n+/g, " ").slice(0, 80) : "[ảnh/tệp]";
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
    refresh() {
      sourceNames.length = 0;
      sourceLinks.length = 0;
      for (const s of config.sourceGroups) {
        if (isGroupLink(s)) sourceLinks.push(String(s).trim());
        else {
          const n = nameKey(s);
          if (n) sourceNames.push(n);
        }
      }
      syncStatus();
      resolveSourceLinks().catch(() => {});
      logger.info("Đã áp dụng cấu hình mới (nhóm nguồn, khu vực, từ khoá...)");
    },
    forwardRangeForSources,
    forwardRangeForThread,
    scanRange,
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
• /help — hướng dẫn này`;
