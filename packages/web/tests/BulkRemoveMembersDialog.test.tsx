import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCallGroupsMembersDelete = vi.fn();

vi.mock("../src/api/groupsMembersDelete.js", () => ({
  callGroupsMembersDelete: (data: unknown) => mockCallGroupsMembersDelete(data),
}));

import { BulkRemoveMembersDialog } from "../src/routes/admin/BulkRemoveMembersDialog.js";

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

describe("BulkRemoveMembersDialog component", () => {
  const groupEmail = "all-students@cam.hs.kr";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires typing exact confirmation phrase '제거 {count}' to enable confirm button", () => {
    const memberEmails = ["user1@cam.hs.kr", "user2@cam.hs.kr", "user3@cam.hs.kr"];
    renderWithClient(
      <BulkRemoveMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        memberEmails={memberEmails}
      />
    );

    const confirmBtn = screen.getByTestId("bulk-remove-confirm-btn") as HTMLButtonElement;
    const confirmInput = screen.getByTestId("bulk-remove-confirm-input") as HTMLInputElement;

    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: "3" } });
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: "제거 2" } });
    expect(confirmBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: "제거 3" } });
    expect(confirmBtn.disabled).toBe(false);
  });

  it("iterates callGroupsMembersDelete for all members and transitions to done phase with summary on success", async () => {
    const memberEmails = ["user1@cam.hs.kr", "user2@cam.hs.kr", "user3@cam.hs.kr"];
    mockCallGroupsMembersDelete.mockResolvedValue({
      groupEmail,
      memberEmail: "test",
      deleted: true,
    });
    const onDone = vi.fn();
    const onOpenChange = vi.fn();

    renderWithClient(
      <BulkRemoveMembersDialog
        open={true}
        onOpenChange={onOpenChange}
        groupEmail={groupEmail}
        memberEmails={memberEmails}
        onDone={onDone}
      />
    );

    const confirmInput = screen.getByTestId("bulk-remove-confirm-input");
    fireEvent.change(confirmInput, { target: { value: "제거 3" } });

    const confirmBtn = screen.getByTestId("bulk-remove-confirm-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId("bulk-remove-done")).toBeDefined();
    });

    expect(mockCallGroupsMembersDelete).toHaveBeenCalledTimes(3);
    expect(mockCallGroupsMembersDelete).toHaveBeenNthCalledWith(1, {
      groupEmail,
      memberEmail: "user1@cam.hs.kr",
    });
    expect(mockCallGroupsMembersDelete).toHaveBeenNthCalledWith(2, {
      groupEmail,
      memberEmail: "user2@cam.hs.kr",
    });
    expect(mockCallGroupsMembersDelete).toHaveBeenNthCalledWith(3, {
      groupEmail,
      memberEmail: "user3@cam.hs.kr",
    });

    const doneText = screen.getByTestId("bulk-remove-done").textContent;
    expect(doneText).toContain("3명 성공");
    expect(screen.queryByTestId("bulk-remove-failures")).toBeNull();

    const okBtn = screen.getByRole("button", { name: "확인" });
    fireEvent.click(okBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalled();
  });

  it("handles failures and lists each failed email with raw error message in done phase", async () => {
    const memberEmails = ["user1@cam.hs.kr", "user2@cam.hs.kr", "user3@cam.hs.kr"];
    mockCallGroupsMembersDelete
      .mockResolvedValueOnce({ groupEmail, memberEmail: "user1@cam.hs.kr", deleted: true })
      .mockRejectedValueOnce(new Error("member_not_found"))
      .mockResolvedValueOnce({ groupEmail, memberEmail: "user3@cam.hs.kr", deleted: true });

    renderWithClient(
      <BulkRemoveMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        memberEmails={memberEmails}
      />
    );

    const confirmInput = screen.getByTestId("bulk-remove-confirm-input");
    fireEvent.change(confirmInput, { target: { value: "제거 3" } });

    const confirmBtn = screen.getByTestId("bulk-remove-confirm-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId("bulk-remove-done")).toBeDefined();
    });

    expect(mockCallGroupsMembersDelete).toHaveBeenCalledTimes(3);
    const doneText = screen.getByTestId("bulk-remove-done").textContent;
    expect(doneText).toContain("2명 성공");
    expect(doneText).toContain("1명 실패");

    const failuresEl = screen.getByTestId("bulk-remove-failures");
    expect(failuresEl.textContent).toContain("user2@cam.hs.kr");
    expect(failuresEl.textContent).toContain("member_not_found");
  });

  it("calls onDone when dialog is closed via X button or Escape in done phase", async () => {
    const memberEmails = ["user1@cam.hs.kr"];
    mockCallGroupsMembersDelete.mockResolvedValue({
      groupEmail,
      memberEmail: "user1@cam.hs.kr",
      deleted: true,
    });
    const onDone = vi.fn();
    const onOpenChange = vi.fn();

    renderWithClient(
      <BulkRemoveMembersDialog
        open={true}
        onOpenChange={onOpenChange}
        groupEmail={groupEmail}
        memberEmails={memberEmails}
        onDone={onDone}
      />
    );

    const confirmInput = screen.getByTestId("bulk-remove-confirm-input");
    fireEvent.change(confirmInput, { target: { value: "제거 1" } });
    fireEvent.click(screen.getByTestId("bulk-remove-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("bulk-remove-done")).toBeDefined();
    });

    const closeBtn = screen.getByRole("button", { name: "닫기" });
    fireEvent.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // v0.131 (== v0.124 F99 대칭): confirm 시점의 memberEmails snapshot 확정.
  it("v0.131 F99: confirm 시 memberEmails snapshot 확정 · 실행 중 prop 변경 무시", async () => {
    const initial = ["m1@cam.hs.kr", "m2@cam.hs.kr"];
    let resolveFirst: ((v: any) => void) | null = null;
    mockCallGroupsMembersDelete.mockImplementationOnce(
      () => new Promise((res) => { resolveFirst = res; }),
    );
    mockCallGroupsMembersDelete.mockResolvedValue({ deleted: true });

    const onOpenChange = vi.fn();
    const { rerender } = renderWithClient(
      <BulkRemoveMembersDialog
        open={true}
        onOpenChange={onOpenChange}
        groupEmail={groupEmail}
        memberEmails={initial}
      />
    );
    fireEvent.change(screen.getByTestId("bulk-remove-confirm-input"), {
      target: { value: "제거 2" },
    });
    fireEvent.click(screen.getByTestId("bulk-remove-confirm-btn"));

    // 첫 API 호출 pending 중 부모가 memberEmails 를 바꿔 rerender.
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <BulkRemoveMembersDialog
            open={true}
            onOpenChange={onOpenChange}
            groupEmail={groupEmail}
            memberEmails={["completely-different@cam.hs.kr"]}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByTestId("bulk-remove-running").textContent).toContain("2");

    resolveFirst!({ deleted: true });

    await waitFor(() => {
      expect(screen.getByTestId("bulk-remove-done")).toBeDefined();
    });
    expect(mockCallGroupsMembersDelete).toHaveBeenCalledTimes(2);
    expect(mockCallGroupsMembersDelete).toHaveBeenNthCalledWith(1, {
      groupEmail,
      memberEmail: "m1@cam.hs.kr",
    });
    expect(mockCallGroupsMembersDelete).toHaveBeenNthCalledWith(2, {
      groupEmail,
      memberEmail: "m2@cam.hs.kr",
    });
    expect(screen.getByTestId("bulk-remove-done").textContent).toContain("2명 성공");
  });

  // v0.131 (== v0.124 F100 대칭): label htmlFor 로 프로그램적 연결.
  it("v0.131 F100: confirm input 은 label htmlFor 로 프로그램적 연결", () => {
    renderWithClient(
      <BulkRemoveMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        memberEmails={["m@cam.hs.kr"]}
      />
    );
    const input = screen.getByLabelText(/실행하려면 아래 문구/);
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).id).toBe("bulk-remove-confirm-input");
  });
});

