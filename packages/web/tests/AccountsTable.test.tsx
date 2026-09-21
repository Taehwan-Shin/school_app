import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom";

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
  callUsersDelete: vi.fn(),
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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccountsTable } from "../src/routes/admin/AccountsTable.js";

const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/admin']) {
  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AccountsTable component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // v0.160: 정렬 선호 localStorage bleed 방지 (hydrate effect 가 URL 을 재-write).
    localStorage.clear();
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

  // v0.132: BatchCreateUsersDialog 진입 회귀.
  it("v0.132: opens BatchCreateUsersDialog when clicking + 전입생 일괄 추가 button", () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderWithRouter(<AccountsTable />);
    fireEvent.click(screen.getByTestId("add-batch-accounts-btn"));
    expect(screen.getByText("전입생 일괄 계정 추가")).toBeDefined();
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
    expect(paginationInfo.textContent).toContain("1–25 of 30");
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
    expect(screen.getByText("user01@cam.hs.kr")).toBeDefined();
    expect(screen.getByText("user25@cam.hs.kr")).toBeDefined();
    expect(screen.queryByText("user26@cam.hs.kr")).toBeNull();

    // Click Next -> Page 1: 26–30 of 30 (rows 26-30)
    fireEvent.click(nextBtn);
    expect(paginationInfo.textContent).toContain("26–30 of 30");
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(true);
    expect(screen.queryByText("user01@cam.hs.kr")).toBeNull();
    expect(screen.getByText("user26@cam.hs.kr")).toBeDefined();
    expect(screen.getByText("user30@cam.hs.kr")).toBeDefined();

    // Click Prev -> Page 0: 1–25 of 30
    fireEvent.click(prevBtn);
    expect(paginationInfo.textContent).toContain("1–25 of 30");
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
    expect(paginationInfo.textContent).toContain("26–30 of 30");

    // Type in search query -> resets to page 0
    fireEvent.change(searchInput, { target: { value: "user" } });
    expect(paginationInfo.textContent).toContain("1–25 of 30");

    // Type more specific search query
    fireEvent.change(searchInput, { target: { value: "user28" } });
    expect(paginationInfo.textContent).toContain("1–1 of 1");
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
    expect(screen.getByTestId("accounts-pagination-info").textContent).toContain("1–2 of 2");
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
    expect(screen.getByTestId("accounts-pagination-info").textContent).toContain("1–1 of 1");
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
    expect(screen.getByTestId("accounts-pagination-info").textContent).toContain("1–1 of 1");
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
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/admin"]}>
          <LocationSpy />
          <AccountsTable />
        </MemoryRouter>
      </QueryClientProvider>
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

  // v0.152: JSON 내보내기 (로드맵 B-6).
  describe("v0.152 JSON 내보내기", () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => "blob:mock");
      URL.revokeObjectURL = vi.fn();
    });
    afterAll(() => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    });

    const mockUsers = [
      {
        email: "user1@cam.hs.kr",
        firstName: "일",
        lastName: "김",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: false,
      },
      {
        email: "admin@cam.hs.kr",
        firstName: "관리",
        lastName: "김",
        orgUnitPath: "/",
        isAdmin: true,
        isSuspended: false,
      },
    ];

    it("JSON 버튼 표시 · 데이터 있으면 enabled · 필터 결과 0 이면 disabled", () => {
      mockUseUsersList.mockReturnValue({
        data: { users: mockUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      const btn = screen.getByTestId("accounts-export-json-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toContain("JSON 내보내기");

      fireEvent.change(screen.getByTestId("accounts-search-input"), {
        target: { value: "zzz-nomatch" },
      });
      expect(btn.disabled).toBe(true);
    });

    it("JSON 클릭 시 download 트리거 · 파일명 accounts-YYYY-MM-DD.json", () => {
      mockUseUsersList.mockReturnValue({
        data: { users: mockUsers },
        isLoading: false,
        isError: false,
        error: null,
      });

      const clicks: Array<{ download: string; href: string }> = [];
      const originalCreateElement = document.createElement.bind(document);
      const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "a") {
          Object.defineProperty(el, "click", {
            configurable: true,
            value: () =>
              clicks.push({
                download: (el as HTMLAnchorElement).download,
                href: (el as HTMLAnchorElement).href,
              }),
          });
        }
        return el;
      });

      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("accounts-export-json-btn"));
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(clicks).toHaveLength(1);
      expect(clicks[0].download).toMatch(/^accounts-\d{4}-\d{2}-\d{2}\.json$/);
      spy.mockRestore();
    });

    it("JSON payload 는 exportedAt · filters · totalCount · users 배열 포함 (필터 반영)", async () => {
      mockUseUsersList.mockReturnValue({
        data: { users: mockUsers },
        isLoading: false,
        isError: false,
        error: null,
      });

      let blobText = "";
      const originalCreate = URL.createObjectURL;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        blob.text().then((t) => {
          blobText = t;
        });
        return "blob:mock";
      });
      const originalCreateElement = document.createElement.bind(document);
      const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "a") {
          Object.defineProperty(el, "click", { configurable: true, value: () => {} });
        }
        return el;
      });

      renderWithRouter(<AccountsTable />, ["/admin?q=user1&filter=normal&sort=email&dir=desc"]);
      fireEvent.click(screen.getByTestId("accounts-export-json-btn"));
      // 다음 microtask 대기.
      await Promise.resolve();
      await Promise.resolve();

      const parsed = JSON.parse(blobText);
      expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(parsed.filters).toEqual({
        q: "user1",
        filter: "normal",
        sort: "email",
        dir: "desc",
      });
      // q=user1 + filter=normal (관리자 아님) → user1 만.
      expect(parsed.totalCount).toBe(1);
      expect(parsed.users).toHaveLength(1);
      expect(parsed.users[0]).toMatchObject({
        email: "user1@cam.hs.kr",
        firstName: "일",
        lastName: "김",
        orgUnitPath: "/학생",
        isAdmin: false,
        isSuspended: false,
      });

      spy.mockRestore();
      URL.createObjectURL = originalCreate;
    });
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

  it("renders bulk-action-bar with bulk-suspend-btn and bulk-delete-btn when selection > 0", () => {
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

    const user1Check = screen.getByTestId("bulk-check-user1@cam.hs.kr") as HTMLInputElement;
    fireEvent.click(user1Check);

    const suspendBtn = screen.getByTestId("bulk-suspend-btn");
    const deleteBtn = screen.getByTestId("bulk-delete-btn");
    // v0.123: 「선택 복구」 버튼 추가.
    const restoreBtn = screen.getByTestId("bulk-restore-btn");

    expect(suspendBtn).toBeDefined();
    expect(deleteBtn).toBeDefined();
    expect(restoreBtn).toBeDefined();
    expect(restoreBtn.textContent).toContain("선택 복구");
    expect(deleteBtn.textContent).toContain("선택 삭제");

    fireEvent.click(deleteBtn);
    expect(screen.getByText("일괄 삭제 확인")).toBeDefined();
  });

  // v0.123: bulk-restore-btn 클릭 시 BulkRestoreDialog 오픈.
  it("v0.123: bulk-restore-btn 클릭 → BulkRestoreDialog 오픈", () => {
    const mockUsers = [
      {
        email: "user1@cam.hs.kr",
        firstName: "일",
        lastName: "이",
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
    const check = screen.getByTestId("bulk-check-user1@cam.hs.kr") as HTMLInputElement;
    fireEvent.click(check);
    fireEvent.click(screen.getByTestId("bulk-restore-btn"));
    expect(screen.getByText("일괄 복구 확인")).toBeDefined();
  });

  it("renders bulk-move-ou-btn in bulk-action-bar when selection > 0 and opens BulkMoveOuDialog", () => {
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

    const user1Check = screen.getByTestId("bulk-check-user1@cam.hs.kr") as HTMLInputElement;
    fireEvent.click(user1Check);

    const moveOuBtn = screen.getByTestId("bulk-move-ou-btn");
    expect(moveOuBtn).toBeDefined();
    expect(moveOuBtn.textContent).toContain("선택 조직 이동");

    fireEvent.click(moveOuBtn);
    expect(screen.getByText("일괄 조직 이동 확인")).toBeDefined();
  });

  // v0.125: 「필터 초기화」 버튼 — v0.112 AuditLogTable 대칭.
  describe("v0.125 clear filters button", () => {
    const mockUsers = [
      {
        email: "user1@cam.hs.kr",
        firstName: "일",
        lastName: "김",
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
        isSuspended: true,
      },
    ];

    beforeEach(() => {
      mockUseUsersList.mockReturnValue({
        data: { users: mockUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it("v0.125: 필터 없으면 disabled", () => {
      renderWithRouter(<AccountsTable />);
      const btn = screen.getByTestId("accounts-clear-filters-btn") as HTMLButtonElement;
      expect(btn).toBeDefined();
      expect(btn.disabled).toBe(true);
    });

    it("v0.125: q 있으면 enabled", () => {
      renderWithRouter(<AccountsTable />, ['/admin?q=user1']);
      const btn = screen.getByTestId("accounts-clear-filters-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it("v0.125: filter=suspended 있으면 enabled", () => {
      renderWithRouter(<AccountsTable />, ['/admin?filter=suspended']);
      const btn = screen.getByTestId("accounts-clear-filters-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it("v0.125: sort=email 있으면 enabled", () => {
      renderWithRouter(<AccountsTable />, ['/admin?sort=email']);
      const btn = screen.getByTestId("accounts-clear-filters-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    // v0.125b F101: 정규화 기준 판정 — 효과 없는 param 은 disabled 유지.
    it("v0.125b F101: 공백-only q 는 필터 적용 안 되므로 disabled", () => {
      renderWithRouter(<AccountsTable />, ['/admin?q=%20%20']);
      const btn = screen.getByTestId("accounts-clear-filters-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("v0.125b F101: allowlist 밖 filter (weird) 는 disabled", () => {
      renderWithRouter(<AccountsTable />, ['/admin?filter=weird']);
      const btn = screen.getByTestId("accounts-clear-filters-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    // v0.138: 정렬 헤더 키보드 접근성 (Codex v0.137 소프트 권고 반영).
    it("v0.138: 정렬 헤더는 Enter · Space 로도 트리거 · tabIndex=0 · focus ring class", () => {
      renderWithRouter(<AccountsTable />);
      const emailHeader = screen.getByTestId("accounts-sort-email");
      expect(emailHeader.getAttribute("tabindex")).toBe("0");
      expect(emailHeader.className).toContain("focus-visible:ring");
      expect(emailHeader.getAttribute("aria-sort")).toBe("none");

      fireEvent.keyDown(emailHeader, { key: "Enter" });
      expect(emailHeader.getAttribute("aria-sort")).toBe("ascending");

      fireEvent.keyDown(emailHeader, { key: " " });
      expect(emailHeader.getAttribute("aria-sort")).toBe("descending");

      fireEvent.keyDown(emailHeader, { key: "a" });
      expect(emailHeader.getAttribute("aria-sort")).toBe("descending");
    });

    it("v0.125b F101: dir 단독 (sort 없음) 은 효과 없으므로 disabled", () => {
      renderWithRouter(<AccountsTable />, ['/admin?dir=desc']);
      const btn = screen.getByTestId("accounts-clear-filters-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("v0.125b F101: allowlist 밖 sort (weird) 는 disabled (sortColumn=null 로 normalize)", () => {
      renderWithRouter(<AccountsTable />, ['/admin?sort=weird']);
      const btn = screen.getByTestId("accounts-clear-filters-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    // v0.125b F102: URL search 실제 clear 검증 + DOM 사용자 두 명 복원 검증.
    it("v0.125b F102: 클릭 시 URL search 완전 비움 + 두 사용자 모두 복원", () => {
      let currentSearch: string | null = null;
      function LocationSpy() {
        const [sp] = useSearchParams();
        currentSearch = sp.toString();
        return null;
      }
      render(
        <QueryClientProvider client={testQueryClient}>
          <MemoryRouter
            initialEntries={['/admin?q=박&filter=suspended&sort=email&dir=desc']}
          >
            <LocationSpy />
            <AccountsTable />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      // 초기 필터 상태 확인: q=박 → user2 (박) 만 노출, user1 (김) 은 숨김.
      expect(screen.queryByText("user1@cam.hs.kr")).toBeNull();
      expect(screen.getByText("user2@cam.hs.kr")).toBeDefined();
      expect(currentSearch).toContain('q=');

      fireEvent.click(screen.getByTestId("accounts-clear-filters-btn"));

      // URL search 완전히 빈 문자열.
      expect(currentSearch).toBe('');
      // 두 사용자 모두 복원.
      expect(screen.getByText("user1@cam.hs.kr")).toBeDefined();
      expect(screen.getByText("user2@cam.hs.kr")).toBeDefined();
      // 버튼도 다시 disabled.
      const btn = screen.getByTestId("accounts-clear-filters-btn") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  // v0.155: 선택된 계정만 export.
  describe("v0.155 선택 계정 export", () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => "blob:mock");
      URL.revokeObjectURL = vi.fn();
    });
    afterAll(() => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    });

    const mockUsers = [
      {
        email: "admin@cam.hs.kr",
        firstName: "관",
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

    it("선택 계정 있으면 버튼 라벨에 「(선택 N)」 표시 + 파일명 -selected 접미사", () => {
      mockUseUsersList.mockReturnValue({
        data: { users: mockUsers },
        isLoading: false,
        isError: false,
        error: null,
      });

      const clicks: Array<{ download: string }> = [];
      const originalCreateElement = document.createElement.bind(document);
      const clickSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "a") {
          (el as HTMLAnchorElement).click = () =>
            clicks.push({ download: (el as HTMLAnchorElement).download });
        }
        return el;
      });

      renderWithRouter(<AccountsTable />);
      // 초기 라벨 (전체).
      const csvBtn = screen.getByTestId("accounts-export-csv-btn") as HTMLButtonElement;
      const jsonBtn = screen.getByTestId("accounts-export-json-btn") as HTMLButtonElement;
      expect(csvBtn.textContent).toBe("CSV 내보내기");
      expect(jsonBtn.textContent).toBe("JSON 내보내기");

      // 2명 선택.
      fireEvent.click(screen.getByTestId("bulk-check-user1@cam.hs.kr"));
      fireEvent.click(screen.getByTestId("bulk-check-user2@cam.hs.kr"));

      expect(csvBtn.textContent).toBe("CSV 내보내기 (선택 2)");
      expect(jsonBtn.textContent).toBe("JSON 내보내기 (선택 2)");

      // CSV click → 파일명 accounts-selected-*.
      fireEvent.click(csvBtn);
      expect(clicks[0].download).toMatch(/^accounts-selected-\d{4}-\d{2}-\d{2}\.csv$/);
      // JSON click → 파일명 accounts-selected-*.json.
      fireEvent.click(jsonBtn);
      expect(clicks[1].download).toMatch(/^accounts-selected-\d{4}-\d{2}-\d{2}\.json$/);

      clickSpy.mockRestore();
    });

    it("선택 없으면 기존대로 sortedFilteredUsers export · 파일명 접미사 없음", () => {
      mockUseUsersList.mockReturnValue({
        data: { users: mockUsers },
        isLoading: false,
        isError: false,
        error: null,
      });

      const clicks: Array<{ download: string }> = [];
      const originalCreateElement = document.createElement.bind(document);
      const clickSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "a") {
          (el as HTMLAnchorElement).click = () =>
            clicks.push({ download: (el as HTMLAnchorElement).download });
        }
        return el;
      });

      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("accounts-export-csv-btn"));
      expect(clicks[0].download).toMatch(/^accounts-\d{4}-\d{2}-\d{2}\.csv$/);
      clickSpy.mockRestore();
    });

    it("JSON payload 에 scope: selected 필드 + 선택 count 반영", async () => {
      mockUseUsersList.mockReturnValue({
        data: { users: mockUsers },
        isLoading: false,
        isError: false,
        error: null,
      });

      let blobText = "";
      const originalCreateObj = URL.createObjectURL;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        blob.text().then((t) => {
          blobText = t;
        });
        return "blob:mock";
      });
      const originalCreateElement = document.createElement.bind(document);
      const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "a") {
          Object.defineProperty(el, "click", { configurable: true, value: () => {} });
        }
        return el;
      });

      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("bulk-check-user1@cam.hs.kr"));
      fireEvent.click(screen.getByTestId("accounts-export-json-btn"));
      await Promise.resolve();
      await Promise.resolve();

      const parsed = JSON.parse(blobText);
      expect(parsed.scope).toBe("selected");
      expect(parsed.totalCount).toBe(1);
      expect(parsed.users).toHaveLength(1);
      expect(parsed.users[0].email).toBe("user1@cam.hs.kr");

      spy.mockRestore();
      URL.createObjectURL = originalCreateObj;
    });

    it("선택 후 필터/검색 변경 시 selection 리셋 (기존 UX 유지) · export 라벨도 리셋", () => {
      mockUseUsersList.mockReturnValue({
        data: { users: mockUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("bulk-check-user1@cam.hs.kr"));
      // 선택 상태 반영.
      const csvBtn = screen.getByTestId("accounts-export-csv-btn") as HTMLButtonElement;
      expect(csvBtn.textContent).toBe("CSV 내보내기 (선택 1)");
      // 검색 변경 → selectedEmails 리셋 (useEffect [searchQuery] deps).
      fireEvent.change(screen.getByTestId("accounts-search-input"), {
        target: { value: "user" },
      });
      // 라벨 원복 (「선택」 접미사 없음).
      expect(csvBtn.textContent).toBe("CSV 내보내기");
    });
  });

  // v0.160: 정렬 선호 localStorage 저장 · URL 이 authoritative.
  describe("v0.160 정렬 선호 localStorage 저장", () => {
    const mockUsers = [
      { email: "a@cam.hs.kr", firstName: "일", lastName: "김", orgUnitPath: "/", isAdmin: false, isSuspended: false },
      { email: "b@cam.hs.kr", firstName: "이", lastName: "박", orgUnitPath: "/", isAdmin: false, isSuspended: false },
    ];

    beforeEach(() => {
      localStorage.clear();
      mockUseUsersList.mockReturnValue({
        data: { users: mockUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it("URL 에 sort 없으면 localStorage 저장값을 URL 로 hydrate", async () => {
      localStorage.setItem(
        "accountsTable.sort.v1",
        JSON.stringify({ sort: "email", dir: "desc" }),
      );
      renderWithRouter(<AccountsTable />, ["/admin"]);
      // hydrate 는 useEffect → 다음 tick 에 aria-sort=descending 반영.
      await waitFor(() => {
        const emailTh = screen.getByRole("columnheader", { name: /Email/i });
        expect(emailTh.getAttribute("aria-sort")).toBe("descending");
      });
    });

    it("URL 에 sort 있으면 localStorage 값 무시 (URL authoritative)", () => {
      localStorage.setItem(
        "accountsTable.sort.v1",
        JSON.stringify({ sort: "email", dir: "desc" }),
      );
      renderWithRouter(<AccountsTable />, ["/admin?sort=name&dir=asc"]);
      const nameTh = screen.getByRole("columnheader", { name: /이름/ });
      expect(nameTh.getAttribute("aria-sort")).toBe("ascending");
      const emailTh = screen.getByRole("columnheader", { name: /Email/i });
      expect(emailTh.getAttribute("aria-sort")).toBe("none");
    });

    it("정렬 헤더 클릭 시 localStorage 에 저장", async () => {
      renderWithRouter(<AccountsTable />, ["/admin"]);
      const emailTh = screen.getByRole("columnheader", { name: /Email/i });
      fireEvent.click(emailTh);
      await waitFor(() => {
        const raw = localStorage.getItem("accountsTable.sort.v1");
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed).toEqual({ sort: "email", dir: "asc" });
      });
    });

    it("「필터 초기화」 후 localStorage 도 제거", async () => {
      renderWithRouter(<AccountsTable />, ["/admin?sort=email&dir=desc"]);
      await waitFor(() => {
        expect(localStorage.getItem("accountsTable.sort.v1")).not.toBeNull();
      });
      fireEvent.click(screen.getByTestId("accounts-clear-filters-btn"));
      await waitFor(() => {
        expect(localStorage.getItem("accountsTable.sort.v1")).toBeNull();
      });
    });

    it("localStorage 손상값은 무시 (JSON parse 실패)", () => {
      localStorage.setItem("accountsTable.sort.v1", "not-json{{");
      renderWithRouter(<AccountsTable />, ["/admin"]);
      // 어떤 컬럼도 aria-sort=ascending/descending 이 아니어야 함 (기본 none).
      const emailTh = screen.getByRole("columnheader", { name: /Email/i });
      expect(emailTh.getAttribute("aria-sort")).toBe("none");
    });
  });

  // v0.193: 페이지 크기 셀렉터 + localStorage 저장.
  describe("v0.193: 페이지 크기 셀렉터", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    // 30 users for pagination boundary tests.
    const users30 = Array.from({ length: 30 }, (_, i) => ({
      email: `user${i}@cam.hs.kr`,
      firstName: `이름${i}`,
      lastName: `성${i}`,
      isAdmin: false,
      isSuspended: false,
      orgUnitPath: "/",
    }));

    const setup = () => {
      mockUseUsersList.mockReturnValue({
        data: { users: users30 },
        isLoading: false,
        isError: false,
        error: null,
      });
    };

    it("기본 25개 · select 값 = 25", () => {
      setup();
      renderWithRouter(<AccountsTable />);
      const select = screen.getByTestId("accounts-page-size-select") as HTMLSelectElement;
      expect(select.value).toBe("25");
      // 첫 페이지 25개 이후 「다음」 활성
      expect(
        (screen.getByTestId("accounts-pagination-next") as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    it("50 선택 시 한 페이지에 30개 모두 · 「다음」 disabled · localStorage 저장", async () => {
      setup();
      renderWithRouter(<AccountsTable />);
      const select = screen.getByTestId("accounts-page-size-select") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "50" } });
      expect(select.value).toBe("50");
      await waitFor(() => {
        expect(localStorage.getItem("accountsTable.pageSize.v1")).toBe("50");
      });
      // 30개 < 50 → 「다음」 disabled.
      expect(
        (screen.getByTestId("accounts-pagination-next") as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it("localStorage 저장값 「100」 이면 mount 시 자동 hydrate", () => {
      localStorage.setItem("accountsTable.pageSize.v1", "100");
      setup();
      renderWithRouter(<AccountsTable />);
      const select = screen.getByTestId("accounts-page-size-select") as HTMLSelectElement;
      expect(select.value).toBe("100");
    });

    it("잘못된 localStorage 값은 default (25) 로 fallback", () => {
      localStorage.setItem("accountsTable.pageSize.v1", "abc");
      setup();
      renderWithRouter(<AccountsTable />);
      const select = screen.getByTestId("accounts-page-size-select") as HTMLSelectElement;
      expect(select.value).toBe("25");
    });

    it("PAGE_SIZE_OPTIONS 밖 (예: 200) 도 fallback", () => {
      localStorage.setItem("accountsTable.pageSize.v1", "200");
      setup();
      renderWithRouter(<AccountsTable />);
      const select = screen.getByTestId("accounts-page-size-select") as HTMLSelectElement;
      expect(select.value).toBe("25");
    });
  });

  // v0.196: pagination info 에 「N / M 페이지」 표기.
  describe("v0.196: page N of M 표기", () => {
    it("30명 · 25/page → 「1 / 2 페이지」 · 다음 페이지 시 「2 / 2 페이지」", async () => {
      const users30 = Array.from({ length: 30 }, (_, i) => ({
        email: `u${i}@cam.hs.kr`,
        firstName: `이름${i}`,
        lastName: `성${i}`,
        isAdmin: false,
        isSuspended: false,
        orgUnitPath: "/",
      }));
      mockUseUsersList.mockReturnValue({
        data: { users: users30 },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      const info = screen.getByTestId("accounts-pagination-info");
      expect(info.textContent).toContain("1 / 2 페이지");
      fireEvent.click(screen.getByTestId("accounts-pagination-next"));
      await waitFor(() => {
        expect(info.textContent).toContain("2 / 2 페이지");
      });
    });
  });

  // v0.199: 컬럼 표시 토글 (name/orgUnitPath/admin/suspended).
  describe("v0.199: 컬럼 표시 토글", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    const sampleUsers = [
      {
        email: "one@cam.hs.kr",
        firstName: "길동",
        lastName: "홍",
        isAdmin: false,
        isSuspended: false,
        orgUnitPath: "/학생",
      },
    ];

    it("기본 4 columns 모두 표시 · 버튼 라벨 「컬럼 표시 (4 / 4)」", () => {
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      const btn = screen.getByTestId("accounts-column-menu-btn");
      expect(btn.textContent).toBe("컬럼 표시 (4 / 4)");
      expect(screen.getByTestId("accounts-sort-name")).toBeDefined();
      expect(screen.getByTestId("accounts-sort-orgUnitPath")).toBeDefined();
    });

    it("「이름」 uncheck → name 컬럼 미표시 · localStorage 저장", async () => {
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("accounts-column-menu-btn"));
      expect(screen.getByTestId("accounts-column-menu")).toBeDefined();
      fireEvent.click(screen.getByTestId("accounts-column-toggle-name"));
      expect(screen.queryByTestId("accounts-sort-name")).toBeNull();
      expect(screen.getByTestId("accounts-column-menu-btn").textContent).toBe(
        "컬럼 표시 (3 / 4)",
      );
      await waitFor(() => {
        const raw = localStorage.getItem("accountsTable.visibleColumns.v1");
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw!) as string[];
        expect(parsed).not.toContain("name");
        expect(parsed).toContain("orgUnitPath");
      });
    });

    it("localStorage 저장값 hydrate: [「admin」만] → 1 컬럼만 표시", () => {
      localStorage.setItem(
        "accountsTable.visibleColumns.v1",
        JSON.stringify(["admin"]),
      );
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      expect(screen.getByTestId("accounts-column-menu-btn").textContent).toBe(
        "컬럼 표시 (1 / 4)",
      );
      expect(screen.queryByTestId("accounts-sort-name")).toBeNull();
      expect(screen.queryByTestId("accounts-sort-orgUnitPath")).toBeNull();
    });

    it("잘못된 localStorage 값 → default 4 columns", () => {
      localStorage.setItem("accountsTable.visibleColumns.v1", "not-json{{");
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      expect(screen.getByTestId("accounts-column-menu-btn").textContent).toBe(
        "컬럼 표시 (4 / 4)",
      );
    });

    it("모든 컬럼 uncheck 시 「컬럼 표시 (0 / 4)」 · 4 컬럼 모두 미표시", () => {
      localStorage.setItem("accountsTable.visibleColumns.v1", JSON.stringify([]));
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      expect(screen.getByTestId("accounts-column-menu-btn").textContent).toBe(
        "컬럼 표시 (0 / 4)",
      );
      expect(screen.queryByTestId("accounts-sort-name")).toBeNull();
      expect(screen.queryByTestId("accounts-sort-orgUnitPath")).toBeNull();
    });

    // v0.202: outside-click auto-close.
    it("v0.202: 메뉴 열림 상태에서 외부 클릭 → 자동 닫힘", async () => {
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      // 메뉴 열기.
      fireEvent.click(screen.getByTestId("accounts-column-menu-btn"));
      expect(screen.getByTestId("accounts-column-menu")).toBeDefined();
      // 외부 요소에 mousedown → 닫힘. fireEvent 로 React state 갱신 트리거.
      const outside = document.createElement("div");
      document.body.appendChild(outside);
      fireEvent.mouseDown(outside);
      await waitFor(() => {
        expect(screen.queryByTestId("accounts-column-menu")).toBeNull();
      });
      document.body.removeChild(outside);
    });

    // v0.203: Escape 키로 컬럼 메뉴 닫기.
    it("v0.203: 메뉴 열림 상태에서 Escape → 자동 닫힘", async () => {
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("accounts-column-menu-btn"));
      expect(screen.getByTestId("accounts-column-menu")).toBeDefined();
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByTestId("accounts-column-menu")).toBeNull();
      });
    });

    // v0.204: 전체 표시 / 전체 숨김 quick actions.
    it("v0.204: 「전체 숨김」 → 0/4 · 「전체 표시」 → 4/4 · localStorage 저장", async () => {
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("accounts-column-menu-btn"));
      fireEvent.click(screen.getByTestId("accounts-column-hide-all"));
      expect(screen.getByTestId("accounts-column-menu-btn").textContent).toBe(
        "컬럼 표시 (0 / 4)",
      );
      fireEvent.click(screen.getByTestId("accounts-column-show-all"));
      expect(screen.getByTestId("accounts-column-menu-btn").textContent).toBe(
        "컬럼 표시 (4 / 4)",
      );
      await waitFor(() => {
        const raw = localStorage.getItem("accountsTable.visibleColumns.v1");
        const parsed = JSON.parse(raw!) as string[];
        expect(parsed).toHaveLength(4);
      });
    });

    it("v0.204: 4/4 → 전체 표시 disabled · 0/4 → 전체 숨김 disabled", () => {
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("accounts-column-menu-btn"));
      expect(
        (screen.getByTestId("accounts-column-show-all") as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(
        (screen.getByTestId("accounts-column-hide-all") as HTMLButtonElement).disabled,
      ).toBe(false);
      fireEvent.click(screen.getByTestId("accounts-column-hide-all"));
      expect(
        (screen.getByTestId("accounts-column-show-all") as HTMLButtonElement).disabled,
      ).toBe(false);
      expect(
        (screen.getByTestId("accounts-column-hide-all") as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    // v0.205: 「간결」 preset — 이름 컬럼만.
    it("v0.205: 「간결」 클릭 → visibleColumns = [name] · 카운터 1/4 · localStorage 저장", async () => {
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("accounts-column-menu-btn"));
      fireEvent.click(screen.getByTestId("accounts-column-preset-minimal"));
      expect(screen.getByTestId("accounts-column-menu-btn").textContent).toBe(
        "컬럼 표시 (1 / 4)",
      );
      expect(screen.getByTestId("accounts-sort-name")).toBeDefined();
      expect(screen.queryByTestId("accounts-sort-orgUnitPath")).toBeNull();
      await waitFor(() => {
        const raw = localStorage.getItem("accountsTable.visibleColumns.v1");
        const parsed = JSON.parse(raw!) as string[];
        expect(parsed).toEqual(["name"]);
      });
    });

    it("v0.205: 「간결」 이미 활성 상태면 disabled", () => {
      localStorage.setItem(
        "accountsTable.visibleColumns.v1",
        JSON.stringify(["name"]),
      );
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("accounts-column-menu-btn"));
      expect(
        (screen.getByTestId("accounts-column-preset-minimal") as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    // v0.207: 선호 초기화 — sort · pageSize · visibleColumns 모두 default.
    it("v0.207: 「선호 초기화」 → localStorage 3 키 제거 · state 재설정", async () => {
      localStorage.setItem("accountsTable.sort.v1", JSON.stringify({ sort: "email", dir: "desc" }));
      localStorage.setItem("accountsTable.pageSize.v1", "50");
      localStorage.setItem("accountsTable.visibleColumns.v1", JSON.stringify(["name"]));
      mockUseUsersList.mockReturnValue({
        data: { users: sampleUsers },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<AccountsTable />);
      fireEvent.click(screen.getByTestId("accounts-column-menu-btn"));
      expect(screen.getByTestId("accounts-column-menu-btn").textContent).toBe(
        "컬럼 표시 (1 / 4)",
      );
      expect(
        (screen.getByTestId("accounts-page-size-select") as HTMLSelectElement).value,
      ).toBe("50");
      // 선호 초기화 클릭.
      fireEvent.click(screen.getByTestId("accounts-reset-user-prefs"));
      await waitFor(() => {
        expect(localStorage.getItem("accountsTable.sort.v1")).toBeNull();
        expect(localStorage.getItem("accountsTable.pageSize.v1")).toBeNull();
        expect(localStorage.getItem("accountsTable.visibleColumns.v1")).toBeNull();
      });
      expect(
        (screen.getByTestId("accounts-page-size-select") as HTMLSelectElement).value,
      ).toBe("25");
      // 메뉴는 자동 닫힘 → 다시 열어서 컬럼 4/4 확인.
      fireEvent.click(screen.getByTestId("accounts-column-menu-btn"));
      expect(screen.getByTestId("accounts-column-menu-btn").textContent).toBe(
        "컬럼 표시 (4 / 4)",
      );
    });
  });
});


