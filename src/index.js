import { logger } from "./logger.js";
import { CLOSING_STICKER_PATH, SCAN_STATE_PATH, loadConfig } from "./config.js";
import { login, logoutLocal } from "./session.js";
import { Batcher } from "./batcher.js";
import { Forwarder } from "./forwarder.js";
import { startBot } from "./listener.js";
import { ApiServer } from "./server-api.js";
import { createSentMessageIndex } from "./features/sent-message-index/service.js";
import { ClosingStickerStore } from "./closing-sticker.js";
import { buildingKeyFromText } from "./full-building.js";
import { isLiveBatchStillPresent } from "./live-batch-verification.js";
import { loadRulesCached } from "./features/location-rules/repository.js";

// WHY: live batcher chụp kho rule lúc khởi động; rule mới lưu cần restart bot (quét tay nhận ngay).
function loadRulesSnapshot() {
  try {
    return loadRulesCached().rules;
  } catch {
    return [];
  }
}

const AUTO_FORWARD_DELAY_MS = 30 * 60 * 1000;

async function startRuntime(server, state, config) {
  let api;
  try {
    ({ api } = await login(
      (qr) => server.broadcast("qr", qr),
      () => server.broadcast("scan", { ok: true })
    ));
  } catch (e) {
    server.broadcast("login", { ok: false, error: e.message });
    throw e;
  }
  server.broadcast("login", { ok: true });

  const closingStickerStore = new ClosingStickerStore(CLOSING_STICKER_PATH);
  const forwarder = new Forwarder(
    api,
    config,
    () => { state.status.forwarded += 1; },
    async (delivery) => {
      const sourceName = state.status.knownSources
        .find((source) => String(source.threadId) === delivery.sourceGroupId)?.name || "";
      state.sentMessageIndex.recordBotDelivery({
        ...delivery,
        sourceGroup: { id: delivery.sourceGroupId, name: sourceName },
      });
    },
    async ({ destinationId, content }) => state.sentMessageIndex.hasSent({ destinationId, content }),
    closingStickerStore,
  );
  state.resendSentRoom = async (roomId) => {
    if (!state.bot) return { sent: 0, error: "Bot chưa sẵn sàng" };
    const saved = state.sentMessageIndex.getResendPayload(roomId);
    if (!saved) return { sent: 0, error: "Không tìm thấy tin trong kho" };
    const outcome = await forwarder.enqueue({
      threadId: saved.sourceGroupId || "sent-room",
      items: [{ data: { content: saved.sentContent } }],
      source: "manual-resend",
      resendDestinations: saved.destinations.map((destination) => ({
        id: destination.id,
        keywords: [destination.name],
      })),
      forceResend: true,
    });
    return {
      sent: Number(outcome?.destinations || 0),
      failed: outcome?.error ? 1 : 0,
    };
  };
  const batcher = new Batcher({ ...config.forward, areas: config.areas, defaultArea: config.defaultArea, rules: loadRulesSnapshot() });

  batcher.on("building-full", (notice) => {
    forwarder.markBuildingFull(notice.threadId, notice);
    logger.info(`Đã đánh dấu full tòa ${notice.label} ở nhóm nguồn ${notice.threadId}`);
  });

  batcher.on("batch", async ({ threadId, items, ...batchMeta }) => {
    // luôn lưu realtime để quét lại được kể cả khi đang manual
    try {
      const { appendBatch } = await import("./store.js");
      const name = state.status.knownSources.find((s) => String(s.threadId) === String(threadId))?.name || String(threadId);
      appendBatch(threadId, items, name, batchMeta);
    } catch {}
    if (state.status.mode === "manual") {
      logger.info(`Đã lưu ${items.length} tin vào store (chế độ thủ công — chờ bạn Quét & chọn)`);
      return;
    }
    const queuedAt = Date.now();
    logger.info(`Đã xếp bài auto vào hàng chờ 30 phút: ${threadId}`);
    forwarder.enqueue({
      threadId,
      items,
      source: "live",
      ...batchMeta,
      notBefore: queuedAt + AUTO_FORWARD_DELAY_MS,
      beforeSend: async () => {
        if (state.status.mode !== "auto") {
          logger.info(`Bỏ qua bài auto đang chờ ở nhóm ${threadId}: bot đã chuyển sang manual`);
          return false;
        }
        const batchText = items
          .filter((item) => typeof item?.data?.content === "string")
          .map((item) => item.data.content)
          .join("\n\n");
        const requireName = buildingKeyFromText(batchText) === String(batchMeta.buildingKey || "").toLowerCase();
        if (forwarder.isBuildingFull(threadId, batchMeta.buildingKey, batchText, { requireName })) {
          logger.info(`Bỏ qua bài auto thuộc tòa đã full ở nhóm ${threadId}`);
          return false;
        }
        return isLiveBatchStillPresent(api, threadId, items);
      },
    });
  });

  const bot = startBot({
    api,
    config,
    batcher,
    forwarder,
    status: state.status,
    scanStatePath: SCAN_STATE_PATH,
    closingStickerStore,
    wasSourceContentSent: async ({ sourceId, content }) => state.sentMessageIndex.hasSourceSent({ sourceId, content }),
    wasMessageClusterSent: async (ids) => state.sentMessageIndex.countSentMessageIds(ids),
  });
  state.bot = bot;
  state.api = api;
  server.broadcast("ready", true);

  // lấy thông tin tài khoản (hiện trên UI) — không bắt buộc
  bot
    .accountInfo()
    .then((info) => {
      state.accountInfo = info;
      if (info?.displayName) logger.info(`Đã đăng nhập tài khoản: ${info.displayName}`);
    })
    .catch(() => {});

  logger.info(
    `Bot sẵn sàng. Giao diện: http://localhost:${config.ui?.port ?? 3000} | Lệnh DM cho bot: /help`
  );
}

