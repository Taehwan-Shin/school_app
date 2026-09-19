import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCallGroupsDelete = vi.fn();

vi.mock("../src/api/groupsDelete.js", () => ({
  callGroupsDelete: (data: unknown) => mockCallGroupsDelete(data),
}));

import { BulkDeleteGroupDialog } from "../src/routes/admin/BulkDeleteGroupDialog.js";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("BulkDeleteGroupDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const emails = ["g1@cam.hs.kr", "g2@cam.hs.kr", "g3@cam.hs.kr"];

  it("확인 개수 안 맞으면 실행 버튼 disabled", () => {
    renderWithClient(
      <BulkDeleteGroupDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );
    const btn = screen.getByTestId("bulk-delete-group-confirm-btn") as HTMLButtonElement;
    const input = screen.getByTestId("bulk-delete-group-confirm-input");
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "2" } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "3" } });
    expect(btn.disabled).toBe(false);
  });

  it("정상 실행 → 각 email 순차 호출 · done 배너 성공 count", async () => {
    mockCallGroupsDelete.mockResolvedValue({ email: "x", deleted: true });
    renderWithClient(
      <BulkDeleteGroupDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );
    fireEvent.change(screen.getByTestId("bulk-delete-group-confirm-input"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByTestId("bulk-delete-group-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("bulk-delete-group-done")).toBeDefined();
    });
    expect(mockCallGroupsDelete).toHaveBeenCalledTimes(3);
    expect(mockCallGroupsDelete).toHaveBeenNthCalledWith(1, { email: "g1@cam.hs.kr" });
    expect(mockCallGroupsDelete).toHaveBeenNthCalledWith(2, { email: "g2@cam.hs.kr" });
    expect(mockCallGroupsDelete).toHaveBeenNthCalledWith(3, { email: "g3@cam.hs.kr" });
    expect(screen.getByTestId("bulk-delete-group-done").textContent).toContain("3");
  });

  it("부분 실패 → done 배너에 실패 목록", async () => {
    mockCallGroupsDelete
      .mockResolvedValueOnce({ email: "g1@cam.hs.kr", deleted: true })
      .mockRejectedValueOnce(new Error("permission-denied"))
      .mockResolvedValueOnce({ email: "g3@cam.hs.kr", deleted: true });
    renderWithClient(
      <BulkDeleteGroupDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );
    fireEvent.change(screen.getByTestId("bulk-delete-group-confirm-input"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByTestId("bulk-delete-group-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("bulk-delete-group-done")).toBeDefined();
    });
    const failures = screen.getByTestId("bulk-delete-group-failures");
    expect(failures.textContent).toContain("g2@cam.hs.kr");
    expect(failures.textContent).toContain("permission-denied");
  });

  it("F99: confirm 후 부모 emails 변경돼도 snapshot 대로 처리", async () => {
    mockCallGroupsDelete.mockImplementation(() =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ email: "x", deleted: true }), 10),
      ),
    );
    const { rerender } = renderWithClient(
      <BulkDeleteGroupDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );
    fireEvent.change(screen.getByTestId("bulk-delete-group-confirm-input"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByTestId("bulk-delete-group-confirm-btn"));

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkDeleteGroupDialog
            open={true}
            onOpenChange={vi.fn()}
            emails={["z@cam.hs.kr"]}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("bulk-delete-group-done")).toBeDefined();
    });
    expect(mockCallGroupsDelete).toHaveBeenCalledTimes(3);
    const args = mockCallGroupsDelete.mock.calls.map((c) => c[0].email);
    expect(args.sort()).toEqual(["g1@cam.hs.kr", "g2@cam.hs.kr", "g3@cam.hs.kr"]);
  });

  it("F100: confirm input label htmlFor 프로그램 연결", () => {
    renderWithClient(
      <BulkDeleteGroupDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );
    const input = screen.getByTestId("bulk-delete-group-confirm-input") as HTMLInputElement;
    expect(input.id).toBe("bulk-delete-group-confirm-input");
  });
});
