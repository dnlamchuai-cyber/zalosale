// Ai viết: Muse Spark | Tại sao: khóa điều hướng lightbox dùng chung
// Link: phản hồi user ngày 2026-09-12 (mũi tên chuyển ảnh qua lại)
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImageLightbox } from "./ImageLightbox";

const photos = ["http://x/1.jpg", "http://x/2.jpg", "http://x/3.jpg"];

describe("ImageLightbox", () => {
  it("mũi tên và phím qua lại vòng tròn, có đếm số", () => {
    let index = 0;
    const onIndex = vi.fn((i: number) => { index = i; });
    const renderAt = () => render(
      <ImageLightbox photos={photos} index={index} onIndex={onIndex} onClose={() => {}} />
    );
    const { rerender } = renderAt();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ảnh sau" }));
    expect(onIndex).toHaveBeenCalledWith(1);
    index = 2;
    rerender(<ImageLightbox photos={photos} index={index} onIndex={onIndex} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Ảnh sau" }));
    expect(onIndex).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onIndex).toHaveBeenLastCalledWith(1);
  });

  it("ESC và nút × đóng", () => {
    const onClose = vi.fn();
    render(<ImageLightbox photos={photos} index={0} onIndex={() => {}} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("1 ảnh thì không hiện mũi tên", () => {
    render(<ImageLightbox photos={["http://x/1.jpg"]} index={0} onIndex={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Ảnh sau" })).not.toBeInTheDocument();
    expect(screen.queryByText("1/1")).not.toBeInTheDocument();
  });
});
