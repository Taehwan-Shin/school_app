import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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

import { EditUserDialog, type EditUserTarget } from "../src/routes/admin/EditUserDialog.js";

describe("EditUserDialog component", () => {
  const sampleUser: EditUserTarget = {
    email: "teacher1@cam.hs.kr",
    firstName: "길동",
    lastName: "홍",
    orgUnitPath: "/교사",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  it("does not render dialog content when open is false", () => {
    render(<EditUserDialog open={false} onOpenChange={vi.fn()} user={null} />);
    expect(screen.queryByText("사용자 편집")).toBeNull();
  });

  it("renders dialog and pre-fills user data with email read-only", () => {
    render(<EditUserDialog open={true} onOpenChange={vi.fn()} user={sampleUser} />);

    expect(screen.getByText("사용자 편집")).toBeDefined();
    expect(screen.getByText("사용자 이름과 조직 단위를 수정합니다")).toBeDefined();

    // 이메일: 읽기 전용 텍스트
    const emailEl = screen.getByTestId("edit-user-email");
    expect(emailEl.textContent).toBe("teacher1@cam.hs.kr");

    // 성, 이름, 조직 단위 필드 pre-fill 확인
    const familyNameInput = screen.getByLabelText(/성 \*/) as HTMLInputElement;
    const givenNameInput = screen.getByLabelText(/이름 \*/) as HTMLInputElement;
    const orgUnitInput = screen.getByLabelText(/조직 단위/) as HTMLInputElement;

    expect(familyNameInput.value).toBe("홍");
    expect(givenNameInput.value).toBe("길동");
    expect(orgUnitInput.value).toBe("/교사");
    expect(screen.getByTestId("edit-user-submit")).toBeDefined();
  });

  it("shows validation error banner when attempting to submit with no changes", async () => {
    render(<EditUserDialog open={true} onOpenChange={vi.fn()} user={sampleUser} />);

    fireEvent.click(screen.getByTestId("edit-user-submit"));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("edit-user-error")).toBeDefined();
    expect(screen.getByText("변경된 내용이 없습니다.")).toBeDefined();
  });

  it("submits only changed fields (partial update) and closes dialog on success", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      primaryEmail: "teacher1@cam.hs.kr",
      updatedFields: ["lastName"],
    });
    const onOpenChange = vi.fn();

    render(<EditUserDialog open={true} onOpenChange={onOpenChange} user={sampleUser} />);

    const familyNameInput = screen.getByLabelText(/성 \*/);
    fireEvent.change(familyNameInput, { target: { value: "김" } });

    fireEvent.click(screen.getByTestId("edit-user-submit"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        primaryEmail: "teacher1@cam.hs.kr",
        lastName: "김",
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("displays admin cannot edit admin banner when mutation throws admin_cannot_edit_admin", () => {
    mockError = new Error("admin_cannot_edit_admin");

    render(<EditUserDialog open={true} onOpenChange={vi.fn()} user={sampleUser} />);

    expect(screen.getByTestId("edit-user-error")).toBeDefined();
    expect(
      screen.getByText("관리자 계정은 다른 관리자가 수정할 수 없습니다."),
    ).toBeDefined();
  });
});
