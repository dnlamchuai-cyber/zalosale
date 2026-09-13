// Ai viết: Codex — khóa thứ tự luồng cấu hình và quét tin
// Tại sao: người dùng phải chọn nhóm nguồn trước khi thao tác quét
// Link: PLAN.md — yêu cầu UI ngày 2026-08-30

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const { configApi, statusApi, autoModeButton } = vi.hoisted(() => ({
  configApi: vi.fn(),
  statusApi: vi.fn(),
  autoModeButton: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    config: configApi,
    status: statusApi,
  },
}));
vi.mock("./components/StatusCards", () => ({ StatusCards: () => null }));
vi.mock("./components/ConfigPanels", () => ({
  SourceGroupsPanel: () => <h2>Nhóm nguồn</h2>,
  AreasPanel: () => null,
}));
vi.mock("./components/SettingsPanel", () => ({ SettingsPanel: () => null }));
vi.mock("./components/LogsSession", () => ({ LogsPanel: () => null, QrOverlay: () => null, SessionPanel: () => null }));
vi.mock("./components/ScanReview", () => ({ ScanReviewPanel: () => <h2>Quét & chọn tin để gửi</h2> }));
vi.mock("./components/CommunityCheckPanel", () => ({ CommunityCheckPanel: () => <h2>Check tin nhắn Community</h2> }));
vi.mock("./components/AutoModeButton", () => ({
  AutoModeButton: (props: unknown) => {
    autoModeButton(props);
    return null;
  },
}));
vi.mock("./features/sent-message-index/SentRoomSearch", () => ({
  SentRoomSearch: () => <h2>Kho tin đã gửi</h2>,
}));
vi.mock("./features/customer-search/MapSearchPanel", () => ({
  MapSearchPanel: () => <h2>Tìm trọ theo vùng bản đồ</h2>,
}));

beforeAll(() => {
  class EventSourceStub {
    onopen = null;
    onerror = null;
    addEventListener() {}
    close() {}
  }
  vi.stubGlobal("EventSource", EventSourceStub);
});

describe("App", () => {
  beforeEach(() => {
    configApi.mockReset().mockResolvedValue({
      config: { mode: "manual", sourceGroups: [], areas: [], deleteLines: [], excludeKeywords: [], filter: {}, ui: {}, forward: {} },
    });
    statusApi.mockReset().mockResolvedValue({ loggedIn: true });
    autoModeButton.mockReset();
  });

  it("hiển thị Nhóm nguồn trước màn Quét & chọn tin", async () => {
    render(<App />);

    const sources = await screen.findByRole("heading", { name: "Nhóm nguồn" });
    const scan = screen.getByRole("heading", { name: "Quét & chọn tin để gửi" });

    expect(sources.compareDocumentPosition(scan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Check tin nhắn Community" })).not.toBeInTheDocument();
  });

  it("đặt Kho tin đã gửi sau màn Quét & chọn tin", async () => {
    render(<App />);

    const scan = await screen.findByRole("heading", { name: "Quét & chọn tin để gửi" });
    const sentRooms = screen.getByRole("heading", { name: "Kho tin đã gửi" });

    expect(scan.compareDocumentPosition(sentRooms) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("báo backend chưa chạy và cho phép thử lại", async () => {
    configApi.mockRejectedValueOnce(new Error("HTTP 500")).mockResolvedValueOnce({
      config: { mode: "manual", sourceGroups: [], areas: [], deleteLines: [], excludeKeywords: [], filter: {}, ui: {}, forward: {} },
    });
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("backend");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    await waitFor(() => expect(configApi).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "Nhóm nguồn" })).toBeInTheDocument();
  });

  it("coi nhóm đích có ID là cấu hình hợp lệ để bật AUTO", async () => {
    configApi.mockResolvedValueOnce({
      config: {
        mode: "manual",
        sourceGroups: [],
        areas: [{ groupLink: "", id: "123456" }],
        deleteLines: [],
        excludeKeywords: [],
        filter: {},
        ui: {},
        forward: {},
      },
    });
    render(<App />);

    await screen.findByRole("heading", { name: "Nhóm nguồn" });

    const autoButtonProps = autoModeButton.mock.calls[autoModeButton.mock.calls.length - 1]?.[0] as { hasDestinations?: boolean };
    expect(autoButtonProps?.hasDestinations).toBe(true);
  });
});
