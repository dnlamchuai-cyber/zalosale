import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import { saveConfig } from "./config.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUB_DIR = path.join(ROOT, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** Giao diện quản lý web: localhost, không cần dependency ngoài */
export class ControlServer {
  constructor({ port, ctx }) {
    this.port = port;
    this.ctx = ctx; // () => ({ config, status, bot })
    this.clients = new Set();
    this.logBuffer = [];
    this.latestQr = null;
    this.loggedIn = false;
    this.broadcast("log", { level: "INFO", line: "Giao diện quản lý đã khởi động" });
    logger.onLog(({ level, line }) => {
      this.logBuffer.push({ level, line });
      if (this.logBuffer.length > 300) this.logBuffer.shift();
      this.broadcast("log", { level, line });
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handle(req, res).catch((e) => {
          logger.error(`Lỗi HTTP ${req.url}: ${e.stack}`);
          this.json(res, 500, { ok: false, error: "Yêu cầu không thể hoàn tất lúc này" });
        });
      });
      this.server.on("error", reject);
      this.server.listen(this.port, "127.0.0.1", () => {
        logger.info(`Giao diện quản lý: http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  json(res, code, data) {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
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

  async handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const p = url.pathname;

    if (p === "/api/events") return this.sse(req, res);
    if (p === "/api/config" && req.method === "GET") return this.json(res, 200, { ok: true, config: this.ctx().config });
    if (p === "/api/config" && req.method === "POST") return this.saveConfig(req, res);
    if (p === "/api/status") {
      const { config, status, bot } = this.ctx();
      return this.json(res, 200, {
        ok: true,
        mode: status.mode,
        forwarded: status.forwarded,
        startedAt: status.startedAt,
        knownSources: status.knownSources || [],
        areas: bot ? bot.areaInfos() : [],
        groupsCount: null,
        loggedIn: !!bot,
      });
    }
    if (p === "/api/groups") {
      const gs = await this.ctx().bot?.listGroups?.().catch(() => []);
      return this.json(res, 200, { ok: true, groups: gs || [] });
    }
    if (p === "/api/logs") return this.json(res, 200, { ok: true, logs: this.logBuffer });
    if (p === "/api/qr") return this.json(res, 200, { ok: true, qr: this.latestQr, loggedIn: this.loggedIn });
    if (p === "/api/control" && req.method === "POST") return this.control(req, res);
    return this.static(req, res, p);
  }

  sse(req, res) {
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
  }

  async readBody(req, limit = 2 * 1024 * 1024) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw new Error("Body quá lớn");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  async saveConfig(req, res) {
    const raw = JSON.parse(await this.readBody(req));
    const parsed = saveConfig(raw);
    this.ctx().config = parsed;
    this.ctx().bot?.refresh?.();
    this.broadcast("config", { config: parsed });
    this.json(res, 200, { ok: true, config: parsed });
  }

  async control(req, res) {
    const body = JSON.parse(await this.readBody(req));
    const { action } = body;
    const { status, bot } = this.ctx();

    switch (action) {
      case "mode": {
        if (body.mode !== "auto" && body.mode !== "manual") {
          return this.json(res, 400, { ok: false, error: "mode phải là auto hoặc manual" });
        }
        status.mode = body.mode;
        logger.info(`Đổi mode qua UI: ${body.mode}`);
        return this.json(res, 200, { ok: true, mode: status.mode });
      }
      case "forward": {
        if (!bot) return this.json(res, 409, { ok: false, error: "Bot chưa sẵn sàng" });
        const { resolveRange } = await import("./history.js");
        const range = resolveRange({ days: body.days, from: body.from, to: body.to });
        if (range.error) return this.json(res, 400, { ok: false, error: range.error });
        const run = body.threadId
          ? bot.forwardRangeForThread(String(body.threadId), range)
          : bot.forwardRangeForSources(body.name || "", range);
        const { total, groups } = await run;
        return this.json(res, 200, { ok: true, total, groups, range: range.label });
      }
      case "resolve": {
        if (!bot) return this.json(res, 409, { ok: false, error: "Bot chưa sẵn sàng" });
        const areas = await bot.resolveAreas();
        return this.json(res, 200, { ok: true, areas });
      }
      case "refresh":
        bot?.refresh?.();
        return this.json(res, 200, { ok: true });
      case "logout": {
        this.loggedIn = false;
        this.latestQr = null;
        this.ctx().actions?.logout?.();
        return this.json(res, 200, { ok: true });
      }
      case "netcheck": {
        const { reportNetDiagnosis } = await import("./session.js");
        const lines = await reportNetDiagnosis();
        return this.json(res, 200, { ok: true, lines });
      }
      case "relogin": {
        this.loggedIn = false;
        this.latestQr = null;
        const run = this.ctx().actions?.relogin?.();
        if (run?.catch) run.catch(() => {});
        return this.json(res, 200, { ok: true, note: "Đang đăng nhập lại — QR mới sẽ hiện ra" });
      }
      default:
        return this.json(res, 400, { ok: false, error: `Không biết action: ${action}` });
    }
  }

  static(req, res, p) {
    let file = p === "/" ? "/index.html" : p;
    const full = path.resolve(PUB_DIR, "." + file);
    if (!full.startsWith(path.resolve(PUB_DIR))) {
      return this.json(res, 403, { ok: false, error: "Forbidden" });
    }
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return this.json(res, 404, { ok: false, error: "Not found" });
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(fs.readFileSync(full));
  }
}
