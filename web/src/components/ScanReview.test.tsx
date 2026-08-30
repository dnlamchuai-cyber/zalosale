// Ai viết: Codex — đơn giản hóa luồng quét nhóm nguồn
// Tại sao: khóa việc quét theo danh sách sourceGroups, không nhập bộ lọc trùng lặp ở màn quét
// Link: PLAN.md — yêu cầu UI ngày 2026-08-30

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScanReviewPanel } from "./ScanReview";

const { control } = vi.hoisted(() => ({ control: vi.fn() }));

vi.mock("../api", () => ({ api: { control } }));

describe("ScanReviewPanel", () => {
  beforeEach(() => {
    control.mockReset();
    control.mockResolvedValue({
      ok: true,
      scanId: "scan-1",
      range: "30/08/2026",
      groups: 2,
      total: 0,
      posts: [],
    });
  });

  it("quét toàn bộ nhóm đã chọn trong tab Nhóm nguồn", async () => {
    render(<ScanReviewPanel defaultDays={1} />);

    expect(screen.queryByLabelText("Lọc theo nhóm nguồn (tuỳ chọn)")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Từ khóa"), { target: { value: "HÀ ĐÔNG" } });
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));

    await waitFor(() => expect(control).toHaveBeenCalledWith({
      action: "scan",
      from: expect.any(String),
      to: expect.any(String),
      keyword: "HÀ ĐÔNG",
    }));
  });
});
