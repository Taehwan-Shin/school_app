import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCallUsersUpdate = vi.fn();

vi.mock("../src/api/usersUpdate.js", () => ({
  callUsersUpdate: (data: unknown) => mockCallUsersUpdate(data),
}));

import { BulkSuspendDialog } from "../src/routes/admin/BulkSuspendDialog.js";

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

describe("BulkSuspendDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires typing exact number of target accounts to enable confirm button", () => {
    const emails = ["user1@cam.hs.kr", "user2@cam.hs.kr", "user3@cam.hs.kr"];
    renderWithClient(
      <BulkSuspendDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );

    const confirmBtn = screen.getByTestId("bulk-suspend-confirm-btn") as HTMLButtonElement;
    const confirmInput = screen.getByTestId("bulk-suspend-confirm-input") as HTMLInputElement;

    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: "2" } });
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: "3" } });
    expect(confirmBtn.disabled).toBe(false);
  });

  it("iterates callUsersUpdate for all accounts and transitions to done phase with summary on success", async () => {
    const emails = ["user1@cam.hs.kr", "user2@cam.hs.kr", "user3@cam.hs.kr"];
    mockCallUsersUpdate.mockResolvedValue({ primaryEmail: "test", updatedFields: ["suspended"] });
    const onDone = vi.fn();
    const onOpenChange = vi.fn();

    renderWithClient(
      <BulkSuspendDialog
        open={true}
        onOpenChange={onOpenChange}
        emails={emails}
        onDone={onDone}
      />
    );

    const confirmInput = screen.getByTestId("bulk-suspend-confirm-input");
    fireEvent.change(confirmInput, { target: { value: "3" } });

    const confirmBtn = screen.getByTestId("bulk-suspend-confirm-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId("bulk-suspend-done")).toBeDefined();
    });

    expect(mockCallUsersUpdate).toHaveBeenCalledTimes(3);
    expect(mockCallUsersUpdate).toHaveBeenNthCalledWith(1, {
      primaryEmail: "user1@cam.hs.kr",
      suspended: true,
    });
    expect(mockCallUsersUpdate).toHaveBeenNthCalledWith(2, {
      primaryEmail: "user2@cam.hs.kr",
      suspended: true,
    });
    expect(mockCallUsersUpdate).toHaveBeenNthCalledWith(3, {
      primaryEmail: "user3@cam.hs.kr",
      suspended: true,
    });

    const doneText = screen.getByTestId("bulk-suspend-done").textContent;
    expect(doneText).toContain("3명 성공");
    expect(screen.queryByTestId("bulk-suspend-failures")).toBeNull();

    const okBtn = screen.getByRole("button", { name: "확인" });
    fireEvent.click(okBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalled();
  });

  it("handles failures and lists each failed email with raw error message in done phase", async () => {
    const emails = ["user1@cam.hs.kr", "user2@cam.hs.kr", "user3@cam.hs.kr"];
    mockCallUsersUpdate
      .mockResolvedValueOnce({ primaryEmail: "user1@cam.hs.kr", updatedFields: ["suspended"] })
      .mockRejectedValueOnce(new Error("admin_cannot_edit_admin"))
      .mockResolvedValueOnce({ primaryEmail: "user3@cam.hs.kr", updatedFields: ["suspended"] });

    renderWithClient(
      <BulkSuspendDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );

    const confirmInput = screen.getByTestId("bulk-suspend-confirm-input");
    fireEvent.change(confirmInput, { target: { value: "3" } });

    const confirmBtn = screen.getByTestId("bulk-suspend-confirm-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId("bulk-suspend-done")).toBeDefined();
    });

    expect(mockCallUsersUpdate).toHaveBeenCalledTimes(3);
    const doneText = screen.getByTestId("bulk-suspend-done").textContent;
    expect(doneText).toContain("2명 성공");
    expect(doneText).toContain("1명 실패");

    const failuresEl = screen.getByTestId("bulk-suspend-failures");
    expect(failuresEl.textContent).toContain("user2@cam.hs.kr");
    expect(failuresEl.textContent).toContain("admin_cannot_edit_admin");
  });
});
