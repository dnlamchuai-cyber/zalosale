// Ai viết: Codex — khóa thứ tự luồng cấu hình và quét tin
// Tại sao: người dùng phải chọn nhóm nguồn trước khi thao tác quét
// Link: PLAN.md — yêu cầu UI ngày 2026-08-30

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./api", () => ({
  api: {
    config: vi.fn().mockResolvedValue({
      config: { mode: "manual", sourceGroups: [], areas: [], deleteLines: [], excludeKeywords: [], filter: {}, ui: {}, forward: {} },
    }),
    status: vi.fn().mockResolvedValue({ loggedIn: true }),
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
vi.mock("./components/AutoModeButton", () => ({ AutoModeButton: () => null }));

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
  it("hiển thị Nhóm nguồn trước màn Quét & chọn tin", async () => {
    render(<App />);

    const sources = await screen.findByRole("heading", { name: "Nhóm nguồn" });
    const scan = screen.getByRole("heading", { name: "Quét & chọn tin để gửi" });

    expect(sources.compareDocumentPosition(scan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Check tin nhắn Community" })).not.toBeInTheDocument();
  });
});
