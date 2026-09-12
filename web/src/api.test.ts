// Ai viết: Codex — kiểm tra cache danh sách nhóm trên trình duyệt
// Tại sao: tránh gọi lại Zalo mỗi khi người dùng mở trang chọn nhóm
// Link: yêu cầu tối ưu tải nhóm nguồn ngày 2026-09-05

import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

describe("api.groups", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("dùng danh sách nhóm đã lưu thay vì gọi mạng lại", async () => {
    localStorage.setItem("zalo-sale.groups-cache", JSON.stringify({ savedAt: Date.now(), groups: [{ id: "g1", name: "Nhóm cũ" }] }));
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(api.groups()).resolves.toEqual({ ok: true, groups: [{ id: "g1", name: "Nhóm cũ" }] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("giữ metadata nhóm qua các lần mở web, dù cache đã lưu từ lâu", async () => {
    localStorage.setItem("zalo-sale.groups-cache", JSON.stringify({
      savedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
      groups: [{ id: "source-1", name: "Nhóm nguồn đã lưu", avatar: "https://example.test/source.jpg" }],
    }));
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(api.groups()).resolves.toMatchObject({ groups: [{ id: "source-1", name: "Nhóm nguồn đã lưu" }] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bỏ dữ liệu cache không hợp lệ và không giữ định danh chủ nhóm", async () => {
    localStorage.setItem("zalo-sale.groups-cache", JSON.stringify({
      groups: [null, { id: "", name: "" }, { id: 42, name: "Nhóm hợp lệ", creatorId: "private-owner-id" }],
    }));

    await expect(api.groups()).resolves.toEqual({ ok: true, groups: [{ id: "42", name: "Nhóm hợp lệ" }] });
  });

  it("gộp các lần tải nền cùng lúc thành một request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, groups: [{ id: "g1", name: "Nhóm mới" }] }), { status: 200 }),
    );

    await expect(Promise.all([api.groups(), api.groups()])).resolves.toEqual([
      { ok: true, groups: [{ id: "g1", name: "Nhóm mới" }] },
      { ok: true, groups: [{ id: "g1", name: "Nhóm mới" }] },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
