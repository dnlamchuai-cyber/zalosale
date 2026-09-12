import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import { saveConfig } from "./config.js";
import { locationRulesRoutes } from "./features/location-rules/route.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Server Express: REST API + SSE + serve frontend React (web/dist) */
export class ApiServer {
  constructor({ port, ctx }) {
    this.port = port;
    this.ctx = ctx; // () => ({ config, status, bot, actions })
    this.clients = new Set();
    this.logBuffer = [];
    this.latestQr = null;
    this.loggedIn = false;
    this.app = express();
    this.app.use(express.json({ limit: "2mb" }));
    this.setupRoutes();
    this.attachLogger();
  }

  attachLogger() {
    logger.onLog(({ level, line }) => {
      this.logBuffer.push({ level, line });
      if (this.logBuffer.length > 300) this.logBuffer.shift();
      this.broadcast("log", { level, line });
    });
  }

  broadcast(type, data) {
    if (type === "qr") this.latestQr = data?.qr ?? data;
    if (type === "login" || type === "ready") {
      this.loggedIn = true;
      this.latestQr = null;
    }
    if (type === "logout" || type === "relogin") {
      this.loggedIn = false;
      this.latestQr = null;
    }
    const frame = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of this.clients) {
      try {
        res.write(frame);
      } catch {
        this.clients.delete(res);
      }
    }
  }

  setupRoutes() {
    const { ctx } = this;

    // ---- REST ----
    this.app.get("/api/status", (req, res) => {
      const { config, status, bot, accountInfo } = ctx();
      res.json({
        ok: true,
        mode: status.mode,
        forwarded: status.forwarded,
        startedAt: status.startedAt,
        knownSources: status.knownSources || [],
        areas: bot ? bot.areaInfos() : [],
        loggedIn: !!bot,
        accountInfo: accountInfo || null,
      });
    });

    this.app.get("/api/config", (req, res) => res.json({ ok: true, config: ctx().config }));

    this.app.post("/api/config", (req, res) => {
      try {
        const parsed = saveConfig(req.body || {});
        ctx().config = parsed;
        ctx().bot?.refresh?.(parsed);
        this.broadcast("config", { config: parsed });
        res.json({ ok: true, config: parsed });
      } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
      }
    });

    this.app.get("/api/groups", async (req, res) => {
      const force = req.query.force === "1" || req.query.force === "true";
      const gs = await ctx().bot?.listGroups?.(force).catch(() => []);
      res.json({ ok: true, groups: gs || [], fromCache: !force });
    });

    this.app.get("/api/logs", (req, res) => res.json({ ok: true, logs: this.logBuffer }));
    this.app.get("/api/qr", (req, res) => res.json({ ok: true, qr: this.latestQr, loggedIn: this.loggedIn }));

    this.app.get("/api/sent-rooms", async (req, res) => {
      const { sentMessageIndex } = ctx();
      if (!sentMessageIndex) return res.status(503).json({ ok: false, error: "Kho tin chưa sẵn sàng" });
      const { searchSentRoomsRoute } = await import("./features/sent-message-index/route.js");
      req.sentMessageIndex = sentMessageIndex;
      return searchSentRoomsRoute(req, res);
    });

    this.app.post("/api/sent-rooms/clear", async (req, res) => {
      const { sentMessageIndex } = ctx();
      if (!sentMessageIndex) return res.status(503).json({ ok: false, error: "Kho tin chưa sẵn sàng" });
      const { clearSentRoomsRoute } = await import("./features/sent-message-index/route.js");
      req.sentMessageIndex = sentMessageIndex;
      return clearSentRoomsRoute(req, res);
    });

    this.app.post("/api/community/check", async (req, res) => {      const { bot, config, api } = ctx();
      if (!bot) return res.status(409).json({ ok: false, error: "Bot chưa sẵn sàng" });
      const apiInst = api ?? bot.api ?? null;
      if (!apiInst) return res.status(500).json({ ok: false, error: "Không lấy được api" });
      const { communityCheckRoute } = await import("./features/community-check/route.js");
      req.api = apiInst;
      req.config = config;
      return communityCheckRoute(req, res);
    });

    try {
      locationRulesRoutes(this.app, () => ctx().config);
    } catch (e) {
      logger.warn(`Không đăng ký được location-rules routes: ${e.message}`);
    }

    // ---- Control ----
    this.app.post("/api/control", async (req, res) => {
      const body = req.body || {};
      const { action, mode, threadId, days, from, to, name, keyword } = body;
      const { status, bot } = ctx();
      try {
        switch (action) {
          case "mode": {
            if (mode !== "auto" && mode !== "manual") return res.status(400).json({ ok: false, error: "mode phải là auto hoặc manual" });
            status.mode = mode;
            logger.info(`Đổi mode qua UI: ${mode}`);
            return res.json({ ok: true, mode: status.mode });
          }
          case "forward": {
            if (!bot) return res.status(409).json({ ok: false, error: "Bot chưa sẵn sàng" });
            const { resolveRange } = await import("./history.js");
            const range = resolveRange({ days, from, to });
            if (range.error) return res.status(400).json({ ok: false, error: range.error });
            const run = threadId
              ? bot.forwardRangeForThread(String(threadId), range)
              : bot.forwardRangeForSources(name || "", range);
            const { total, groups } = await run;
            return res.json({ ok: true, total, groups, range: range.label });
          }
          case "resolve": {
            if (!bot) return res.status(409).json({ ok: false, error: "Bot chưa sẵn sàng" });
            const areas = await bot.resolveAreas();
            return res.json({ ok: true, areas });
          }
          case "scan": {
            if (!bot) return res.status(409).json({ ok: false, error: "Bot chưa sẵn sàng" });
            if (keyword != null && typeof keyword !== "string") return res.status(400).json({ ok: false, error: "Từ khóa phải là chuỗi" });
            if (typeof keyword === "string" && keyword.trim().length > 50) return res.status(400).json({ ok: false, error: "Từ khóa tối đa 50 ký tự" });
            const { resolveRange } = await import("./history.js");
            const range = resolveRange({ days, from, to });
            if (range.error) return res.status(400).json({ ok: false, error: range.error });
            const r = await bot.scanRange(name || "", range, keyword?.trim() || "");
            if (r.error) return res.status(400).json({ ok: false, error: r.error });
            return res.json({ ok: true, scanId: r.scanId, range: r.range, groups: r.groups, total: r.total, added: r.added, posts: r.posts, fullBuildings: r.fullBuildings || [] });
          }
          case "scanState": {
            const scan = bot?.scanState?.();
            return res.json({ ok: true, scan });
          }
          case "stopForward": {
            const stopped = bot?.requestStopAfterCurrent?.() || false;
            return res.json({ ok: true, stopped, progress: bot?.scanState?.()?.progress || null });
          }
          case "forwardSel": {
            const indexes = Array.isArray(body.indexes) ? body.indexes.map(Number) : [];
            if (!indexes.length) return res.status(400).json({ ok: false, error: "Chưa chọn tin nào" });
            const destinationKeyword = typeof body.destinationKeyword === "string" ? body.destinationKeyword.trim() : "";
            if (destinationKeyword.length > 100) return res.status(400).json({ ok: false, error: "Từ khóa nhóm đích tối đa 100 ký tự" });
            const r = bot?.forwardSelected ? await bot.forwardSelected(String(body.scanId), indexes, destinationKeyword, body.force === true, body.videoOnly === true) : { sent: 0, error: "Bot chưa sẵn sàng" };
            if (r.error) return res.status(400).json({ ok: false, error: r.error });
            return res.json({ ok: true, sent: r.sent, failed: r.failed || 0, stopped: r.stopped || false, posts: bot?.scanState?.()?.posts || [], progress: bot?.scanState?.()?.progress || null });
          }
          case "forwardAll": {
            const r = bot?.forwardAll ? await bot.forwardAll(String(body.scanId)) : { sent: 0, error: "Bot chưa sẵn sàng" };
            if (r.error) return res.status(400).json({ ok: false, error: r.error });
            return res.json({ ok: true, sent: r.sent, failed: r.failed || 0, stopped: r.stopped || false, posts: bot?.scanState?.()?.posts || [], progress: bot?.scanState?.()?.progress || null });
          }
          case "refresh":
            bot?.refresh?.();
            return res.json({ ok: true });
          case "logout": {
            this.loggedIn = false;
            this.latestQr = null;
            ctx().actions?.logout?.();
            return res.json({ ok: true });
          }
          case "netcheck": {
            const { reportNetDiagnosis } = await import("./session.js");
            const lines = await reportNetDiagnosis();
            return res.json({ ok: true, lines });
          }
          case "relogin": {
            this.loggedIn = false;
            this.latestQr = null;
            const run = ctx().actions?.relogin?.();
            if (run?.catch) run.catch(() => {});
            return res.json({ ok: true, note: "Đang đăng nhập lại — ưu tiên phiên đã lưu, nếu không được sẽ hiện QR" });
          }
          default:
            return res.status(400).json({ ok: false, error: `Không biết action: ${action}` });
        }
      } catch (e) {
        logger.error(`Lỗi /api/control ${action}: ${e.stack}`);
        return res.status(500).json({ ok: false, error: "Yêu cầu không thể hoàn tất lúc này" });
      }
    });

    // ---- SSE ----
    this.app.get("/api/events", (req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`event: hello\ndata: {}\n\n`);
      if (this.loggedIn) {
        res.write(`event: ready\ndata: {}\n\n`);
      } else if (this.latestQr) {
        res.write(`event: qr\ndata: ${JSON.stringify({ qr: this.latestQr })}\n\n`);
      }
      this.clients.add(res);
      req.on("close", () => this.clients.delete(res));
    });

    // ---- Frontend (build của web/) ----
    const dist = path.join(ROOT, "web", "dist");
    if (fs.existsSync(dist)) {
      this.app.use(express.static(dist));
      this.app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));
    } else {
      this.app.get("/", (req, res) =>
        res.status(503).json({ ok: false, error: "Frontend chưa build. Chạy: cd web && npm install && npm run build" })
      );
    }
  }

  start() {
    this.httpServer = http.createServer(this.app);
    return new Promise((resolve, reject) => {
      this.httpServer.on("error", reject);
      this.httpServer.listen(this.port, "127.0.0.1", () => {
        logger.info(`Giao diện quản lý: http://localhost:${this.port}`);
        resolve();
      });
    });
  }
}
