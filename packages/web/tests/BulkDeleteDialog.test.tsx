import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCallUsersDelete = vi.fn();

vi.mock("../src/api/usersDelete.js", () => ({
  callUsersDelete: (data: unknown) => mockCallUsersDelete(data),
}));

import { BulkDeleteDialog } from "../src/routes/admin/BulkDeleteDialog.js";

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

describe("BulkDeleteDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires typing exact confirmation phrase '삭제 {count}' to enable confirm button", () => {
    const emails = ["user1@cam.hs.kr", "user2@cam.hs.kr", "user3@cam.hs.kr"];
    renderWithClient(
      <BulkDeleteDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );

    const confirmBtn = screen.getByTestId("bulk-delete-confirm-btn") as HTMLButtonElement;
    const confirmInput = screen.getByTestId("bulk-delete-confirm-input") as HTMLInputElement;

    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: "3" } });
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: "삭제 2" } });
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: "삭제 3" } });
    expect(confirmBtn.disabled).toBe(false);
  });

  it("iterates callUsersDelete for all accounts and transitions to done phase with summary on success", async () => {
    const emails = ["user1@cam.hs.kr", "user2@cam.hs.kr", "user3@cam.hs.kr"];
    mockCallUsersDelete.mockResolvedValue({ primaryEmail: "test", deleted: true });
    const onDone = vi.fn();
    const onOpenChange = vi.fn();

    renderWithClient(
      <BulkDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        emails={emails}
        onDone={onDone}
      />
    );

    const confirmInput = screen.getByTestId("bulk-delete-confirm-input");
    fireEvent.change(confirmInput, { target: { value: "삭제 3" } });

    const confirmBtn = screen.getByTestId("bulk-delete-confirm-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId("bulk-delete-done")).toBeDefined();
    });

    expect(mockCallUsersDelete).toHaveBeenCalledTimes(3);
    expect(mockCallUsersDelete).toHaveBeenNthCalledWith(1, {
      primaryEmail: "user1@cam.hs.kr",
    });
    expect(mockCallUsersDelete).toHaveBeenNthCalledWith(2, {
      primaryEmail: "user2@cam.hs.kr",
    });
    expect(mockCallUsersDelete).toHaveBeenNthCalledWith(3, {
      primaryEmail: "user3@cam.hs.kr",
    });

    const doneText = screen.getByTestId("bulk-delete-done").textContent;
    expect(doneText).toContain("3명 성공");
    expect(screen.queryByTestId("bulk-delete-failures")).toBeNull();

    const okBtn = screen.getByRole("button", { name: "확인" });
    fireEvent.click(okBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalled();
  });

  it("handles failures and lists each failed email with raw error message in done phase", async () => {
    const emails = ["user1@cam.hs.kr", "user2@cam.hs.kr", "user3@cam.hs.kr"];
    mockCallUsersDelete
      .mockResolvedValueOnce({ primaryEmail: "user1@cam.hs.kr", deleted: true })
      .mockRejectedValueOnce(new Error("admin_cannot_delete_admin"))
      .mockResolvedValueOnce({ primaryEmail: "user3@cam.hs.kr", deleted: true });

    renderWithClient(
      <BulkDeleteDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );

    const confirmInput = screen.getByTestId("bulk-delete-confirm-input");
    fireEvent.change(confirmInput, { target: { value: "삭제 3" } });

    const confirmBtn = screen.getByTestId("bulk-delete-confirm-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId("bulk-delete-done")).toBeDefined();
    });

    expect(mockCallUsersDelete).toHaveBeenCalledTimes(3);
    const doneText = screen.getByTestId("bulk-delete-done").textContent;
    expect(doneText).toContain("2명 성공");
    expect(doneText).toContain("1명 실패");

    const failuresEl = screen.getByTestId("bulk-delete-failures");
    expect(failuresEl.textContent).toContain("user2@cam.hs.kr");
    expect(failuresEl.textContent).toContain("admin_cannot_delete_admin");
  });
});
