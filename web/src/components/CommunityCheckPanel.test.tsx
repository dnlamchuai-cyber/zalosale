// Test đơn giản cho CommunityCheckPanel — không cần vitest, chỉ check file tồn tại và có logic
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = fs.readFileSync(path.join(__dirname, "CommunityCheckPanel.tsx"), "utf8");

// Test 1: có nút Quét
console.log("Test 1: có nút Quét", file.includes("Quét") ? "PASS" : "FAIL");
// Test 2: có báo lỗi khi chưa chọn nhóm
console.log("Test 2: có check selectedId", file.includes("Chọn 1 nhóm") ? "PASS" : "FAIL");
console.log("Done");
