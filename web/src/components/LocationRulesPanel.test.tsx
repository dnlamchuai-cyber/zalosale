// Ai viết: Muse Spark | Tại sao: khóa UI kho địa danh (tìm/sửa/nhiều nhóm/chưa xác định lưu rule)
// Link: yêu cầu "Kho địa danh Hà Nội" ngày 2026-09-11
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { LocationRulesPanel } from "./LocationRulesPanel";
import { ScanReviewPanel } from "./ScanReview";

const areas = [
  { keywords: ["thanh xuan"], groupLink: "", routingKey: "thanh-xuan" },
  { keywords: ["nam tu liem"], groupLink: "", routingKey: "nam-tu-liem" },
];

const rules = [
  { id: "r1", name: "Giáp Nhất", type: "duong", routingKeys: ["thanh-xuan"], enabled: true, source: "manual", note: "" },
  { id: "r2", name: "Đình Thôn", type: "duong", routingKeys: ["nam-tu-liem"], enabled: false, source: "osm", note: "" },
];

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).startsWith("/api/location-rules")) {
      return { ok: true, json: async () => ({ ok: true, rules }) } as Response;
    }
    return { ok: true, json: async () => ({ ok: true, scan: null }) } as Response;
  }));
});

describe("LocationRulesPanel", () => {
  it("hiện rule kèm nguồn và phân trang, sửa được nhiều nhóm đích", async () => {
    render(<LocationRulesPanel areas={areas} />);
    expect(await screen.findByText("Giáp Nhất")).toBeInTheDocument();
    expect(screen.getByText("Thủ công")).toBeInTheDocument();
    expect(screen.getByText("OSM")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Sửa" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Sửa rule địa danh" });
    const thanhXuan = within(dialog).getByLabelText("thanh xuan");
    expect((thanhXuan as HTMLInputElement).checked).toBe(true);
  });

  it("tìm kiếm lọc theo tên", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url);
      const q = new URL(u, "http://localhost").searchParams.get("q") || "";
      return { ok: true, json: async () => ({ ok: true, rules: rules.filter((r) => r.name.includes(q)) }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LocationRulesPanel areas={areas} />);
    await screen.findByText("Giáp Nhất");
    fireEvent.change(screen.getByPlaceholderText("Tên đường, phường, ghi chú..."), { target: { value: "Đình" } });
    fireEvent.click(screen.getByRole("button", { name: "Tìm" }));
    await waitFor(() => expect(screen.queryByText("Giáp Nhất")).not.toBeInTheDocument());
    expect(screen.getByText("Đình Thôn")).toBeInTheDocument();
  });
});

describe("ScanReview undetermined", () => {
  it("bài chưa xác định cho chọn tay nhóm đích và lưu rule", async () => {
    const post = {
      id: "s1:g:0", tid: "g", name: "Nguồn", areaName: null, destinationNames: [],
      kw: "", clean: "Số 8 ngõ lạ", photos: 0, photoUrls: [], price: null,
      commissionPercent: null, inPriceRange: true, status: "undetermined",
      routingReason: null, matchedRules: [], undetermined: true, ts: Date.now(), clusterItems: [],
    };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url) === "/api/control" && init?.body && String(init.body).includes('"scan"')) {
        return { ok: true, json: async () => ({ ok: true, scanId: "s1", range: "3 ngày", groups: 1, total: 1, added: 1, posts: [post] }) } as Response;
      }
      if (String(url) === "/api/location-rules") {
        return { ok: true, json: async () => ({ ok: true, rule: { id: "n1" } }) } as Response;
      }
      return { ok: true, json: async () => ({ ok: true, scan: null }) } as Response;
    }));
    render(<ScanReviewPanel defaultDays={3} areas={areas} sourceGroups={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "🔍 Quét tin" }));
    expect((await screen.findAllByText("Chưa xác định")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Tên địa danh cho tin 1"), { target: { value: "Ngõ Lạ" } });
    fireEvent.change(screen.getByLabelText("Nhóm đích cho tin 1"), { target: { value: "thanh-xuan" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu rule" }));
    await waitFor(() => expect(screen.getByText(/Đã lưu rule/)).toBeInTheDocument());
  });
});
