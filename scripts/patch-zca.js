// Patch zca-js 2.1.2: getAllGroups gọi /api/group/getlg/v4 không kèm tham số
// → Zalo trả lỗi 114 "Tham số không hợp lệ" (nhất là tài khoản nhiều nhóm).
// Fix: mã hoá {t: Date.now()} như các API khác (getmg-v2, history...).
// Script chạy lúc postinstall, idempotent.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, "node_modules", "zca-js", "dist", "apis", "getAllGroups.js");

const MARKER = "t: Date.now()";
const OLD = `    return async function getAllGroups() {
        const response = await utils.request(serviceURL, {
            method: "GET",
        });
        return utils.resolve(response);
    };`;

const NEW = `    return async function getAllGroups() {
        const params = { t: Date.now() };
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams) throw new Error("Failed to encrypt message");
        const response = await utils.request(utils.makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });
        return utils.resolve(response);
    };`;

try {
  if (!fs.existsSync(FILE)) {
    console.log("[patch-zca] Không tìm thấy getAllGroups.js — bỏ qua");
    process.exit(0);
  }
  const src = fs.readFileSync(FILE, "utf8");
  if (src.includes(MARKER)) {
    console.log("[patch-zca] getAllGroups đã được patch sẵn — bỏ qua");
    process.exit(0);
  }
  if (!src.includes(OLD)) {
    console.log("[patch-zca] Không khớp mẫu gốc — bỏ qua (có thể bản zca-js đã khác)");
    process.exit(0);
  }
  fs.writeFileSync(FILE, src.replace(OLD, NEW));
  console.log("[patch-zca] Đã patch getAllGroups (thêm tham số mã hoá t)");
} catch (e) {
  console.error("[patch-zca] Lỗi:", e.message);
  process.exit(1);
}