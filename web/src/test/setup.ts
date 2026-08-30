// Ai viết: Codex — UI review slice
// Tại sao: cô lập DOM giữa các test React để kết quả không phụ thuộc thứ tự chạy
// Link: docs/05_TASKS/TASK-004_KIEM-THU-TOAN-DIEN.md

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
