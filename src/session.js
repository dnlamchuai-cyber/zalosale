import fs from "fs";
import path from "path";
import qrcode from "qrcode-terminal";
import { Zalo } from "zca-js";
import { logger } from "./logger.js";
import { SESSION_DIR } from "./config.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CREDENTIAL_FILE = path.join(SESSION_DIR, "credential.json");
const QR_FILE = path.join(SESSION_DIR, "qr-login.png");

// LoginQRCallbackEventType của zca-js 2.1.2
const EVT = { QRCodeGenerated: 0, QRCodeExpired: 1, QRCodeScanned: 2, QRCodeDeclined: 3, GotLoginInfo: 4 };

/** onQr(imageBase64): đẩy QR (base64 png, không có prefix data:) ra UI web */
function handleQr(imageBase64, onQr) {
  try {
    if (onQr) onQr(imageBase64);
  } catch (e) {
    logger.warn(`Đẩy QR ra UI lỗi: ${e.message}`);
  }
  const isPng = String(imageBase64 || "").startsWith("iVBORw0KGgo") || String(imageBase64).length > 300;
  if (isPng) {
    try {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      fs.writeFileSync(QR_FILE, Buffer.from(imageBase64.replace(/^data:image\/png;base64,/, ""), "base64"));
      logger.info(`Đã lưu ảnh QR (${QR_FILE}) — quét trên giao diện web tại http://localhost:3000`);
      return;
    } catch (e) {
      logger.warn(`Ghi file QR lỗi: ${e.message}`);
    }
  }
  qrcode.generate(String(imageBase64), { small: true });
}

function saveCredentials(creds) {
  try {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    fs.writeFileSync(CREDENTIAL_FILE, JSON.stringify(creds, null, 2));
    logger.info("Đã lưu phiên đăng nhập vào config/session/credential.json");
  } catch (e) {
    logger.warn(`Không lưu được phiên: ${e.message}`);
  }
}

function loadCredentials() {
  if (!fs.existsSync(CREDENTIAL_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CREDENTIAL_FILE, "utf8"));
  } catch (e) {
    logger.warn(`File phiên lỗi (${e.message}), sẽ xoá và đăng nhập lại`);
    fs.rmSync(CREDENTIAL_FILE, { force: true });
    return null;
  }
}

function isNetworkError(e) {
  const msg = String(e?.message || "") + " " + String(e?.cause?.code || "");
  return (
    msg.includes("fetch failed") ||
    ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET"].some((c) =>
      msg.includes(c)
    )
  );
}

const HOSTS = [
  "wpa.chat.zalo.me",
  "api.zalo.me",
  "id.zalo.me",
  "jr.chat.zalo.me",
  "chat.zalo.me",
  "stc-zlogin.zdn.vn",
];

async function checkHost(host) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://${host}/`, { signal: ctrl.signal });
    clearTimeout(timer);
    return `OK (HTTP ${res.status})`;
  } catch (e) {
    return `KHÔNG kết nối được (${e.name}: ${e.message})`;
  }
}

export async function reportNetDiagnosis() {
  const lines = [];
  for (const host of HOSTS) lines.push(`  • ${host} → ${await checkHost(host)}`);
  logger.error(`Kiểm tra mạng tới Zalo:\n${lines.join("\n")}`);
  return lines;
}

async function tryLoginWithCred(creds, tries = 10) {
  let lastErr = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const zalo = new Zalo();
      const api = await zalo.login(creds);
      logger.info("Đăng nhập lại bằng phiên đã lưu — thành công");
      return { api, zalo };
    } catch (e) {
      lastErr = e;
      if (isNetworkError(e)) {
        const delay = Math.min(5000 * (attempt + 1), 30000);
        logger.warn(
          `Phiên đã lưu: lỗi mạng tạm thời (${e.message}) — thử lại lần ${attempt + 1} sau ${Math.round(delay / 1000)}s (giữ phiên, không cần quét lại)`
        );
        await sleep(delay);
        continue;
      }
      logger.warn(`Phiên đã lưu lần ${attempt + 1} thất bại: ${e.message}`);
      await sleep(3000);
    }
  }
  throw lastErr;
}

