// Ai viết: Codex
// Tại sao: kiểm chứng flow chọn địa chỉ/tâm, thêm nhiều vùng và phân nhóm phòng mà không gọi tile thật.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-011_MapSearchUi.md

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapSearchPanel } from "./MapSearchPanel";

const { mockApi } = vi.hoisted(() => ({ mockApi: {
  mapRoomsForZones: vi.fn(), resolveRoomLocation: vi.fn(), backfillRoomAddresses: vi.fn(), geocodeMap: vi.fn(),
} }));

vi.mock("../../api", () => ({ api: mockApi }));
vi.mock("./LeafletMap", () => ({ LeafletMap: ({ onPick }: { onPick: (point: { latitude: number; longitude: number }) => void }) => <button type="button" onClick={() => onPick({ latitude: 20.99, longitude: 105.79 })}>mock map click</button> }));

describe("MapSearchPanel", () => {
  beforeEach(() => {
    Object.values(mockApi).forEach((mock) => mock.mockReset());
    mockApi.mapRoomsForZones.mockResolvedValue({ requestId: null, zones: [], matchedRooms: [], unmatchedRooms: [], unlocatedRooms: [] });
    mockApi.resolveRoomLocation.mockResolvedValue({ location: { status: "located", latitude: 20.972, longitude: 105.778 } });
    mockApi.backfillRoomAddresses.mockResolvedValue({ updated: 0 });
    mockApi.geocodeMap.mockResolvedValue({ candidates: [{ latitude: 20.972, longitude: 105.778, displayName: "Ngõ 7", importance: 0.8 }] });
  });

  it("chọn kết quả địa chỉ rồi thêm zone với tâm đã chọn", async () => {
    render(<MapSearchPanel />);
    await screen.findByPlaceholderText("Ngõ 7 Nguyễn Thái Học");
    fireEvent.change(screen.getByPlaceholderText("Ngõ 7 Nguyễn Thái Học"), { target: { value: "Ngõ 7" } });
    fireEvent.click(screen.getByRole("button", { name: "Tìm" }));
    fireEvent.click(await screen.findByRole("button", { name: /Ngõ 7/ }));
    fireEvent.change(screen.getByPlaceholderText("Ga Hà Đông"), { target: { value: "Quanh Ga" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm vùng" }));
    await waitFor(() => expect(mockApi.mapRoomsForZones).toHaveBeenLastCalledWith([expect.objectContaining({ label: "Quanh Ga", center: { latitude: 20.972, longitude: 105.778 } })]));
  });

  it("bấm map thay đổi tâm và hiển thị trạng thái rỗng", async () => {
    render(<MapSearchPanel />);
    await screen.findByPlaceholderText("Ga Hà Đông");
    fireEvent.click(screen.getByRole("button", { name: "mock map click" }));
    fireEvent.change(screen.getByPlaceholderText("Ga Hà Đông"), { target: { value: "Tâm mới" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm vùng" }));
    await waitFor(() => expect(mockApi.mapRoomsForZones).toHaveBeenLastCalledWith([expect.objectContaining({ center: { latitude: 20.99, longitude: 105.79 } })]));
    expect(screen.getByText(/Phòng trong vùng \(0\)/)).toBeInTheDocument();
  });

  it("dùng nhanh ba cụm ưu tiên quanh Hà Đông", async () => {
    render(<MapSearchPanel />);
    await screen.findByRole("button", { name: /Dùng 3 cụm gợi ý/ });
    fireEvent.click(screen.getByRole("button", { name: /Dùng 3 cụm gợi ý/ }));
    await waitFor(() => expect(mockApi.mapRoomsForZones).toHaveBeenCalledTimes(2));
    const [presetZones] = mockApi.mapRoomsForZones.mock.calls[mockApi.mapRoomsForZones.mock.calls.length - 1];
    expect(presetZones).toHaveLength(3);
    expect(presetZones.map((zone: { label: string }) => zone.label)).toEqual([
      expect.stringContaining("Ga Hà Đông"),
      expect.stringContaining("Mỗ Lao"),
      expect.stringContaining("Phùng Khoang"),
    ]);
    expect(screen.getByText("Đã khoanh 3 cụm, ưu tiên từ gần đến xa")).toBeInTheDocument();
  });

  it("cho định vị từng tin chưa có tọa độ", async () => {
    mockApi.mapRoomsForZones.mockReset();
    mockApi.mapRoomsForZones
      .mockResolvedValueOnce({ requestId: null, zones: [], matchedRooms: [], unmatchedRooms: [], unlocatedRooms: [{ id: "room-1", roomCode: "P-001", address: "Ngõ 7 Nguyễn Thái Học", latestContent: "", status: "sent", locationStatus: "pending", latitude: null, longitude: null }] })
      .mockResolvedValueOnce({ requestId: null, zones: [], matchedRooms: [], unmatchedRooms: [], unlocatedRooms: [] });
    render(<MapSearchPanel />);
    await screen.findByRole("button", { name: "Định vị" });
    fireEvent.click(screen.getByRole("button", { name: "Định vị" }));
    await waitFor(() => expect(mockApi.resolveRoomLocation).toHaveBeenCalledWith("room-1", "Ngõ 7 Nguyễn Thái Học"));
    expect(await screen.findByText("Đã định vị P-001")).toBeInTheDocument();
  });

  it("cho nhập địa chỉ khi tin chưa có địa chỉ", async () => {
    mockApi.mapRoomsForZones.mockReset();
    mockApi.mapRoomsForZones.mockResolvedValue({ requestId: null, zones: [], matchedRooms: [], unmatchedRooms: [], unlocatedRooms: [{ id: "room-2", roomCode: "P-002", address: "", latestContent: "", status: "sent", locationStatus: "pending", latitude: null, longitude: null }] });
    render(<MapSearchPanel />);
    const addressInput = await screen.findByRole("textbox", { name: "Địa chỉ P-002" });
    fireEvent.change(addressInput, { target: { value: "Ga Hà Đông" } });
    fireEvent.click(screen.getByRole("button", { name: "Định vị" }));
    await waitFor(() => expect(mockApi.resolveRoomLocation).toHaveBeenCalledWith("room-2", "Ga Hà Đông"));
  });

  it("cho quét và định vị tuần tự tất cả tin có địa chỉ", async () => {
    mockApi.mapRoomsForZones.mockReset();
    mockApi.mapRoomsForZones
      .mockResolvedValueOnce({ requestId: null, zones: [], matchedRooms: [], unmatchedRooms: [], unlocatedRooms: [
        { id: "room-1", roomCode: "P-001", address: "Ngõ 7 Nguyễn Thái Học", latestContent: "", status: "sent", locationStatus: "pending", latitude: null, longitude: null },
        { id: "room-2", roomCode: "P-002", address: "Ga Hà Đông", latestContent: "", status: "sent", locationStatus: "pending", latitude: null, longitude: null },
      ] })
      .mockResolvedValueOnce({ requestId: null, zones: [], matchedRooms: [], unmatchedRooms: [], unlocatedRooms: [] });
    mockApi.resolveRoomLocation
      .mockResolvedValueOnce({ location: { status: "located", latitude: 20.97, longitude: 105.77 } })
      .mockResolvedValueOnce({ location: { status: "located", latitude: 20.98, longitude: 105.78 } });
    render(<MapSearchPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Quét tất cả/ }));
    await waitFor(() => expect(mockApi.resolveRoomLocation).toHaveBeenNthCalledWith(1, "room-1", "Ngõ 7 Nguyễn Thái Học", { selectFirst: true }));
    await waitFor(() => expect(mockApi.resolveRoomLocation).toHaveBeenNthCalledWith(2, "room-2", "Ga Hà Đông", { selectFirst: true }));
    expect(await screen.findByText(/Đã định vị 2\/2 tin/)).toBeInTheDocument();
  });
});
