import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CopyButton } from "../src/routes/admin/CopyButton";

describe("CopyButton component (v0.171)", () => {
  let originalClipboard: Clipboard | undefined;
  const mockWriteText = vi.fn();

  beforeEach(() => {
    mockWriteText.mockReset();
    originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockWriteText },
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    vi.useRealTimers();
  });

  it("기본 라벨 「복사」 · 클릭 시 clipboard.writeText 호출", async () => {
    mockWriteText.mockResolvedValue(undefined);
    render(<CopyButton value="course-abc-123" data-testid="cp" />);
    const btn = screen.getByTestId("cp");
    expect(btn.textContent).toBe("복사");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("course-abc-123");
    });
    expect(btn.textContent).toBe("복사됨 ✓");
  });

  it("성공 후 2초 지나면 라벨 원복", async () => {
    mockWriteText.mockResolvedValue(undefined);
    render(<CopyButton value="x" data-testid="cp" />);
    const btn = screen.getByTestId("cp");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.textContent).toBe("복사됨 ✓");
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(btn.textContent).toBe("복사");
  });

  it("커스텀 라벨 유지 (「URL 복사」)", () => {
    render(<CopyButton value="https://x.com" label="URL 복사" data-testid="cp" />);
    expect(screen.getByTestId("cp").textContent).toBe("URL 복사");
  });

  it("clipboard.writeText 실패 시 라벨 원복 상태 유지", async () => {
    mockWriteText.mockRejectedValue(new Error("denied"));
    render(<CopyButton value="x" data-testid="cp" />);
    const btn = screen.getByTestId("cp");
    fireEvent.click(btn);
    // Give async catch time to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(btn.textContent).toBe("복사");
  });

  it("aria-label 에 value 포함 (screen reader)", () => {
    render(<CopyButton value="target-value" data-testid="cp" />);
    const btn = screen.getByTestId("cp");
    expect(btn.getAttribute("aria-label")).toBe("복사: target-value");
  });
});
