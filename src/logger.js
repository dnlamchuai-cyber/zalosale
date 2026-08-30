import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LOG_DIR = path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

fs.mkdirSync(LOG_DIR, { recursive: true });

const logBus = new EventEmitter();
logBus.setMaxListeners(100);

function fmt(arg) {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === "object") {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function write(level, args) {
  const line = `${new Date().toISOString()} [${level}] ${args.map(fmt).join(" ")}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // không chặn bot khi lỗi ghi log
  }
  logBus.emit("log", { level, line });
}

export const logger = {
  info: (...a) => write("INFO", a),
  warn: (...a) => write("WARN", a),
  error: (...a) => write("ERROR", a),
  debug: (...a) => write("DEBUG", a),
  onLog: (fn) => logBus.on("log", fn),
};