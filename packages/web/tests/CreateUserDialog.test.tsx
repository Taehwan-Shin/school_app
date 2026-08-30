import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock("../src/api/usersCreate.js", () => ({
  useCreateUser: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { CreateUserDialog } from "../src/routes/admin/CreateUserDialog.js";

describe("CreateUserDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  it("renders dialog fields when open", () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Google Workspace 계정 추가")).toBeDefined();
    expect(screen.getByLabelText(/이메일/)).toBeDefined();
    expect(screen.getByLabelText(/성/)).toBeDefined();
    expect(screen.getByLabelText(/이름/)).toBeDefined();
    expect(screen.getByLabelText(/비밀번호/)).toBeDefined();
    expect(screen.getByLabelText(/조직 단위/)).toBeDefined();
    expect(screen.getByTestId("create-user-submit")).toBeDefined();
  });

  it("shows client validation error when domain is invalid", async () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "test@gmail.com" } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: "홍" } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "길동" } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: "pass12345" } });

    fireEvent.click(screen.getByTestId("create-user-submit"));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("create-user-error")).toBeDefined();
    expect(screen.getByText("이메일은 @cam.hs.kr 도메인이어야 합니다.")).toBeDefined();
  });

  it("shows client validation error when password is too short", async () => {
    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "test@cam.hs.kr" } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: "홍" } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "길동" } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: "short" } });

    fireEvent.click(screen.getByTestId("create-user-submit"));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("create-user-error")).toBeDefined();
    expect(screen.getByText("비밀번호는 최소 8자 이상이어야 합니다.")).toBeDefined();
  });

  it("submits valid form data and closes dialog on success", async () => {
    mockMutateAsync.mockResolvedValueOnce({ primaryEmail: "new@cam.hs.kr", uid: "u123" });
    const onOpenChange = vi.fn();

    render(<CreateUserDialog open={true} onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "new@cam.hs.kr" } });
    fireEvent.change(screen.getByLabelText(/성/), { target: { value: "홍" } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "길동" } });
    fireEvent.change(screen.getByLabelText(/비밀번호/), { target: { value: "securePass123" } });
    fireEvent.change(screen.getByLabelText(/조직 단위/), { target: { value: "/학생/1학년" } });

    fireEvent.click(screen.getByTestId("create-user-submit"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        primaryEmail: "new@cam.hs.kr",
        familyName: "홍",
        givenName: "길동",
        password: "securePass123",
        orgUnitPath: "/학생/1학년",
        changePasswordAtNextLogin: true,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("displays server error message when mutation fails", () => {
    mockError = new Error("permission-denied");

    render(<CreateUserDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByTestId("create-user-error")).toBeDefined();
    expect(screen.getByText("계정 생성 권한이 없거나 스코프가 부족합니다.")).toBeDefined();
  });
});
