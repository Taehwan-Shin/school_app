import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock("../src/api/usersUpdate.js", () => ({
  useUpdateUser: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { SuspendUserDialog, type SuspendUserTarget } from "../src/routes/admin/SuspendUserDialog.js";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("SuspendUserDialog component", () => {
  const normalUser: SuspendUserTarget = {
    email: "student@cam.hs.kr",
    firstName: "길동",
    lastName: "홍",
    isSuspended: false,
  };

  const suspendedUser: SuspendUserTarget = {
    email: "suspended@cam.hs.kr",
    firstName: "영희",
    lastName: "이",
    isSuspended: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  // 1. user=null -> 다이얼로그 안 열림
  it("does not render dialog when user is null", () => {
    renderWithRouter(<SuspendUserDialog open={true} onOpenChange={vi.fn()} user={null} />);

    expect(screen.queryByText("계정 정지 확인")).toBeNull();
    expect(screen.queryByText("계정 복구 확인")).toBeNull();
    expect(screen.queryByTestId("suspend-user-submit")).toBeNull();
  });

  // 2. user.isSuspended=false -> 「정지」 문구, 경고 톤
  it("renders suspend wording with warning tone when user isSuspended is false", () => {
    renderWithRouter(<SuspendUserDialog open={true} onOpenChange={vi.fn()} user={normalUser} />);

    const title = screen.getByText("계정 정지 확인");
    expect(title).toBeDefined();
    expect(title.className).toContain("text-state-warning");
    expect(screen.getByText(/계정을 정지하면/)).toBeDefined();
    expect(screen.getByText(/정지하려면/)).toBeDefined();
    expect(screen.getAllByText("student@cam.hs.kr").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("홍길동")).toBeDefined();

    const submitBtn = screen.getByTestId("suspend-user-submit") as HTMLButtonElement;
    expect(submitBtn.textContent).toBe("정지");
    expect(submitBtn.disabled).toBe(true);
  });

  // 3. user.isSuspended=true -> 「복구」 문구, 일반 톤
  it("renders restore wording with normal tone when user isSuspended is true", () => {
    renderWithRouter(<SuspendUserDialog open={true} onOpenChange={vi.fn()} user={suspendedUser} />);

    const title = screen.getByText("계정 복구 확인");
    expect(title).toBeDefined();
    expect(title.className).toContain("text-fg-primary");
    expect(title.className).not.toContain("text-state-warning");
    expect(screen.getByText(/계정을 복구하면/)).toBeDefined();
    expect(screen.getByText(/복구하려면/)).toBeDefined();
    expect(screen.getAllByText("suspended@cam.hs.kr").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("이영희")).toBeDefined();

    const submitBtn = screen.getByTestId("suspend-user-submit") as HTMLButtonElement;
    expect(submitBtn.textContent).toBe("복구");
    expect(submitBtn.disabled).toBe(true);
  });

  // 4. 성공 (정지) - mutation 이 {primaryEmail, suspended: true} 로 호출됨
  it("submits suspend request with suspended=true and closes dialog on success", async () => {
    mockMutateAsync.mockResolvedValueOnce({ primaryEmail: "student@cam.hs.kr", updatedFields: ["suspended"] });
    const onOpenChange = vi.fn();

    renderWithRouter(<SuspendUserDialog open={true} onOpenChange={onOpenChange} user={normalUser} />);

    const input = screen.getByLabelText(/정지하려면/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "student@cam.hs.kr" } });

    const submitBtn = screen.getByTestId("suspend-user-submit") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        primaryEmail: "student@cam.hs.kr",
        suspended: true,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // 5. 오류 (admin_cannot_edit_admin) -> 배너 「관리자 계정은…」
  it("displays server error message when admin_cannot_edit_admin occurs", () => {
    mockError = new Error("admin_cannot_edit_admin");

    renderWithRouter(<SuspendUserDialog open={true} onOpenChange={vi.fn()} user={normalUser} />);

    expect(screen.getByTestId("suspend-user-error")).toBeDefined();
    expect(screen.getByText("관리자 계정은 정지·복구할 수 없습니다.")).toBeDefined();
  });
});