function createRelogin(server, state, config) {
  let running = false;
  return async function relogin() {
    if (running) {
      logger.warn("Đang trong luồng đăng nhập — bỏ qua yêu cầu trùng lặp");
      return;
    }
    running = true;
    server.broadcast("relogin", { ok: true });
    try {
      state.bot?.stop?.();
    } catch (e) {
      logger.warn(`Dừng bot lúc đăng nhập lại lỗi: ${e.message}`);
    }
    state.bot = null;
    state.api = null;
    state.accountInfo = null;
    try {
      await startRuntime(server, state, config);
    } catch (e) {
      logger.error(`Đăng nhập lại thất bại: ${e.message} — bot chưa chạy, đợi mạng ổn rồi bấm "Đăng nhập lại"`);
    } finally {
      running = false;
    }
  };
}

async function main() {
  const config = loadConfig();
  const sentMessageIndex = createSentMessageIndex();
  const { createCustomerSearchService } = await import("./features/customer-search/service.js");
  const customerSearch = createCustomerSearchService();
  // Seed kho địa danh lần đầu (seed + alias phường); lần sau giữ nguyên.
  try {
    const { ensureSeeded } = await import("./features/location-rules/service.js");
    const seeded = ensureSeeded(config.areas);
    logger.info(`Kho địa danh: ${seeded.rules.length} rule (nguồn: ${seeded.source})`);
  } catch (e) {
    logger.warn(`Không seed được kho địa danh: ${e.message}`);
  }
  logger.info(`zaloSALE khởi động — mode: ${config.mode}`);

  const status = {
    startedAt: new Date(),
    forwarded: 0,
    mode: config.mode,
    knownSources: [],
  };
  const state = { config, status, bot: null, api: null, accountInfo: null, sentMessageIndex, customerSearch };

  const server = new ApiServer({ port: config.ui?.port ?? 3000, ctx: () => state });
  await server.start();

  state.actions = {
    /** Đăng xuất: xoá phiên + ngắt kết nối bot (server web vẫn chạy) */
    logout() {
      try {
        state.bot?.stop?.();
      } catch (e) {
        logger.warn(`Dừng bot lúc đăng xuất lỗi: ${e.message}`);
      }
      state.bot = null;
      state.api = null;
      state.accountInfo = null;
      logoutLocal();
      server.broadcast("logout", { ok: true });
    },
    /** Đăng nhập lại: ưu tiên phiên đã lưu (nếu mạng OK là vào ngay), chỉ mất hợp lệ mới hiện QR mới */
    relogin: createRelogin(server, state, config),
  };

  try {
    await startRuntime(server, state, config);
  } catch (e) {
    logger.error(`Đăng nhập thất bại: ${e.stack}`);
    process.exit(1);
  }

  const shutdown = () => {
    try {
      state.bot?.stop?.();
    } catch {
      // bỏ qua
    }
    sentMessageIndex.close();
    customerSearch.close();
    logger.info("Đã tắt bot. Hẹn gặp lại!");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  logger.error(`Khởi động thất bại: ${e.stack}`);
  process.exit(1);
});