export function logoutLocal() {
  try {
    fs.rmSync(CREDENTIAL_FILE, { force: true });
    logger.info("Đã đăng xuất — xoá phiên đăng nhập đã lưu");
    return true;
  } catch (e) {
    logger.warn(`Xoá phiên lỗi: ${e.message}`);
    return false;
  }
}

export async function login(onQr = null, onScan = null) {
  // 1) Đã có phiên → dùng lại (kể cả lỗi mạng cũng không xoá, chỉ thử lại)
  const saved = loadCredentials();
  if (saved) {
    try {
      return await tryLoginWithCred(saved);
    } catch (e) {
      if (isNetworkError(e)) {
        logger.error(`Không vào được Zalo vì lỗi mạng (${e.message}) — GIỮ phiên, không xoá. Kiểm tra mạng/VPN/DNS rồi chạy lại npm start (không cần quét QR).`);
        await reportNetDiagnosis();
        throw e;
      }
      logger.error(`Phiên đã lưu không dùng được (${e.message}), xoá phiên và quét QR lại`);
      fs.rmSync(CREDENTIAL_FILE, { force: true });
    }
  }

  // 2) Chưa có phiên → quét QR. Nếu ảnh quét xong mà kết nối lỗi mạng thì tự dùng phiên vừa lưu thử lại.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const zalo = new Zalo();
      const api = await zalo.loginQR({}, (evt) => {
        switch (evt.type) {
          case EVT.QRCodeGenerated:
            handleQr(evt.data?.image, onQr);
            try {
              evt.actions.saveToFile(QR_FILE).catch(() => {});
            } catch {
              // không chặn nếu không ghi được file
            }
            break;
          case EVT.QRCodeExpired:
            logger.warn("QR hết hạn — tạo mã mới...");
            try {
              evt.actions.retry();
            } catch {
              // bỏ qua
            }
            break;
          case EVT.QRCodeScanned:
            logger.info("Đã quét QR — chờ bạn xác nhận trên điện thoại...");
            if (onScan) {
              try {
                onScan();
              } catch {
                // bỏ qua
              }
            }
            break;
          case EVT.QRCodeDeclined:
            logger.error("Bạn đã từ chối đăng nhập — quét QR mới nếu muốn tiếp tục");
            try {
              evt.actions.retry();
            } catch {
              // bỏ qua
            }
            break;
          case EVT.GotLoginInfo:
            saveCredentials(evt.data); // { cookie, imei, userAgent }
            break;
        }
      });
      return { api, zalo };
    } catch (e) {
      if (isNetworkError(e)) {
        const savedNow = loadCredentials();
        if (savedNow) {
          try {
            return await tryLoginWithCred(savedNow);
          } catch (e2) {
            logger.warn(`Thử lại phiên vừa lưu sau lỗi mạng thất bại: ${e2.message}`);
          }
          logger.error("Không hoàn tất được đăng nhập vì mạng lỗi tới Zalo — GIỮ phiên vừa lưu. Kiểm tra mạng/VPN/DNS rồi chạy lại npm start, không cần quét QR nữa.");
          await reportNetDiagnosis();
          throw new Error("Đăng nhập thất bại do lỗi mạng — xem mục Kiểm tra mạng ở log trên");
        }
        // Chưa kịp lấy được thông tin đăng nhập (lỗi mạng trong lúc tạo QR) → thử tạo QR mới vài lần rồi chẩn đoán
        if (attempt < 3) {
          logger.warn(`Lỗi mạng trong lúc tạo QR (${e.message}) — thử lại lần ${attempt + 2} sau 10s`);
          await sleep(10000);
          continue;
        }
        logger.error('Vẫn không tạo được QR sau 4 lần — mạng lỗi tới Zalo. Bấm "Đăng nhập lại" trên web khi mạng ổn.');
        await reportNetDiagnosis();
        throw e;
      }
      throw e;
    }
  }
  throw new Error("Đăng nhập QR thất bại sau nhiều lần thử — kiểm tra mạng rồi chạy lại npm start");
}