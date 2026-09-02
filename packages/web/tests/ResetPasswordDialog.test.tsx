import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock("../src/api/usersResetPassword.js", () => ({
  useResetPassword: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import {
  ResetPasswordDialog,
  type ResetPasswordTarget,
} from "../src/routes/admin/ResetPasswordDialog.js";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("ResetPasswordDialog component", () => {
  const targetUser: ResetPasswordTarget = {
    email: "student@cam.hs.kr",
    firstName: "길동",
    lastName: "홍",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  // 1. user=null -> 다이얼로그 안 열림
  it("does not render dialog when user is null", () => {
    renderWithRouter(
      <ResetPasswordDialog open={true} onOpenChange={vi.fn()} user={null} />
    );

    expect(screen.queryByText("비밀번호 재설정")).toBeNull();
    expect(screen.queryByTestId("reset-password-submit")).toBeNull();
  });

  // 2. 8 자 미만 -> 검증 배너
  it("shows validation error banner when password is shorter than 8 characters", () => {
    renderWithRouter(
      <ResetPasswordDialog open={true} onOpenChange={vi.fn()} user={targetUser} />
    );

    const newPassInput = screen.getByTestId("reset-password-new");
    const confirmPassInput = screen.getByTestId("reset-password-confirm");
    const submitBtn = screen.getByTestId("reset-password-submit");

    fireEvent.change(newPassInput, { target: { value: "short" } });
    fireEvent.change(confirmPassInput, { target: { value: "short" } });
    fireEvent.click(submitBtn);

    const errorBanner = screen.getByTestId("reset-password-error");
    expect(errorBanner).toBeDefined();
    expect(errorBanner.textContent).toContain("비밀번호는 최소 8자 이상이어야 합니다.");
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  // 3. 두 비밀번호 불일치 -> 검증 배너
  it("shows validation error banner when passwords do not match", () => {
    renderWithRouter(
      <ResetPasswordDialog open={true} onOpenChange={vi.fn()} user={targetUser} />
    );

    const newPassInput = screen.getByTestId("reset-password-new");
    const confirmPassInput = screen.getByTestId("reset-password-confirm");
    const submitBtn = screen.getByTestId("reset-password-submit");

    fireEvent.change(newPassInput, { target: { value: "password1234" } });
    fireEvent.change(confirmPassInput, { target: { value: "password9999" } });
    fireEvent.click(submitBtn);

    const errorBanner = screen.getByTestId("reset-password-error");
    expect(errorBanner).toBeDefined();
    expect(errorBanner.textContent).toContain("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  // 4. 성공 -> mutation 호출 검증 ({primaryEmail, newPassword, changePasswordAtNextLogin})
  it("calls mutation with correct parameters and closes dialog on success", async () => {
    const handleOpenChange = vi.fn();
    const handleSuccess = vi.fn();
    mockMutateAsync.mockResolvedValueOnce({
      primaryEmail: "student@cam.hs.kr",
      passwordReset: true,
    });

    renderWithRouter(
      <ResetPasswordDialog
        open={true}
        onOpenChange={handleOpenChange}
        user={targetUser}
        onSuccess={handleSuccess}
      />
    );

    const newPassInput = screen.getByTestId("reset-password-new");
    const confirmPassInput = screen.getByTestId("reset-password-confirm");
    const submitBtn = screen.getByTestId("reset-password-submit");

    fireEvent.change(newPassInput, { target: { value: "password1234" } });
    fireEvent.change(confirmPassInput, { target: { value: "password1234" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        primaryEmail: "student@cam.hs.kr",
        newPassword: "password1234",
        changePasswordAtNextLogin: true,
      });
      expect(handleOpenChange).toHaveBeenCalledWith(false);
      expect(handleSuccess).toHaveBeenCalled();
    });
  });

  // 5. 관리자 재설정 오류 매핑 및 기타 오류 매핑
  it("maps permission-denied and insufficient_scope errors appropriately", () => {
    mockError = new Error("admin_cannot_edit_admin (permission-denied)");
    const { rerender } = renderWithRouter(
      <ResetPasswordDialog open={true} onOpenChange={vi.fn()} user={targetUser} />
    );

    let errorBanner = screen.getByTestId("reset-password-error");
    expect(errorBanner.textContent).toBe("관리자 계정 비밀번호는 재설정할 수 없습니다.");

    // insufficient_scope
    mockError = new Error("insufficient_scope: missing required scope");
    rerender(
      <MemoryRouter>
        <ResetPasswordDialog open={true} onOpenChange={vi.fn()} user={targetUser} />
      </MemoryRouter>
    );
    errorBanner = screen.getByTestId("reset-password-error");
    expect(errorBanner.textContent).toBe("비밀번호 재설정 권한이 부족합니다. 다시 로그인하세요.");

    // other error
    mockError = new Error("internal server error");
    rerender(
      <MemoryRouter>
        <ResetPasswordDialog open={true} onOpenChange={vi.fn()} user={targetUser} />
      </MemoryRouter>
    );
    errorBanner = screen.getByTestId("reset-password-error");
    expect(errorBanner.textContent).toBe("재설정 실패: internal server error");
  });
});
