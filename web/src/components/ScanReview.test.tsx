// Ai viết: Codex — đơn giản hóa luồng quét nhóm nguồn
// Tại sao: khóa việc quét theo danh sách sourceGroups, không nhập bộ lọc trùng lặp ở màn quét
// Link: PLAN.md — yêu cầu UI ngày 2026-08-30

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("quét toàn bộ nhóm nguồn khi để mặc định", async () => {
    render(<ScanReviewPanel defaultDays={1} sourceGroups={["Nguồn A", "Nguồn B"]} />);

    expect(screen.getByLabelText("Nhóm nguồn cần quét")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Từ khóa"), { target: { value: "HÀ ĐÔNG" } });
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));

    await waitFor(() => expect(control).toHaveBeenCalledWith({
      action: "scan",
      from: expect.any(String),
      to: expect.any(String),
      keyword: "HÀ ĐÔNG",
    }));
  });

  it("chỉ gửi đúng nhóm nguồn được chọn khi quét", async () => {
    render(<ScanReviewPanel defaultDays={1} sourceGroups={["Nguồn A", "Nguồn B"]} />);

    fireEvent.change(screen.getByLabelText("Nhóm nguồn cần quét"), { target: { value: "Nguồn B" } });
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));

    await waitFor(() => expect(control).toHaveBeenCalledWith(expect.objectContaining({ action: "scan", name: "Nguồn B" })));
  });

  it("hiển thị hoa hồng và mở ảnh xem lớn", async () => {
    control.mockResolvedValueOnce({ ok: true, scan: null }).mockResolvedValueOnce({
      ok: true,
      scanId: "scan-photo",
      range: "04/09/2026",
      groups: 1,
      total: 1,
      posts: [{
        id: "post-1", tid: "source", name: "Kho phòng", clean: "Mã R151",
        areaName: "cau giay", detectedArea: "Cầu Giấy · Dịch Vọng", destinationNames: ["cau giay"], kw: "cau giay",
        photos: 1, photoUrls: ["https://example.test/room.jpg"],
        price: 4.5, commissionPercent: 40, inPriceRange: true, ts: Date.now(),
        clusterItems: [
          { text: "Mã R151", photoUrls: ["https://example.test/room.jpg"], ts: Date.now() },
          { text: "P101", photoUrls: [], ts: Date.now() + 1 },
          { text: "P404", photoUrls: [], ts: Date.now() + 2 },
        ],
      }, {
        id: "post-2", tid: "source-2", name: "Nguồn khác", clean: "Mã R152",
        areaName: null, destinationNames: [], kw: "", photos: 0, photoUrls: [], price: null,
        commissionPercent: null, inPriceRange: true, ts: Date.now() - 1000, clusterItems: [],
      }],
    });
    render(<ScanReviewPanel defaultDays={1} areas={[{ keywords: ["cau giay"], groupLink: "", id: "dest-cau-giay" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));

    expect(await screen.findByText("40%")).toBeInTheDocument();
    expect(screen.getAllByText("Chưa gửi")).toHaveLength(2);
    expect(screen.getByText("Cầu Giấy · Dịch Vọng")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lọc ảnh"), { target: { value: "yes" } });
    expect(screen.getByText("Đang xem 1/2 bài. “Gửi tất cả” vẫn gửi toàn bộ kết quả quét.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lọc từ khóa đích"), { target: { value: "cau giay" } });
    expect(screen.getByText("Đang xem 1/2 bài. “Gửi tất cả” vẫn gửi toàn bộ kết quả quét.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem ảnh 1 của tin Mã R151" }));
    expect(screen.getByRole("dialog", { name: "Xem ảnh phòng" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ảnh phòng 1/1" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Xem ảnh phòng" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2 phòng" }));
    const clusterDialog = screen.getByRole("dialog", { name: "Chi tiết cụm tin" });
    expect(clusterDialog).toBeInTheDocument();
    expect(within(clusterDialog).getByText("Mã R151")).toBeInTheDocument();
    expect(within(clusterDialog).getByText("Danh sách phòng (2)")).toBeInTheDocument();
    expect(within(clusterDialog).getAllByText("P101")).toHaveLength(2);
    control.mockResolvedValueOnce({ ok: true, sent: 1 });
    fireEvent.click(screen.getByRole("button", { name: "📤 Gửi nhóm cau giay (1)" }));
    await waitFor(() => expect(control).toHaveBeenCalledWith(expect.objectContaining({ action: "forwardSel", destinationKeyword: "cau giay", indexes: [0] })));
  });

  it("cập nhật trạng thái ngay sau khi gửi", async () => {
    const post = {
      id: "post-status", tid: "source", name: "Kho phòng", clean: "Mã TT110",
      areaName: "cau giay", destinationNames: ["cau giay"], kw: "cau giay",
      photos: 0, photoUrls: [], price: 4, commissionPercent: null, inPriceRange: true,
      ts: Date.now(), clusterItems: [], status: "pending" as const,
    };
    control
      .mockResolvedValueOnce({ ok: true, scan: null })
      .mockResolvedValueOnce({ ok: true, scanId: "scan-status", range: "05/09/2026", groups: 1, total: 1, added: 1, posts: [post] })
      .mockResolvedValueOnce({ ok: true, sent: 1, posts: [] });
    render(<ScanReviewPanel defaultDays={1} />);
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));
    expect(await screen.findByText("Chưa gửi")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: "📤 Gửi tin đã chọn (1)" }));
    expect(await screen.findByText("✓ Đã đưa 1 bài vào hàng đợi gửi — xem Nhật ký")).toBeInTheDocument();
    expect(screen.queryByText("Mã TT110")).not.toBeInTheDocument();
  });

  it("gửi ngay một tin tới đúng nhóm đích của tin đó", async () => {
    const post = {
      id: "post-now", tid: "source", name: "Kho phòng", clean: "Mã NOW01",
      areaName: "cau giay", destinationNames: ["cau giay"], kw: "cau giay",
      photos: 0, photoUrls: [], price: 4, commissionPercent: null, inPriceRange: true,
      ts: Date.now(), clusterItems: [], status: "pending" as const,
    };
    control
      .mockResolvedValueOnce({ ok: true, scan: null })
      .mockResolvedValueOnce({ ok: true, scanId: "scan-now", range: "05/09/2026", groups: 1, total: 1, added: 1, posts: [post] })
      .mockResolvedValueOnce({ ok: true, sent: 1 });
    render(<ScanReviewPanel defaultDays={1} />);
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));
    await screen.findByText("Mã NOW01");
    fireEvent.click(screen.getByRole("button", { name: "Gửi ngay cau giay" }));

    await waitFor(() => expect(control).toHaveBeenCalledWith({
      action: "forwardSel", scanId: "scan-now", indexes: [0], destinationKeyword: "cau giay",
    }));
  });

  it("hiển thị tiến độ cụm đang gửi và nút dừng sau cụm hiện tại", async () => {
    control.mockResolvedValueOnce({
      ok: true,
      scan: {
        scanId: "scan-progress",
        range: "05/09/2026",
        posts: [],
        progress: {
          running: true,
          current: 3,
          total: 12,
          sourceName: "TRO365 - NGUỒN - TEAM 1.1",
          destinationName: "cau giay",
          imageCount: 7,
          startedAt: Date.now() - 65_000,
          stopRequested: false,
        },
      },
    });
    render(<ScanReviewPanel defaultDays={1} />);

    expect(await screen.findByText("Đang gửi cụm 3/12 (còn 9)")).toBeInTheDocument();
    expect(screen.getByText(/TRO365 - NGUỒN - TEAM 1.1/)).toBeInTheDocument();
    expect(screen.getByText(/cau giay/)).toBeInTheDocument();
    expect(screen.getByText(/7 ảnh/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dừng sau cụm hiện tại" })).toBeInTheDocument();
  });

  it("không tự hiển thị thông báo tòa đã full", async () => {
    control.mockResolvedValueOnce({ ok: true, scan: null }).mockResolvedValueOnce({
      ok: true,
      scanId: "scan-full",
      range: "06/09/2026",
      groups: 1,
      total: 0,
      added: 0,
      posts: [],
      fullBuildings: [{ threadId: "source", sourceName: "Kho phòng", key: "1b5", label: "1B5 Đầm Trấu", text: "1B5 Đầm Trấu full toà", status: "full" }],
    });
    render(<ScanReviewPanel defaultDays={1} />);
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));

    await screen.findByText(/Quét xong: 0 bài/);
    expect(screen.queryByText(/Tòa đã full/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1B5 Đầm Trấu — Kho phòng/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gửi tất cả/ })).not.toBeInTheDocument();
  });

  it("phân trang kết quả quét và giữ lựa chọn khi đổi trang", async () => {
    const posts = Array.from({ length: 21 }, (_, index) => ({
      id: `post-${index + 1}`, tid: "source", name: "Kho phòng", clean: `Mã ${index + 1}`,
      areaName: "cau giay", destinationNames: ["cau giay"], kw: "cau giay",
      photos: 0, photoUrls: [], price: null, commissionPercent: null, inPriceRange: true,
      ts: Date.now() + index, clusterItems: [], status: "pending" as const,
    }));
    control
      .mockResolvedValueOnce({ ok: true, scan: null })
      .mockResolvedValueOnce({ ok: true, scanId: "scan-pages", range: "05/09/2026", groups: 1, total: 21, added: 21, posts });
    render(<ScanReviewPanel defaultDays={1} />);
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));

    expect(await screen.findByText("1 / 2 (21 bài)")).toBeInTheDocument();
    expect(screen.queryByText("Mã 21")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sau ›" }));
    const lastRow = await screen.findByText("Mã 21");
    fireEvent.click(within(lastRow.closest("tr")!).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "‹ Trước" }));

    expect(screen.getByRole("button", { name: "📤 Gửi tin đã chọn (1)" })).toBeInTheDocument();
  });

  it("hiện nút dừng và đếm realtime ngay khi bấm gửi", async () => {
    const post = {
      id: "post-live", tid: "source", name: "Kho phòng", clean: "Mã LIVE01",
      areaName: "cau giay", destinationNames: ["cau giay"], kw: "cau giay",
      photos: 0, photoUrls: [], price: null, commissionPercent: null, inPriceRange: true,
      ts: Date.now(), clusterItems: [], status: "pending" as const,
    };
    let resolveSend!: (value: unknown) => void;
    const sendPromise = new Promise((resolve) => { resolveSend = resolve; });
    control
      .mockResolvedValueOnce({ ok: true, scan: null })
      .mockResolvedValueOnce({ ok: true, scanId: "scan-live", range: "05/09/2026", groups: 1, total: 1, added: 1, posts: [post] })
      .mockReturnValueOnce(sendPromise);
    render(<ScanReviewPanel defaultDays={1} />);
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));
    await screen.findByText("Mã LIVE01");
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: "📤 Gửi tin đã chọn (1)" }));

    // Chưa xong nhưng đã thấy nút dừng
    expect(await screen.findByRole("button", { name: "Dừng sau cụm hiện tại" })).toBeInTheDocument();

    // Server báo tiến độ cụm 1/5 → đếm còn 4
    control.mockResolvedValueOnce({
      ok: true,
      scan: {
        scanId: "scan-live", range: "05/09/2026", posts: [post],
        progress: { running: true, current: 1, total: 5, sourceName: "Kho phòng", destinationName: "cau giay", imageCount: 0, startedAt: Date.now(), stopRequested: false },
      },
    });
    expect(await screen.findByText(/Đang gửi cụm 1\/5 \(còn 4\)/)).toBeInTheDocument();

    resolveSend({ ok: true, sent: 1, posts: [] });
    control.mockResolvedValueOnce({
      ok: true,
      scan: {
        scanId: "scan-live", range: "05/09/2026", posts: [],
        progress: { running: false, current: 1, total: 1, sourceName: "Kho phòng", destinationName: "cau giay", imageCount: 0, startedAt: Date.now(), endedAt: Date.now(), stopRequested: false },
      },
    });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Dừng sau cụm hiện tại" })).not.toBeInTheDocument());
  });
});
