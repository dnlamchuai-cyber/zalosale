import { logger } from "./logger.js";
import { loadConfig } from "./config.js";
import { login, logoutLocal } from "./session.js";
import { Batcher } from "./batcher.js";
import { Forwarder } from "./forwarder.js";
import { startBot } from "./listener.js";
import { ApiServer } from "./server-api.js";

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

  const forwarder = new Forwarder(api, config, () => {
    state.status.forwarded += 1;
  });
  const batcher = new Batcher(config.forward);

  batcher.on("batch", async ({ threadId, items }) => {
    // luôn lưu realtime để quét lại được kể cả khi đang manual
    try {
      const { appendBatch } = await import("./store.js");
      const name = state.status.knownSources.find((s) => String(s.threadId) === String(threadId))?.name || String(threadId);
      appendBatch(threadId, items, name);
    } catch {}
    if (state.status.mode === "manual") {
      logger.info(`Đã lưu ${items.length} tin vào store (chế độ thủ công — chờ bạn Quét & chọn)`);
      return;
    }
    forwarder.enqueue({ threadId, items, source: "live" });
  });

  const bot = startBot({ api, config, batcher, forwarder, status: state.status });
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
  logger.info(`zaloSALE khởi động — mode: ${config.mode}`);

  const status = {
    startedAt: new Date(),
    forwarded: 0,
    mode: config.mode,
    knownSources: [],
  };
  const state = { config, status, bot: null, api: null, accountInfo: null };

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