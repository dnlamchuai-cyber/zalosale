// Ai viết: Codex — UI review slice
// Tại sao: khóa hành vi khoảng ngày mặc định và không hiển thị dữ liệu Community đã lỗi thời
// Link: docs/05_TASKS/TASK-004_KIEM-THU-TOAN-DIEN.md

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityCheckPanel } from "./CommunityCheckPanel";

const { groups } = vi.hoisted(() => ({ groups: vi.fn() }));

vi.mock("../api", () => ({ api: { groups } }));

describe("CommunityCheckPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-30T00:30:00+07:00"));
    groups.mockResolvedValue({
      ok: true,
      groups: [{ id: "g-1", name: "Community Hà Nội", type: 2 }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("mặc định chỉ chọn ngày hôm nay", async () => {
    render(<CommunityCheckPanel />);

    expect(screen.getByLabelText("Từ ngày")).toHaveValue("2026-08-30");
    expect(screen.getByLabelText("Đến ngày")).toHaveValue("2026-08-30");
    expect(await screen.findByRole("radio", { name: "Chọn Community Hà Nội" })).toBeVisible();
  });

  it("xóa kết quả cũ ngay khi lần quét mới thất bại", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        total: 1,
        range: "28/08–30/08",
        posts: [{ id: "post-1", ts: Date.now(), clean: "Tin cũ" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: "Không quét được" }), { status: 500 }));

    render(<CommunityCheckPanel />);
    fireEvent.click(await screen.findByRole("radio", { name: "Chọn Community Hà Nội" }));
    fireEvent.click(screen.getByRole("button", { name: "Quét" }));
    expect(await screen.findByText("Tin cũ")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Quét" }));

    await waitFor(() => expect(screen.getByText("Không quét được")).toBeVisible());
    expect(screen.queryByText("Tin cũ")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
