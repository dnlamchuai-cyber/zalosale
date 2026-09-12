// Ai viết: Codex — kiểm chứng UI kho tin đã gửi
// Tại sao: test hành vi người dùng thay vì chi tiết implementation
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SentRoomSearch } from "./SentRoomSearch";

const { sentRooms, clearSentRooms } = vi.hoisted(() => ({ sentRooms: vi.fn(), clearSentRooms: vi.fn() }));
vi.mock("../../api", () => ({ api: { sentRooms, clearSentRooms } }));

describe("SentRoomSearch", () => {
  beforeEach(() => {
    sentRooms.mockReset();
    clearSentRooms.mockReset().mockResolvedValue({ ok: true, clearedRooms: 9 });
    sentRooms.mockResolvedValue({
      ok: true,
      rooms: Array.from({ length: 9 }, (_, index) => ({
        id: `room-${index + 1}`,
        roomCode: index === 0 ? "R151" : `R${index + 151}`,
        latestContent: index === 0 ? "18A Trung Kính - Cầu Giấy" : `Phòng ${index + 1}`,
        status: index === 8 ? "rented" : "unknown",
        sourceGroups: [{ id: "source-a", name: "Kho Cầu Giấy" }],
        destinations: [{ id: index === 8 ? "dest-c" : "dest-b", name: index === 8 ? "Khách Ba Đình" : "Khách Cầu Giấy", sentCount: 2, lastSentAt: 1_788_067_200_000 }],
        sentCount: 2,
        lastSentAt: 1_788_067_200_000,
      })),
    });
  });

  it("tìm và hiển thị phòng cùng nguồn, đích", async () => {
    render(<SentRoomSearch />);
    await screen.findByText("R151");

    fireEvent.change(screen.getByLabelText("Tìm mã phòng hoặc địa chỉ"), {
      target: { value: "trung kinh" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));

    await waitFor(() => expect(sentRooms).toHaveBeenLastCalledWith("trung kinh", 100));
    expect(screen.getAllByText(/Kho Cầu Giấy/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Khách Cầu Giấy/).length).toBeGreaterThan(0);
  });

  it("hiển thị bảng, lọc theo trạng thái và phân trang", async () => {
    render(<SentRoomSearch />);

    await screen.findByText("R151");
    expect(screen.getByRole("table", { name: "Danh sách tin đã gửi" })).toBeInTheDocument();
    expect(screen.queryByText("R159")).not.toBeInTheDocument();
    expect(screen.getByText("Trang 1 / 2 · 9 tin")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sau/ }));
    expect(screen.getByText("R159")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Lọc trạng thái"), { target: { value: "rented" } });
    expect(screen.getByText("R159")).toBeInTheDocument();
    expect(screen.queryByText("R151")).not.toBeInTheDocument();
    expect(screen.getByText("Trang 1 / 1 · 1 tin")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Lọc nhóm đích"), { target: { value: "dest-c" } });
    expect(screen.getByText("Khách Ba Đình (2)")).toBeInTheDocument();
  });

  it("xóa kho local sau khi người dùng xác nhận", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<SentRoomSearch />);
    await screen.findByText("R151");

    fireEvent.click(screen.getByRole("button", { name: /Xóa kho local/ }));

    await waitFor(() => expect(clearSentRooms).toHaveBeenCalledOnce());
    expect(screen.getByText(/Chưa có tin phù hợp/)).toBeInTheDocument();
  });
});
