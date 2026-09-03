import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCallUsersUpdate = vi.fn();

vi.mock("../src/api/usersUpdate.js", () => ({
  callUsersUpdate: (data: unknown) => mockCallUsersUpdate(data),
}));

import { BulkMoveOuDialog } from "../src/routes/admin/BulkMoveOuDialog.js";

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

describe("BulkMoveOuDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires typing target OU path to enable confirm button", () => {
    const emails = ["user1@cam.hs.kr", "user2@cam.hs.kr"];
    renderWithClient(
      <BulkMoveOuDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );

    const confirmBtn = screen.getByTestId("bulk-move-ou-confirm-btn") as HTMLButtonElement;
    const input = screen.getByTestId("bulk-move-ou-input") as HTMLInputElement;

    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "   " } });
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "/graduated/2026" } });
    expect(confirmBtn.disabled).toBe(false);
  });

  it("iterates callUsersUpdate for all accounts with target OU and transitions to done phase with summary on success", async () => {
    const emails = ["user1@cam.hs.kr", "user2@cam.hs.kr"];
    mockCallUsersUpdate.mockResolvedValue({
      primaryEmail: "test",
      updatedFields: ["orgUnitPath"],
    });
    const onDone = vi.fn();
    const onOpenChange = vi.fn();

    renderWithClient(
      <BulkMoveOuDialog
        open={true}
        onOpenChange={onOpenChange}
        emails={emails}
        onDone={onDone}
      />
    );

    const input = screen.getByTestId("bulk-move-ou-input");
    fireEvent.change(input, { target: { value: "/graduated/2026" } });

    const confirmBtn = screen.getByTestId("bulk-move-ou-confirm-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId("bulk-move-ou-done")).toBeDefined();
    });

    expect(mockCallUsersUpdate).toHaveBeenCalledTimes(2);
    expect(mockCallUsersUpdate).toHaveBeenNthCalledWith(1, {
      primaryEmail: "user1@cam.hs.kr",
      orgUnitPath: "/graduated/2026",
    });
    expect(mockCallUsersUpdate).toHaveBeenNthCalledWith(2, {
      primaryEmail: "user2@cam.hs.kr",
      orgUnitPath: "/graduated/2026",
    });

    const doneText = screen.getByTestId("bulk-move-ou-done").textContent;
    expect(doneText).toContain("2명 성공");
    expect(screen.queryByTestId("bulk-move-ou-failures")).toBeNull();

    const okBtn = screen.getByRole("button", { name: "확인" });
    fireEvent.click(okBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalled();
  });

  it("handles failures and lists each failed email with raw error message in done phase", async () => {
    const emails = ["user1@cam.hs.kr", "user2@cam.hs.kr"];
    mockCallUsersUpdate
      .mockResolvedValueOnce({ primaryEmail: "user1@cam.hs.kr", updatedFields: ["orgUnitPath"] })
      .mockRejectedValueOnce(new Error("org_unit_not_found"));

    renderWithClient(
      <BulkMoveOuDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );

    const input = screen.getByTestId("bulk-move-ou-input");
    fireEvent.change(input, { target: { value: "/graduated/2026" } });

    const confirmBtn = screen.getByTestId("bulk-move-ou-confirm-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId("bulk-move-ou-done")).toBeDefined();
    });

    expect(mockCallUsersUpdate).toHaveBeenCalledTimes(2);
    const doneText = screen.getByTestId("bulk-move-ou-done").textContent;
    expect(doneText).toContain("1명 성공");
    expect(doneText).toContain("1명 실패");

    const failuresEl = screen.getByTestId("bulk-move-ou-failures");
    expect(failuresEl.textContent).toContain("user2@cam.hs.kr");
    expect(failuresEl.textContent).toContain("org_unit_not_found");
  });
});
