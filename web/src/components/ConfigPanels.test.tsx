// AI: Codex
// WHY: Verify the explicit opt-in survives saving and reloading without Zalo access.
// SPEC: docs/03_SPEC/SPEC-003.md
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AreasPanel, SourceGroupsPanel } from "./ConfigPanels";
import type { AppConfig, GroupInfo } from "../types";

const apiMocks = vi.hoisted(() => ({
  groups: vi.fn().mockResolvedValue({ groups: [] }),
  readCachedGroups: vi.fn((): GroupInfo[] => []),
}));
vi.mock("../api", () => ({ api: { groups: apiMocks.groups }, readCachedGroups: apiMocks.readCachedGroups }));
afterEach(cleanup);

const config: AppConfig = {
  areas: [{ id: "aggregate", keywords: ["ha dong"], groupLink: "", priceCondition: { operator: "<", value: 4 } }],
  sourceGroups: [],
  mode: "manual", deleteLines: [], excludeKeywords: [],
  filter: { removePercentLines: false, removePriceLines: false },
  priceRange: null, defaultArea: null,
  forward: { windowMs: 3000, maxBatchItems: 10, maxWaitMs: 120000, sendDelayMs: 0, retries: 1, historyGapMs: 120000 },
};

it("saves catch-all without keyword/price rules and restores the mode", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const view = render(<AreasPanel config={config} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText("Chế độ nhận bài"), { target: { value: "all" } });
  expect(screen.getByLabelText("Từ khoá")).toBeDisabled();
  expect(screen.getByLabelText("So sánh giá")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Lưu khu vực/ }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0][0];
  expect(saved.areas[0]).toMatchObject({ id: "aggregate", matchAll: true, keywords: [] });
  expect(saved.areas[0].priceCondition).toBeUndefined();
  view.rerender(<AreasPanel config={saved} onSave={onSave} />);
  expect(screen.getByLabelText("Chế độ nhận bài")).toHaveValue("all");
  fireEvent.change(screen.getByLabelText("Chế độ nhận bài"), { target: { value: "keywords" } });
  expect(screen.getByLabelText("Từ khoá")).toBeEnabled();
});

it("keeps existing empty-keyword destinations in keyword mode", () => {
  render(<AreasPanel config={{ ...config, areas: [{ id: "empty", groupLink: "", keywords: [] }] }} onSave={vi.fn()} />);
  expect(screen.getByLabelText("Chế độ nhận bài")).toHaveValue("keywords");
});

it("hiển thị thumbnail nhóm nguồn và đích từ cache ngay lúc mở trang", () => {
  apiMocks.readCachedGroups.mockReturnValue([
    { id: "source-1", name: "Nhóm nguồn", avatar: "https://example.test/source.jpg" },
    { id: "destination-1", name: "Nhóm đích", avatar: "https://example.test/destination.jpg" },
  ]);
  const cachedConfig = {
    ...config,
    sourceGroups: ["source-1"],
    areas: [{ id: "destination-1", keywords: ["cau giay"], groupLink: "" }],
  };

  render(<><SourceGroupsPanel config={cachedConfig} onSave={vi.fn()} /><AreasPanel config={cachedConfig} onSave={vi.fn()} /></>);

  expect(screen.getByRole("img", { name: "Nhóm nguồn" })).toHaveAttribute("src", "https://example.test/source.jpg");
  expect(screen.getByRole("img", { name: "Nhóm đích" })).toHaveAttribute("src", "https://example.test/destination.jpg");
  apiMocks.readCachedGroups.mockReturnValue([]);
});

it("lưu liên hệ quản lý theo từng nhóm nguồn", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<SourceGroupsPanel config={{ ...config, sourceGroups: ["source-1"] }} onSave={onSave} />);

  fireEvent.click(screen.getByRole("button", { name: "Liên hệ source-1" }));
  fireEvent.change(screen.getByLabelText("Admin"), { target: { value: "Mai — 0901" } });
  fireEvent.change(screen.getByLabelText("Phó nhóm"), { target: { value: "Nam — Zalo" } });
  fireEvent.change(screen.getByLabelText("Nhóm hỗ trợ"), { target: { value: "https://zalo.me/g/help" } });
  fireEvent.click(screen.getByRole("button", { name: /Lưu liên hệ$/ }));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    sourceGroupContacts: {
      "source-1": { admins: "Mai — 0901", deputies: "Nam — Zalo", supportGroup: "https://zalo.me/g/help", note: "" },
    },
  })));
});

it("ẩn nhóm đã cấu hình nguồn hoặc đích khỏi cả hai danh sách chọn", async () => {
  apiMocks.groups.mockResolvedValue({
    groups: [
      { id: "source-1", name: "Nhóm nguồn" },
      { id: "destination-1", name: "Nhóm đích" },
      { id: "available-1", name: "Nhóm còn trống" },
    ],
  });
  const configured = {
    ...config,
    sourceGroups: ["source-1"],
    areas: [{ id: "destination-1", keywords: ["cau giay"], groupLink: "" }],
  };

  render(<><SourceGroupsPanel config={configured} onSave={vi.fn()} /><AreasPanel config={configured} onSave={vi.fn()} /></>);
  const panels = screen.getAllByRole("heading", { name: /Nhóm nguồn|Khu vực → nhóm đích/ }).map((heading) => heading.closest(".panel") as HTMLElement | null);
  const sourcePanel = panels[0];
  const destinationPanel = panels[1];
  if (!sourcePanel || !destinationPanel) throw new Error("Không tìm thấy panel cấu hình nhóm");

  fireEvent.click(within(sourcePanel).getByRole("button", { name: /Thêm từ danh sách đã quét/ }));
  fireEvent.click(within(destinationPanel).getByRole("button", { name: /Thêm từ danh sách nhóm đã quét/ }));

  const sourcePicker = await within(sourcePanel).findByRole("region", { name: "Danh sách nhóm chưa được cấu hình" });
  const destinationPicker = await within(destinationPanel).findByRole("region", { name: "Danh sách nhóm chưa được cấu hình" });
  expect(within(sourcePicker).getByText("Nhóm còn trống")).toBeInTheDocument();
  expect(within(destinationPicker).getByText("Nhóm còn trống")).toBeInTheDocument();
  expect(within(sourcePicker).queryByText("Nhóm nguồn")).not.toBeInTheDocument();
  expect(within(sourcePicker).queryByText("Nhóm đích")).not.toBeInTheDocument();
  expect(within(destinationPicker).queryByText("Nhóm nguồn")).not.toBeInTheDocument();
  expect(within(destinationPicker).queryByText("Nhóm đích")).not.toBeInTheDocument();
});
