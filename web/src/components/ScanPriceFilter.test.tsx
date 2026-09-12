// Ai viết: Muse Spark | Tại sao: khóa lọc khoảng giá/HH và chọn nhanh trên bảng quét
// Link: yêu cầu lọc giá + hoa hồng + chọn tin ngày 2026-09-11
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScanReviewPanel } from "./ScanReview";

const { control } = vi.hoisted(() => ({ control: vi.fn() }));

vi.mock("../api", () => ({ api: { control } }));

const post = (overrides = {}) => ({
  id: "p", tid: "g", name: "Nguồn", areaName: "cau giay",
  destinationNames: ["cau giay"], kw: "", clean: "Phòng", photos: 0,
  photoUrls: [], price: null, commissionPercent: null, inPriceRange: true,
  status: "pending" as const, ts: Date.now(), clusterItems: [], ...overrides,
});

describe("lọc giá và hoa hồng trên bảng quét", () => {
  beforeEach(() => {
    control.mockReset();
    control.mockResolvedValue({ ok: true, scan: null });
  });

  it("lọc khoảng giá và HH tối thiểu", async () => {
    control
      .mockResolvedValueOnce({ ok: true, scan: null })
      .mockResolvedValueOnce({
        ok: true, scanId: "s", range: "3 ngày", groups: 1, total: 3, added: 3,
        posts: [
          post({ id: "a", clean: "P1 giá 3tr", price: 3, commissionPercent: 10 }),
          post({ id: "b", clean: "P2 giá 6tr", price: 6, commissionPercent: 30 }),
          post({ id: "c", clean: "P3 không giá", price: null, commissionPercent: null }),
        ],
      });
    render(<ScanReviewPanel defaultDays={3} />);
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));
    await screen.findByText("P1 giá 3tr");

    fireEvent.change(screen.getByLabelText("Giá thấp nhất (triệu)"), { target: { value: "4" } });
    expect(screen.queryByText("P1 giá 3tr")).not.toBeInTheDocument();
    expect(screen.getByText("P2 giá 6tr")).toBeInTheDocument();
    expect(screen.queryByText("P3 không giá")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Giá thấp nhất (triệu)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Giá cao nhất (triệu)"), { target: { value: "5" } });
    expect(screen.getByText("P1 giá 3tr")).toBeInTheDocument();
    expect(screen.queryByText("P2 giá 6tr")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Giá cao nhất (triệu)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Hoa hồng tối thiểu (%)"), { target: { value: "20" } });
    expect(screen.queryByText("P1 giá 3tr")).not.toBeInTheDocument();
    expect(screen.getByText("P2 giá 6tr")).toBeInTheDocument();
  });

  it("chọn tất cả bài đang xem rồi gửi đúng danh sách", async () => {
    control
      .mockResolvedValueOnce({ ok: true, scan: null })
      .mockResolvedValueOnce({
        ok: true, scanId: "s", range: "3 ngày", groups: 1, total: 2, added: 2,
        posts: [post({ id: "a", clean: "P1", price: 3 }), post({ id: "b", clean: "P2", price: 9 })],
      })
      .mockResolvedValueOnce({ ok: true, sent: 2 });
    render(<ScanReviewPanel defaultDays={3} />);
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));
    await screen.findByText("P1");

    // Lọc còn 1 bài rồi chọn tất cả bài đang xem
    fireEvent.change(screen.getByLabelText("Giá thấp nhất (triệu)"), { target: { value: "5" } });
    expect(screen.queryByText("P1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "☑ Chọn 1 bài đang xem" }));
    fireEvent.click(screen.getByRole("button", { name: "📤 Gửi tin đã chọn (1)" }));

    await waitFor(() => expect(control).toHaveBeenCalledWith(
      expect.objectContaining({ action: "forwardSel", scanId: "s", indexes: [1] }),
    ));
  });
});
