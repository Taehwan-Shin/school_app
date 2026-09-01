import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockUseUsersList = vi.fn();
const mockCurrentUser = { email: "admin@cam.hs.kr" };

vi.mock("../src/api/usersList.js", () => ({
  useUsersList: () => mockUseUsersList(),
}));

vi.mock("../src/lib/auth.js", () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    role: "admin",
    loading: false,
    error: null,
  }),
}));

vi.mock("../src/api/usersCreate.js", () => ({
  useCreateUser: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock("../src/api/usersDelete.js", () => ({
  useDeleteUser: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

import { AccountsTable } from "../src/routes/admin/AccountsTable.js";

describe("AccountsTable component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state indicator while data is fetching", () => {
    mockUseUsersList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<AccountsTable />);
    expect(screen.getByTestId("accounts-loading")).toBeDefined();
    expect(screen.getByText("계정 목록을 불러오는 중...")).toBeDefined();
    expect(screen.getByTestId("add-account-btn")).toBeDefined();
  });

  it("renders friendly permission error message on permission denial", () => {
    mockUseUsersList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("permission-denied: requires admin role"),
    });

    render(<AccountsTable />);
    expect(screen.getByTestId("accounts-error")).toBeDefined();
    expect(screen.getByText("이 기능은 관리자만 사용할 수 있습니다.")).toBeDefined();
  });

  it("renders generic error message on other errors", () => {
    mockUseUsersList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Network error"),
    });

    render(<AccountsTable />);
    expect(screen.getByTestId("accounts-error")).toBeDefined();
    expect(screen.getByText(/계정 목록을 불러오지 못했습니다: Network error/)).toBeDefined();
  });

  it("renders empty message when no accounts exist", () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AccountsTable />);
    expect(screen.getByTestId("accounts-empty")).toBeDefined();
    expect(screen.getByText("등록된 계정이 없습니다.")).toBeDefined();
    expect(screen.getByTestId("add-account-btn")).toBeDefined();
  });

  it("renders table rows accurately for accounts and controls delete buttons", () => {
    const mockUsers = [
      {
        email: "admin@cam.hs.kr",
        firstName: "관리",
        lastName: "김",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "teacher1@cam.hs.kr",
        firstName: "길동",
        lastName: "홍",
        orgUnitPath: "/교사",
        isAdmin: false,
        isSuspended: true,
      },
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AccountsTable />);

    // Header check
    expect(screen.getByText("Email")).toBeDefined();
    expect(screen.getByText("이름")).toBeDefined();
    expect(screen.getByText("조직 단위")).toBeDefined();
    expect(screen.getByText("정지")).toBeDefined();
    expect(screen.getByText("관리")).toBeDefined();
    expect(screen.getAllByText("관리자").length).toBeGreaterThanOrEqual(2);

    // Row 1 (Self - admin@cam.hs.kr) delete button should be disabled
    const selfDeleteBtn = screen.getByTestId("delete-user-admin@cam.hs.kr") as HTMLButtonElement;
    expect(selfDeleteBtn).toBeDefined();
    expect(selfDeleteBtn.disabled).toBe(true);
    expect(selfDeleteBtn.title).toBe("자기 계정은 삭제할 수 없습니다");

    // Row 2 (Other - teacher1@cam.hs.kr) delete button should be enabled
    const otherDeleteBtn = screen.getByTestId("delete-user-teacher1@cam.hs.kr") as HTMLButtonElement;
    expect(otherDeleteBtn).toBeDefined();
    expect(otherDeleteBtn.disabled).toBe(false);
  });

  it("opens CreateUserDialog when clicking + 계정 추가 button", () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AccountsTable />);

    fireEvent.click(screen.getByTestId("add-account-btn"));
    expect(screen.getByText("Google Workspace 계정 추가")).toBeDefined();
  });

  it("opens DeleteUserDialog when clicking 삭제 button on another user", () => {
    const mockUsers = [
      {
        email: "teacher1@cam.hs.kr",
        firstName: "길동",
        lastName: "홍",
        orgUnitPath: "/교사",
        isAdmin: false,
        isSuspended: false,
      },
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AccountsTable />);

    fireEvent.click(screen.getByTestId("delete-user-teacher1@cam.hs.kr"));
    expect(screen.getByText("계정 삭제 확인")).toBeDefined();
    expect(screen.getAllByText("teacher1@cam.hs.kr").length).toBeGreaterThanOrEqual(1);
  });

  it("filters accounts by search query matching email or name", () => {
    const mockUsers = [
      {
        email: "admin@cam.hs.kr",
        firstName: "관리",
        lastName: "김",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "teacher1@cam.hs.kr",
        firstName: "길동",
        lastName: "홍",
        orgUnitPath: "/교사",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "student1@cam.hs.kr",
        firstName: "민수",
        lastName: "이",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "admin2@cam.hs.kr",
        firstName: "영희",
        lastName: "박",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "teacher2@cam.hs.kr",
        firstName: "철수",
        lastName: "김",
        orgUnitPath: "/교사",
        isAdmin: false,
        isSuspended: false,
      },
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AccountsTable />);
    const searchInput = screen.getByTestId("accounts-search-input");

    // Type 'admin'
    fireEvent.change(searchInput, { target: { value: "admin" } });
    expect(screen.getByText("admin@cam.hs.kr")).toBeDefined();
    expect(screen.getByText("admin2@cam.hs.kr")).toBeDefined();
    expect(screen.queryByText("teacher1@cam.hs.kr")).toBeNull();
    expect(screen.queryByText("student1@cam.hs.kr")).toBeNull();
    expect(screen.queryByText("teacher2@cam.hs.kr")).toBeNull();

    // Type '길동' (search by name)
    fireEvent.change(searchInput, { target: { value: "길동" } });
    expect(screen.getByText("teacher1@cam.hs.kr")).toBeDefined();
    expect(screen.queryByText("admin@cam.hs.kr")).toBeNull();
  });

  it("renders search empty state when search query matches no accounts", () => {
    const mockUsers = [
      {
        email: "admin@cam.hs.kr",
        firstName: "관리",
        lastName: "김",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AccountsTable />);
    const searchInput = screen.getByTestId("accounts-search-input");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(screen.getByTestId("accounts-search-empty")).toBeDefined();
    expect(screen.getByText("검색 결과가 없습니다.")).toBeDefined();
    expect(screen.queryByText("admin@cam.hs.kr")).toBeNull();
  });
});
