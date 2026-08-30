import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock("../src/api/usersDelete.js", () => ({
  useDeleteUser: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { DeleteUserDialog } from "../src/routes/admin/DeleteUserDialog.js";

describe("DeleteUserDialog component", () => {
  const targetUser = {
    email: "student@cam.hs.kr",
    firstName: "길동",
    lastName: "홍",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  it("renders target user info and disabled delete button initially", () => {
    render(<DeleteUserDialog open={true} onOpenChange={vi.fn()} user={targetUser} />);

    expect(screen.getByText("계정 삭제 확인")).toBeDefined();
    expect(screen.getAllByText("student@cam.hs.kr").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("홍길동")).toBeDefined();

    const deleteBtn = screen.getByTestId("delete-user-submit") as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);
  });

  it("enables delete button only when typed email matches target email exactly", () => {
    render(<DeleteUserDialog open={true} onOpenChange={vi.fn()} user={targetUser} />);

    const input = screen.getByLabelText(/삭제를 확인하려면/) as HTMLInputElement;
    const deleteBtn = screen.getByTestId("delete-user-submit") as HTMLButtonElement;

    fireEvent.change(input, { target: { value: "other@cam.hs.kr" } });
    expect(deleteBtn.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "student@cam.hs.kr" } });
    expect(deleteBtn.disabled).toBe(false);
  });

  it("submits delete request and closes dialog on success", async () => {
    mockMutateAsync.mockResolvedValueOnce({ primaryEmail: "student@cam.hs.kr", deleted: true });
    const onOpenChange = vi.fn();

    render(<DeleteUserDialog open={true} onOpenChange={onOpenChange} user={targetUser} />);

    const input = screen.getByLabelText(/삭제를 확인하려면/);
    fireEvent.change(input, { target: { value: "student@cam.hs.kr" } });

    const deleteBtn = screen.getByTestId("delete-user-submit");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ primaryEmail: "student@cam.hs.kr" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("displays server error message when self-delete fails", () => {
    mockError = new Error("cannot_delete_self");

    render(<DeleteUserDialog open={true} onOpenChange={vi.fn()} user={targetUser} />);

    expect(screen.getByTestId("delete-user-error")).toBeDefined();
    expect(screen.getByText("본인 계정은 삭제할 수 없습니다.")).toBeDefined();
  });

  it("displays server error message when admin tries to delete admin", () => {
    mockError = new Error("admin_cannot_delete_admin");

    render(<DeleteUserDialog open={true} onOpenChange={vi.fn()} user={targetUser} />);

    expect(screen.getByTestId("delete-user-error")).toBeDefined();
    expect(
      screen.getByText("관리자 계정을 삭제할 수 있는 권한이 없습니다 (super_admin 전용)."),
    ).toBeDefined();
  });
});
