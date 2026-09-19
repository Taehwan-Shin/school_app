import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCallUsersUpdateRole = vi.fn();

vi.mock("../src/api/usersUpdateRole.js", () => ({
  callUsersUpdateRole: (data: unknown) => mockCallUsersUpdateRole(data),
}));

import { BulkUpdateRoleDialog } from "../src/routes/admin/BulkUpdateRoleDialog.js";

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

describe("BulkUpdateRoleDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("기본 role = admin · admin/teacher radio 렌더", () => {
    renderWithClient(
      <BulkUpdateRoleDialog
        open={true}
        onOpenChange={vi.fn()}
        emails={["a@cam.hs.kr"]}
      />
    );
    const adminRadio = screen.getByTestId("bulk-update-role-target-admin") as HTMLInputElement;
    const teacherRadio = screen.getByTestId("bulk-update-role-target-teacher") as HTMLInputElement;
    expect(adminRadio.checked).toBe(true);
    expect(teacherRadio.checked).toBe(false);
  });

  it("확인 input 에 대상 개수 입력해야 confirm 버튼 enabled", () => {
    const emails = ["a@cam.hs.kr", "b@cam.hs.kr", "c@cam.hs.kr"];
    renderWithClient(
      <BulkUpdateRoleDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );
    const btn = screen.getByTestId("bulk-update-role-confirm-btn") as HTMLButtonElement;
    const input = screen.getByTestId("bulk-update-role-confirm-input");
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "2" } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "3" } });
    expect(btn.disabled).toBe(false);
  });

  it("실행 → 각 email 에 callUsersUpdateRole 순차 호출 · done 배너 성공 count", async () => {
    const emails = ["a@cam.hs.kr", "b@cam.hs.kr"];
    mockCallUsersUpdateRole.mockResolvedValue({
      primaryEmail: "x",
      uid: "u",
      role: "admin",
    });
    renderWithClient(
      <BulkUpdateRoleDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );
    fireEvent.change(screen.getByTestId("bulk-update-role-confirm-input"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("bulk-update-role-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("bulk-update-role-done")).toBeDefined();
    });
    expect(mockCallUsersUpdateRole).toHaveBeenCalledTimes(2);
    expect(mockCallUsersUpdateRole).toHaveBeenNthCalledWith(1, {
      primaryEmail: "a@cam.hs.kr",
      role: "admin",
    });
    expect(mockCallUsersUpdateRole).toHaveBeenNthCalledWith(2, {
      primaryEmail: "b@cam.hs.kr",
      role: "admin",
    });
    expect(screen.getByTestId("bulk-update-role-done").textContent).toContain("2");
  });

  it("teacher radio 선택 후 실행 → role=teacher 로 전송", async () => {
    const emails = ["a@cam.hs.kr"];
    mockCallUsersUpdateRole.mockResolvedValue({
      primaryEmail: "a",
      uid: "u",
      role: "teacher",
    });
    renderWithClient(
      <BulkUpdateRoleDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );
    fireEvent.click(screen.getByTestId("bulk-update-role-target-teacher"));
    fireEvent.change(screen.getByTestId("bulk-update-role-confirm-input"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByTestId("bulk-update-role-confirm-btn"));

    await waitFor(() => {
      expect(mockCallUsersUpdateRole).toHaveBeenCalledWith({
        primaryEmail: "a@cam.hs.kr",
        role: "teacher",
      });
    });
  });

  it("부분 실패 → done 배너에 실패 목록", async () => {
    const emails = ["a@cam.hs.kr", "b@cam.hs.kr"];
    mockCallUsersUpdateRole
      .mockResolvedValueOnce({ primaryEmail: "a", uid: "u1", role: "admin" })
      .mockRejectedValueOnce(new Error("permission-denied"));
    renderWithClient(
      <BulkUpdateRoleDialog open={true} onOpenChange={vi.fn()} emails={emails} />
    );
    fireEvent.change(screen.getByTestId("bulk-update-role-confirm-input"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("bulk-update-role-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("bulk-update-role-done")).toBeDefined();
    });
    const failures = screen.getByTestId("bulk-update-role-failures");
    expect(failures.textContent).toContain("b@cam.hs.kr");
    expect(failures.textContent).toContain("permission-denied");
  });

  it("F99: confirm 후 부모 emails 변경돼도 snapshot 대로 처리", async () => {
    const initialEmails = ["a@cam.hs.kr", "b@cam.hs.kr"];
    mockCallUsersUpdateRole.mockImplementation(() =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ primaryEmail: "x", uid: "u", role: "admin" }), 10),
      ),
    );
    const { rerender } = renderWithClient(
      <BulkUpdateRoleDialog open={true} onOpenChange={vi.fn()} emails={initialEmails} />
    );
    fireEvent.change(screen.getByTestId("bulk-update-role-confirm-input"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("bulk-update-role-confirm-btn"));

    // 실행 중 부모가 emails 를 변경.
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkUpdateRoleDialog
            open={true}
            onOpenChange={vi.fn()}
            emails={["c@cam.hs.kr"]}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("bulk-update-role-done")).toBeDefined();
    });
    // snapshot 기준 a, b 두 개만 호출 (변경된 c 는 무관).
    expect(mockCallUsersUpdateRole).toHaveBeenCalledTimes(2);
    const args = mockCallUsersUpdateRole.mock.calls.map((c) => c[0].primaryEmail);
    expect(args.sort()).toEqual(["a@cam.hs.kr", "b@cam.hs.kr"]);
  });
});
