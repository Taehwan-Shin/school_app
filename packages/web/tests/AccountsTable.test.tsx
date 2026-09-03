import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

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

vi.mock("../src/api/usersUpdate.js", () => ({
  useUpdateUser: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock("../src/api/usersResetPassword.js", () => ({
  useResetPassword: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

import { AccountsTable } from "../src/routes/admin/AccountsTable.js";

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/admin']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

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

    renderWithRouter(<AccountsTable />);
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

    renderWithRouter(<AccountsTable />);
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

    renderWithRouter(<AccountsTable />);
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

    renderWithRouter(<AccountsTable />);
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

    renderWithRouter(<AccountsTable />);

    // Header check
    expect(screen.getByText("Email")).toBeDefined();
    expect(screen.getByText("이름")).toBeDefined();
    expect(screen.getByText("조직 단위")).toBeDefined();
    expect(screen.getAllByText("정지").length).toBeGreaterThanOrEqual(1);
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

    renderWithRouter(<AccountsTable />);

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

    renderWithRouter(<AccountsTable />);

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

    renderWithRouter(<AccountsTable />);
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

    renderWithRouter(<AccountsTable />);
    const searchInput = screen.getByTestId("accounts-search-input");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(screen.getByTestId("accounts-search-empty")).toBeDefined();
    expect(screen.getByText("검색 결과가 없습니다.")).toBeDefined();
    expect(screen.getByTestId("accounts-pagination-info").textContent).toBe("결과 없음");
    expect(screen.queryByText("admin@cam.hs.kr")).toBeNull();
  });

  it("toggles sorting when clicking column headers", () => {
    const mockUsers = [
      {
        email: "charlie@cam.hs.kr",
        firstName: "철수",
        lastName: "이",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "alice@cam.hs.kr",
        firstName: "영희",
        lastName: "김",
        orgUnitPath: "/교사",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "bob@cam.hs.kr",
        firstName: "민수",
        lastName: "박",
        orgUnitPath: "/행정",
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

    renderWithRouter(<AccountsTable />);
    const emailHeader = screen.getByTestId("accounts-sort-email");

    // Click 1: Email asc
    fireEvent.click(emailHeader);
    expect(emailHeader.getAttribute("aria-sort")).toBe("ascending");
    let rows = screen.getAllByRole("row").slice(1); // exclude header row
    expect(rows[0].textContent).toContain("alice@cam.hs.kr");
    expect(rows[1].textContent).toContain("bob@cam.hs.kr");
    expect(rows[2].textContent).toContain("charlie@cam.hs.kr");

    // Click 2: Email desc
    fireEvent.click(emailHeader);
    expect(emailHeader.getAttribute("aria-sort")).toBe("descending");
    rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("charlie@cam.hs.kr");
    expect(rows[1].textContent).toContain("bob@cam.hs.kr");
    expect(rows[2].textContent).toContain("alice@cam.hs.kr");

    // Click name header: Name asc
    const nameHeader = screen.getByTestId("accounts-sort-name");
    fireEvent.click(nameHeader);
    expect(nameHeader.getAttribute("aria-sort")).toBe("ascending");
    expect(emailHeader.getAttribute("aria-sort")).toBe("none");
    rows = screen.getAllByRole("row").slice(1);
    // 김영희, 박민수, 이철수
    expect(rows[0].textContent).toContain("김영희");
    expect(rows[1].textContent).toContain("박민수");
    expect(rows[2].textContent).toContain("이철수");
  });

  it("navigates between pages with 25 users per page", () => {
    const mockUsers = Array.from({ length: 30 }, (_, i) => ({
      email: `user${String(i + 1).padStart(2, "0")}@cam.hs.kr`,
      firstName: `이름${i + 1}`,
      lastName: "김",
      orgUnitPath: "/",
      isAdmin: false,
      isSuspended: false,
    }));

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<AccountsTable />);

    const paginationInfo = screen.getByTestId("accounts-pagination-info");
    const prevBtn = screen.getByTestId("accounts-pagination-prev") as HTMLButtonElement;
    const nextBtn = screen.getByTestId("accounts-pagination-next") as HTMLButtonElement;

    // Page 0: 1–25 of 30
    expect(paginationInfo.textContent).toBe("1–25 of 30");
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
    expect(screen.getByText("user01@cam.hs.kr")).toBeDefined();
    expect(screen.getByText("user25@cam.hs.kr")).toBeDefined();
    expect(screen.queryByText("user26@cam.hs.kr")).toBeNull();

    // Click Next -> Page 1: 26–30 of 30 (rows 26-30)
    fireEvent.click(nextBtn);
    expect(paginationInfo.textContent).toBe("26–30 of 30");
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(true);
    expect(screen.queryByText("user01@cam.hs.kr")).toBeNull();
    expect(screen.getByText("user26@cam.hs.kr")).toBeDefined();
    expect(screen.getByText("user30@cam.hs.kr")).toBeDefined();

    // Click Prev -> Page 0: 1–25 of 30
    fireEvent.click(prevBtn);
    expect(paginationInfo.textContent).toBe("1–25 of 30");
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
  });

  it("resets to first page when search query changes", () => {
    const mockUsers = Array.from({ length: 30 }, (_, i) => ({
      email: `user${String(i + 1).padStart(2, "0")}@cam.hs.kr`,
      firstName: `이름${i + 1}`,
      lastName: "김",
      orgUnitPath: "/",
      isAdmin: false,
      isSuspended: false,
    }));

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<AccountsTable />);
    const nextBtn = screen.getByTestId("accounts-pagination-next");
    const searchInput = screen.getByTestId("accounts-search-input");
    const paginationInfo = screen.getByTestId("accounts-pagination-info");

    // Move to page 1
    fireEvent.click(nextBtn);
    expect(paginationInfo.textContent).toBe("26–30 of 30");

    // Type in search query -> resets to page 0
    fireEvent.change(searchInput, { target: { value: "user" } });
    expect(paginationInfo.textContent).toBe("1–25 of 30");

    // Type more specific search query
    fireEvent.change(searchInput, { target: { value: "user28" } });
    expect(paginationInfo.textContent).toBe("1–1 of 1");
    expect(screen.getByText("user28@cam.hs.kr")).toBeDefined();
  });

  it("filters accounts by URL filter=admin on initial load", () => {
    const mockUsers = [
      {
        email: "admin1@cam.hs.kr",
        firstName: "관리자1",
        lastName: "김",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "admin2@cam.hs.kr",
        firstName: "관리자2",
        lastName: "이",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "suspended@cam.hs.kr",
        firstName: "정지",
        lastName: "박",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: true,
      },
      {
        email: "user1@cam.hs.kr",
        firstName: "길동",
        lastName: "홍",
        orgUnitPath: "/교사",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "user2@cam.hs.kr",
        firstName: "영희",
        lastName: "최",
        orgUnitPath: "/학생",
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

    renderWithRouter(<AccountsTable />, ['/admin?filter=admin']);

    expect(screen.getByText("admin1@cam.hs.kr")).toBeDefined();
    expect(screen.getByText("admin2@cam.hs.kr")).toBeDefined();
    expect(screen.queryByText("suspended@cam.hs.kr")).toBeNull();
    expect(screen.queryByText("user1@cam.hs.kr")).toBeNull();
    expect(screen.queryByText("user2@cam.hs.kr")).toBeNull();
    expect(screen.getByTestId("accounts-pagination-info").textContent).toBe("1–2 of 2");
  });

  it("merges KPI filter with search query filtering", () => {
    const mockUsers = [
      {
        email: "admin1@cam.hs.kr",
        firstName: "관리자1",
        lastName: "김",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "admin2@cam.hs.kr",
        firstName: "관리자2",
        lastName: "이",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "user1@cam.hs.kr",
        firstName: "admin1동명",
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

    renderWithRouter(<AccountsTable />, ['/admin?filter=admin']);
    const searchInput = screen.getByTestId("accounts-search-input");

    fireEvent.change(searchInput, { target: { value: "admin1" } });

    expect(screen.getByText("admin1@cam.hs.kr")).toBeDefined();
    expect(screen.queryByText("admin2@cam.hs.kr")).toBeNull();
    expect(screen.queryByText("user1@cam.hs.kr")).toBeNull();
    expect(screen.getByTestId("accounts-pagination-info").textContent).toBe("1–1 of 1");
  });

  it("restores search query from URL q= parameter on initial load", () => {
    const mockUsers = [
      {
        email: "hong@cam.hs.kr",
        firstName: "길동",
        lastName: "홍",
        orgUnitPath: "/교사",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "kim@cam.hs.kr",
        firstName: "철수",
        lastName: "김",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "lee@cam.hs.kr",
        firstName: "영희",
        lastName: "이",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "park@cam.hs.kr",
        firstName: "민수",
        lastName: "박",
        orgUnitPath: "/교사",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "choi@cam.hs.kr",
        firstName: "지원",
        lastName: "최",
        orgUnitPath: "/행정",
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

    renderWithRouter(<AccountsTable />, ['/admin?q=홍']);

    expect(screen.getByText("hong@cam.hs.kr")).toBeDefined();
    expect(screen.queryByText("kim@cam.hs.kr")).toBeNull();
    expect(screen.queryByText("lee@cam.hs.kr")).toBeNull();
    expect(screen.queryByText("park@cam.hs.kr")).toBeNull();
    expect(screen.queryByText("choi@cam.hs.kr")).toBeNull();
    expect(screen.getByTestId("accounts-pagination-info").textContent).toBe("1–1 of 1");
    const searchInput = screen.getByTestId("accounts-search-input") as HTMLInputElement;
    expect(searchInput.value).toBe("홍");
  });

  it("restores sort state from URL sort= and dir= parameters on initial load", () => {
    const mockUsers = [
      {
        email: "alice@cam.hs.kr",
        firstName: "영희",
        lastName: "김",
        orgUnitPath: "/교사",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "bob@cam.hs.kr",
        firstName: "민수",
        lastName: "박",
        orgUnitPath: "/행정",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "charlie@cam.hs.kr",
        firstName: "철수",
        lastName: "이",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "david@cam.hs.kr",
        firstName: "길동",
        lastName: "홍",
        orgUnitPath: "/교사",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "eve@cam.hs.kr",
        firstName: "지원",
        lastName: "최",
        orgUnitPath: "/행정",
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

    renderWithRouter(<AccountsTable />, ['/admin?sort=email&dir=desc']);

    const emailHeader = screen.getByTestId("accounts-sort-email");
    expect(emailHeader.getAttribute("aria-sort")).toBe("descending");

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("eve@cam.hs.kr");
    expect(rows[1].textContent).toContain("david@cam.hs.kr");
    expect(rows[2].textContent).toContain("charlie@cam.hs.kr");
    expect(rows[3].textContent).toContain("bob@cam.hs.kr");
    expect(rows[4].textContent).toContain("alice@cam.hs.kr");
  });

  it("reflects search query input into URL search params", () => {
    let capturedSearch = "";
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

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

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <LocationSpy />
        <AccountsTable />
      </MemoryRouter>
    );

    const searchInput = screen.getByTestId("accounts-search-input");
    fireEvent.change(searchInput, { target: { value: "관리" } });

    expect(decodeURIComponent(capturedSearch)).toBe("?q=관리");

    fireEvent.change(searchInput, { target: { value: "" } });
    expect(capturedSearch).toBe("");
  });

  it("renders edit button for each account row including self", () => {
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
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<AccountsTable />);

    const selfEditBtn = screen.getByTestId("edit-user-admin@cam.hs.kr") as HTMLButtonElement;
    const otherEditBtn = screen.getByTestId("edit-user-teacher1@cam.hs.kr") as HTMLButtonElement;

    expect(selfEditBtn).toBeDefined();
    expect(selfEditBtn.disabled).toBe(false);
    expect(otherEditBtn).toBeDefined();
    expect(otherEditBtn.disabled).toBe(false);
  });

  it("opens EditUserDialog with pre-filled target when clicking edit button", () => {
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

    renderWithRouter(<AccountsTable />);

    fireEvent.click(screen.getByTestId("edit-user-teacher1@cam.hs.kr"));
    expect(screen.getByText("사용자 편집")).toBeDefined();
    expect(screen.getByTestId("edit-user-email").textContent).toBe("teacher1@cam.hs.kr");
    const familyNameInput = screen.getByLabelText(/성 \*/) as HTMLInputElement;
    const givenNameInput = screen.getByLabelText(/이름 \*/) as HTMLInputElement;
    const orgUnitInput = screen.getByLabelText(/조직 단위/) as HTMLInputElement;
    expect(familyNameInput.value).toBe("홍");
    expect(givenNameInput.value).toBe("길동");
    expect(orgUnitInput.value).toBe("/교사");
  });

  it("renders suspend and restore buttons correctly based on user suspension state", () => {
    const mockUsers = [
      {
        email: "normal@cam.hs.kr",
        firstName: "정상",
        lastName: "이",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "suspended@cam.hs.kr",
        firstName: "정지",
        lastName: "박",
        orgUnitPath: "/학생",
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

    renderWithRouter(<AccountsTable />);

    const normalSuspendBtn = screen.getByTestId("suspend-user-normal@cam.hs.kr") as HTMLButtonElement;
    expect(normalSuspendBtn).toBeDefined();
    expect(normalSuspendBtn.textContent).toBe("정지");
    expect(normalSuspendBtn.title).toBe("계정 정지");
    expect(normalSuspendBtn.disabled).toBe(false);

    const suspendedRestoreBtn = screen.getByTestId("suspend-user-suspended@cam.hs.kr") as HTMLButtonElement;
    expect(suspendedRestoreBtn).toBeDefined();
    expect(suspendedRestoreBtn.textContent).toBe("복구");
    expect(suspendedRestoreBtn.title).toBe("계정 복구");
    expect(suspendedRestoreBtn.disabled).toBe(false);
  });

  it("disables suspend button for self account with appropriate title", () => {
    const mockUsers = [
      {
        email: "admin@cam.hs.kr",
        firstName: "관리자",
        lastName: "김",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "other@cam.hs.kr",
        firstName: "다른",
        lastName: "이",
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

    renderWithRouter(<AccountsTable />);

    const selfSuspendBtn = screen.getByTestId("suspend-user-admin@cam.hs.kr") as HTMLButtonElement;
    expect(selfSuspendBtn).toBeDefined();
    expect(selfSuspendBtn.disabled).toBe(true);
    expect(selfSuspendBtn.title).toBe("자기 계정은 정지·복구할 수 없습니다");

    const otherSuspendBtn = screen.getByTestId("suspend-user-other@cam.hs.kr") as HTMLButtonElement;
    expect(otherSuspendBtn).toBeDefined();
    expect(otherSuspendBtn.disabled).toBe(false);
    expect(otherSuspendBtn.title).toBe("계정 정지");
  });

  it("renders password reset button in actions column, disabled for self with appropriate title", () => {
    const mockUsers = [
      {
        email: "admin@cam.hs.kr",
        firstName: "관리자",
        lastName: "김",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: "other@cam.hs.kr",
        firstName: "다른",
        lastName: "이",
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

    renderWithRouter(<AccountsTable />);

    const selfResetBtn = screen.getByTestId("reset-password-admin@cam.hs.kr") as HTMLButtonElement;
    expect(selfResetBtn).toBeDefined();
    expect(selfResetBtn.textContent).toBe("비밀번호");
    expect(selfResetBtn.disabled).toBe(true);
    expect(selfResetBtn.title).toBe("자기 계정 비밀번호는 여기서 재설정할 수 없습니다");

    const otherResetBtn = screen.getByTestId("reset-password-other@cam.hs.kr") as HTMLButtonElement;
    expect(otherResetBtn).toBeDefined();
    expect(otherResetBtn.textContent).toBe("비밀번호");
    expect(otherResetBtn.disabled).toBe(false);
    expect(otherResetBtn.title).toBe("비밀번호 재설정");
  });

  it("opens ResetPasswordDialog when clicking password reset button", () => {
    const mockUsers = [
      {
        email: "target@cam.hs.kr",
        firstName: "길동",
        lastName: "홍",
        orgUnitPath: "/학생",
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

    renderWithRouter(<AccountsTable />);

    const resetBtn = screen.getByTestId("reset-password-target@cam.hs.kr");
    fireEvent.click(resetBtn);

    expect(screen.getByText("비밀번호 재설정")).toBeDefined();
    expect(screen.getAllByText("target@cam.hs.kr").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("reset-password-new")).toBeDefined();
    expect(screen.getByTestId("reset-password-submit")).toBeDefined();
  });

  it("renders email cell as a link pointing to /admin/users/:email", () => {
    const mockUsers = [
      {
        email: "user1@cam.hs.kr",
        firstName: "일",
        lastName: "김",
        orgUnitPath: "/학생",
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

    renderWithRouter(<AccountsTable />);

    const link = screen.getByRole("link", { name: "user1@cam.hs.kr" }) as HTMLAnchorElement;
    expect(link).toBeDefined();
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/admin/users/user1%40cam.hs.kr");
  });

  it("renders export CSV button, enabled when accounts exist and disabled when empty", () => {
    const mockUsers = [
      {
        email: "user1@cam.hs.kr",
        firstName: "일",
        lastName: "김",
        orgUnitPath: "/학생",
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

    renderWithRouter(<AccountsTable />);

    const exportBtn = screen.getByTestId("accounts-export-csv-btn") as HTMLButtonElement;
    expect(exportBtn).toBeDefined();
    expect(exportBtn.disabled).toBe(false);
    expect(exportBtn.textContent).toContain("CSV 내보내기");

    const searchInput = screen.getByTestId("accounts-search-input");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(exportBtn.disabled).toBe(true);
  });

  it("renders checkboxes for each account with self account disabled", () => {
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
        email: "user1@cam.hs.kr",
        firstName: "일",
        lastName: "이",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "user2@cam.hs.kr",
        firstName: "이",
        lastName: "박",
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

    renderWithRouter(<AccountsTable />);

    const selfCheck = screen.getByTestId("bulk-check-admin@cam.hs.kr") as HTMLInputElement;
    const user1Check = screen.getByTestId("bulk-check-user1@cam.hs.kr") as HTMLInputElement;
    const user2Check = screen.getByTestId("bulk-check-user2@cam.hs.kr") as HTMLInputElement;

    expect(selfCheck).toBeDefined();
    expect(selfCheck.disabled).toBe(true);
    expect(user1Check).toBeDefined();
    expect(user1Check.disabled).toBe(false);
    expect(user2Check).toBeDefined();
    expect(user2Check.disabled).toBe(false);
  });

  it("toggles select all for non-self users on header checkbox click", () => {
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
        email: "user1@cam.hs.kr",
        firstName: "일",
        lastName: "이",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "user2@cam.hs.kr",
        firstName: "이",
        lastName: "박",
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

    renderWithRouter(<AccountsTable />);

    const headerCheck = screen.getByTestId("bulk-check-all") as HTMLInputElement;
    const selfCheck = screen.getByTestId("bulk-check-admin@cam.hs.kr") as HTMLInputElement;
    const user1Check = screen.getByTestId("bulk-check-user1@cam.hs.kr") as HTMLInputElement;
    const user2Check = screen.getByTestId("bulk-check-user2@cam.hs.kr") as HTMLInputElement;

    expect(headerCheck.checked).toBe(false);
    expect(user1Check.checked).toBe(false);
    expect(user2Check.checked).toBe(false);

    // Click header check: selects 2 non-self users
    fireEvent.click(headerCheck);

    expect(user1Check.checked).toBe(true);
    expect(user2Check.checked).toBe(true);
    expect(selfCheck.checked).toBe(false);
    expect(screen.getByTestId("bulk-action-bar").textContent).toContain("2명 선택됨");

    // Click again: deselects all
    fireEvent.click(headerCheck);

    expect(user1Check.checked).toBe(false);
    expect(user2Check.checked).toBe(false);
    expect(screen.queryByTestId("bulk-action-bar")).toBeNull();
  });

  it("renders bulk-action-bar when selection > 0 and clears selection on clear button click", () => {
    const mockUsers = [
      {
        email: "user1@cam.hs.kr",
        firstName: "일",
        lastName: "이",
        orgUnitPath: "/학생",
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

    renderWithRouter(<AccountsTable />);

    expect(screen.queryByTestId("bulk-action-bar")).toBeNull();

    const user1Check = screen.getByTestId("bulk-check-user1@cam.hs.kr") as HTMLInputElement;
    fireEvent.click(user1Check);

    expect(screen.getByTestId("bulk-action-bar")).toBeDefined();
    expect(screen.getByTestId("bulk-action-bar").textContent).toContain("1명 선택됨");

    const clearBtn = screen.getByTestId("bulk-clear-btn");
    fireEvent.click(clearBtn);

    expect(screen.queryByTestId("bulk-action-bar")).toBeNull();
    expect(user1Check.checked).toBe(false);
  });
});


