// Ai viết: Codex — UI review slice
// Tại sao: ngăn bật AUTO khi thiếu nhóm đích hoặc khi người dùng chưa xác nhận
// Link: docs/05_TASKS/TASK-004_KIEM-THU-TOAN-DIEN.md

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutoModeButton } from "./AutoModeButton";

describe("AutoModeButton", () => {
  it("khóa bật AUTO khi chưa có nhóm đích", () => {
    render(<AutoModeButton mode="manual" hasDestinations={false} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /cần nhóm đích/i })).toBeDisabled();
  });

  it("chỉ bật AUTO sau khi người dùng xác nhận", () => {
    const onChange = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<AutoModeButton mode="manual" hasDestinations onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Tự động: tắt/ }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Tự động: tắt/ }));
    expect(onChange).toHaveBeenCalledWith("auto");
  });

  it("cho phép tắt AUTO ngay không cần xác nhận", () => {
    const onChange = vi.fn();
    const confirm = vi.spyOn(window, "confirm");
    render(<AutoModeButton mode="auto" hasDestinations={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Treo máy: AUTO/ }));

    expect(confirm).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("manual");
  });
});
