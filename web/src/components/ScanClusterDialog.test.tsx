// Ai viết: Muse Spark | Tại sao: khóa xem ảnh lớn trong dialog cụm (trước đây img tĩnh, bấm không mở)
// Link: phản hồi user ngày 2026-09-12 (bấm ảnh trong cụm không xem được + mũi tên chuyển ảnh)
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScanClusterDialog } from "./ScanClusterDialog";

const items = [
  { text: "Mở cụm", photoUrls: [], ts: 1 },
  { text: "", photoUrls: ["http://x/a.jpg", "http://x/b.jpg"], ts: 2 },
  { text: "", photoUrls: ["http://x/c.jpg"], ts: 3 },
];

describe("ScanClusterDialog", () => {
  it("bấm ảnh trong cụm thì mở xem lớn, mũi tên chuyển qua lại được", () => {
    render(<ScanClusterDialog items={items} onClose={() => {}} />);
    expect(screen.queryByRole("dialog", { name: "Xem ảnh phòng" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem ảnh 1 của phần 2" }));
    expect(screen.getByRole("dialog", { name: "Xem ảnh phòng" })).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ảnh sau" }));
    expect(screen.getByText("2/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ảnh trước" }));
    expect(screen.getByText("1/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đóng ảnh" }));
    expect(screen.queryByRole("dialog", { name: "Xem ảnh phòng" })).not.toBeInTheDocument();
  });

  it("mở đúng ảnh đã bấm trong cả cụm", () => {
    render(<ScanClusterDialog items={items} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Xem ảnh 1 của phần 3" }));
    expect(screen.getByText("3/3")).toBeInTheDocument();
  });
});
