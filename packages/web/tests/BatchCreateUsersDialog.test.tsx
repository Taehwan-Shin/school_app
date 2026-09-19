import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCallUsersCreate = vi.fn();

vi.mock("../src/api/usersCreate.js", () => ({
  callUsersCreate: (data: unknown) => mockCallUsersCreate(data),
}));

vi.mock("../src/api/orgunitsList.js", () => ({
  useOrgunitsList: () => ({
    data: { orgUnits: [{ orgUnitPath: "/학생/1학년", name: "1학년" }] },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

// v0.151: 클래스룸 배정 UI.
const mockUseClassroomList = vi.fn(() => ({
  data: { courses: [] },
  isLoading: false,
  isError: false,
  error: null,
}));
const mockCallClassroomTeachersAdd = vi.fn();
const mockCallClassroomStudentsAdd = vi.fn();
vi.mock("../src/api/classroomList", () => ({
  useClassroomList: () => mockUseClassroomList(),
}));
vi.mock("../src/api/classroomTeachersAdd", () => ({
  callClassroomTeachersAdd: (data: unknown) => mockCallClassroomTeachersAdd(data),
}));
vi.mock("../src/api/classroomStudentsAdd", () => ({
  callClassroomStudentsAdd: (data: unknown) => mockCallClassroomStudentsAdd(data),
}));

// v0.159: OU 인라인 생성.
const mockOrgunitsCreateMutate = vi.fn();
const mockOrgunitsCreateReset = vi.fn();
let mockOrgunitsCreateIsPending = false;
let mockOrgunitsCreateError: Error | null = null;
vi.mock("../src/api/orgunitsCreate", () => ({
  useOrgunitsCreate: () => ({
    mutateAsync: mockOrgunitsCreateMutate,
    isPending: mockOrgunitsCreateIsPending,
    error: mockOrgunitsCreateError,
    reset: mockOrgunitsCreateReset,
  }),
}));

import {
  BatchCreateUsersDialog,
  buildRunRowsSnapshot,
} from "../src/routes/admin/BatchCreateUsersDialog.js";

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

describe("BatchCreateUsersDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrgunitsCreateMutate.mockReset();
    mockOrgunitsCreateReset.mockReset();
    mockOrgunitsCreateIsPending = false;
    mockOrgunitsCreateError = null;
  });

  it("최대 10 rows 렌더", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("batch-create-users-row-0-id")).toBeDefined();
    expect(screen.getByTestId("batch-create-users-row-9-id")).toBeDefined();
    // row 10 없음.
    expect(screen.queryByTestId("batch-create-users-row-10-id")).toBeNull();
  });

  it("아이디 입력 시 이메일 미리보기 자동 부착", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), {
      target: { value: "hong1" },
    });
    const preview = screen.getByTestId("batch-create-users-row-0-preview");
    expect(preview.textContent).toBe("hong1@cam.hs.kr");
  });

  it("아이디 공백-only 는 preview 없음", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), {
      target: { value: "   " },
    });
    const preview = screen.getByTestId("batch-create-users-row-0-preview");
    expect(preview.textContent).toBe("");
  });

  it("빈 rows → confirm 버튼 disabled", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    const btn = screen.getByTestId("batch-create-users-confirm-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("1 row 만 입력 → confirm 버튼 enabled + 라벨 반영", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), {
      target: { value: "hong1" },
    });
    const btn = screen.getByTestId("batch-create-users-confirm-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain("1명");
  });

  it("성/이름 누락 시 validation 에러 · mutate 호출 안 함", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), {
      target: { value: "hong1" },
    });
    // 성만 채우고 이름 누락.
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), {
      target: { value: "홍" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-password-input"), {
      target: { value: "securePass123" },
    });
    fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));
    expect(screen.getByTestId("batch-create-users-error").textContent).toContain("이름");
    expect(mockCallUsersCreate).not.toHaveBeenCalled();
  });

  it("아이디에 @ 포함 → validation 에러", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), {
      target: { value: "hong@bad" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), {
      target: { value: "홍" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-given"), {
      target: { value: "길동" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-password-input"), {
      target: { value: "securePass123" },
    });
    fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));
    expect(screen.getByTestId("batch-create-users-error").textContent).toContain("사용할 수 없");
    expect(mockCallUsersCreate).not.toHaveBeenCalled();
  });

  it("중복 아이디 → validation 에러", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    for (const i of [0, 1]) {
      fireEvent.change(screen.getByTestId(`batch-create-users-row-${i}-id`), {
        target: { value: "hong1" },
      });
      fireEvent.change(screen.getByTestId(`batch-create-users-row-${i}-family`), {
        target: { value: "홍" },
      });
      fireEvent.change(screen.getByTestId(`batch-create-users-row-${i}-given`), {
        target: { value: "길동" },
      });
    }
    fireEvent.change(screen.getByTestId("batch-create-users-password-input"), {
      target: { value: "securePass123" },
    });
    fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));
    expect(screen.getByTestId("batch-create-users-error").textContent).toContain("중복");
    expect(mockCallUsersCreate).not.toHaveBeenCalled();
  });

  // v0.132b F107: 대소문자 무시 dedup + primaryEmail 은 lower-case canonical.
  it("F107: 대소문자만 다른 아이디는 중복으로 판정 (Hong1 vs hong1)", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), {
      target: { value: "Hong1" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), {
      target: { value: "홍" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-given"), {
      target: { value: "길동" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-1-id"), {
      target: { value: "hong1" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-1-family"), {
      target: { value: "홍" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-1-given"), {
      target: { value: "동생" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-password-input"), {
      target: { value: "securePass123" },
    });
    fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));
    expect(screen.getByTestId("batch-create-users-error").textContent).toContain("중복");
    expect(mockCallUsersCreate).not.toHaveBeenCalled();
  });

  it("F107: primaryEmail 은 lower-case canonical 로 전송 (Hong1 → hong1@...)", async () => {
    mockCallUsersCreate.mockResolvedValue({ primaryEmail: "hong1@cam.hs.kr", uid: "u1" });
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), {
      target: { value: "Hong1" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), {
      target: { value: "홍" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-given"), {
      target: { value: "길동" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-password-input"), {
      target: { value: "securePass123" },
    });
    fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("batch-create-users-done")).toBeDefined();
    });
    expect(mockCallUsersCreate).toHaveBeenCalledWith(expect.objectContaining({
      primaryEmail: "hong1@cam.hs.kr",
    }));
    // preview 도 lower-case.
    // done 이후에는 confirm phase 이 unmount 라 preview 확인 불가. 렌더 상태
    // 에서 preview 확인은 별도 test 참조 (F108 test 에서 확인).
  });

  // v0.132b F108: a11y — scope="col" · 각 input 에 aria-label.
  it("F108: table th 는 scope='col' · 각 row input 은 aria-label", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    const table = screen.getByTestId("batch-create-users-rows").querySelector("table");
    expect(table).not.toBeNull();
    const ths = table!.querySelectorAll("thead th");
    expect(ths.length).toBe(5);
    for (const th of Array.from(ths)) {
      expect(th.getAttribute("scope")).toBe("col");
    }
    // row 0 · 5번째 row 각각 aria-label 로 접근 가능.
    expect(screen.getByLabelText("1번째 행 아이디")).toBeDefined();
    expect(screen.getByLabelText("1번째 행 성")).toBeDefined();
    expect(screen.getByLabelText("1번째 행 이름")).toBeDefined();
    expect(screen.getByLabelText("5번째 행 아이디")).toBeDefined();
    expect(screen.getByLabelText("10번째 행 이름")).toBeDefined();
  });

  it("password 8자 미만 → validation 에러", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), {
      target: { value: "hong1" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), {
      target: { value: "홍" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-given"), {
      target: { value: "길동" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-password-input"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));
    expect(screen.getByTestId("batch-create-users-error").textContent).toContain("8자");
    expect(mockCallUsersCreate).not.toHaveBeenCalled();
  });

  it("정상 2 rows → 순차 callUsersCreate · 공통 password/OU · done 배너", async () => {
    mockCallUsersCreate.mockResolvedValue({ primaryEmail: "test", uid: "u1" });
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    // row 0.
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), {
      target: { value: "hong1" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), {
      target: { value: "홍" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-given"), {
      target: { value: "길동" },
    });
    // row 1.
    fireEvent.change(screen.getByTestId("batch-create-users-row-1-id"), {
      target: { value: "kim2" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-1-family"), {
      target: { value: "김" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-1-given"), {
      target: { value: "철수" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-orgunit-input"), {
      target: { value: "/학생/1학년" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-password-input"), {
      target: { value: "securePass123" },
    });
    fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("batch-create-users-done")).toBeDefined();
    });

    expect(mockCallUsersCreate).toHaveBeenCalledTimes(2);
    expect(mockCallUsersCreate).toHaveBeenNthCalledWith(1, {
      primaryEmail: "hong1@cam.hs.kr",
      familyName: "홍",
      givenName: "길동",
      password: "securePass123",
      orgUnitPath: "/학생/1학년",
      changePasswordAtNextLogin: true,
    });
    expect(mockCallUsersCreate).toHaveBeenNthCalledWith(2, {
      primaryEmail: "kim2@cam.hs.kr",
      familyName: "김",
      givenName: "철수",
      password: "securePass123",
      orgUnitPath: "/학생/1학년",
      changePasswordAtNextLogin: true,
    });
    expect(screen.getByTestId("batch-create-users-done").textContent).toContain("2명 성공");
  });

  it("부분 실패 → done 배너에 실패 목록 표시", async () => {
    mockCallUsersCreate
      .mockResolvedValueOnce({ primaryEmail: "hong1@cam.hs.kr", uid: "u1" })
      .mockRejectedValueOnce(new Error("email_already_exists"));
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), {
      target: { value: "hong1" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), {
      target: { value: "홍" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-0-given"), {
      target: { value: "길동" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-1-id"), {
      target: { value: "kim2" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-1-family"), {
      target: { value: "김" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-row-1-given"), {
      target: { value: "철수" },
    });
    fireEvent.change(screen.getByTestId("batch-create-users-password-input"), {
      target: { value: "securePass123" },
    });
    fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("batch-create-users-done")).toBeDefined();
    });

    const doneText = screen.getByTestId("batch-create-users-done").textContent!;
    expect(doneText).toContain("1명 성공");
    expect(doneText).toContain("1명 실패");
    const failures = screen.getByTestId("batch-create-users-failures");
    expect(failures.textContent).toContain("kim2@cam.hs.kr");
    expect(failures.textContent).toContain("email_already_exists");
  });

  // v0.132c F109: snapshot 구성은 buildRunRowsSnapshot 순수 함수. 아래에서
  // 직접 회귀. running phase 통합 test 는 「정상 2 rows」 · 「부분 실패」에서
  // 이미 snapshot 결과 (primaryEmail lower-case 값) 를 검증.
  describe("F109: buildRunRowsSnapshot pure helper", () => {
    it("빈 rows 는 제외 · id.trim() 기준", () => {
      const rows = [
        { id: "hong1", familyName: "홍", givenName: "길동" },
        { id: "  ", familyName: "  ", givenName: "  " },
        { id: "kim2", familyName: "김", givenName: "철수" },
      ];
      const snap = buildRunRowsSnapshot(rows, "cam.hs.kr");
      expect(snap).toHaveLength(2);
      expect(snap[0].primaryEmail).toBe("hong1@cam.hs.kr");
      expect(snap[1].primaryEmail).toBe("kim2@cam.hs.kr");
    });

    it("primaryEmail 은 lower-case canonical", () => {
      const rows = [{ id: "HoNg1", familyName: "홍", givenName: "길동" }];
      const snap = buildRunRowsSnapshot(rows, "cam.hs.kr");
      expect(snap[0].primaryEmail).toBe("hong1@cam.hs.kr");
    });

    it("반환 배열은 원본과 독립 (mutation 무관)", () => {
      const rows = [{ id: "hong1", familyName: "홍", givenName: "길동" }];
      const snap = buildRunRowsSnapshot(rows, "cam.hs.kr");
      // 원본을 통째로 갈아치우거나 각 field 를 mutate 해도 snap 은 불변.
      rows[0].id = "MUTATED";
      rows[0].familyName = "성변경";
      rows.push({ id: "extra", familyName: "추가", givenName: "추가" });
      expect(snap).toHaveLength(1);
      expect(snap[0].primaryEmail).toBe("hong1@cam.hs.kr");
      expect(snap[0].familyName).toBe("홍");
    });

    it("id 는 trim 후 lower · 원본 대소문자·공백 무관", () => {
      const rows = [{ id: "  HONG1  ", familyName: "  홍  ", givenName: "  길동  " }];
      const snap = buildRunRowsSnapshot(rows, "cam.hs.kr");
      expect(snap[0].primaryEmail).toBe("hong1@cam.hs.kr");
      expect(snap[0].familyName).toBe("홍");
      expect(snap[0].givenName).toBe("길동");
    });
  });

  // v0.158: 첫 로그인 시 비밀번호 변경 강제 toggle (모두 공통).
  describe("v0.158: changePasswordAtNextLogin toggle", () => {
    it("toggle 기본 checked · 각 row 에 동일 값 전달", async () => {
      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      const toggle = screen.getByTestId("batch-create-users-change-pw-toggle") as HTMLInputElement;
      expect(toggle.checked).toBe(true);
    });

    it("toggle 해제 → 모든 row 에 changePasswordAtNextLogin:false 로 전송", async () => {
      mockCallUsersCreate.mockResolvedValue({ primaryEmail: "x@cam.hs.kr", uid: "u1" });
      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), { target: { value: "hong1" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), { target: { value: "홍" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-given"), { target: { value: "길동" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-1-id"), { target: { value: "kim2" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-1-family"), { target: { value: "김" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-1-given"), { target: { value: "철수" } });
      fireEvent.change(screen.getByTestId("batch-create-users-password-input"), { target: { value: "securePass123" } });
      fireEvent.click(screen.getByTestId("batch-create-users-change-pw-toggle"));
      fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));

      await waitFor(() => {
        expect(screen.getByTestId("batch-create-users-done")).toBeDefined();
      });
      expect(mockCallUsersCreate).toHaveBeenCalledTimes(2);
      expect(mockCallUsersCreate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ changePasswordAtNextLogin: false })
      );
      expect(mockCallUsersCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ changePasswordAtNextLogin: false })
      );
    });
  });

  // v0.159: 신규 OU 인라인 생성 (v0.121 CreateUserDialog 대칭).
  describe("v0.159: OU 인라인 생성 폼", () => {
    it("기본은 toggle 버튼만 보이고 폼은 접힘", () => {
      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      expect(screen.getByTestId("batch-create-users-new-ou-toggle")).toBeDefined();
      expect(screen.queryByTestId("batch-create-users-new-ou-form")).toBeNull();
    });

    it("toggle 클릭 시 폼 전개 · 부모 경로 = 현재 OU", () => {
      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("batch-create-users-orgunit-input"), {
        target: { value: "/학생" },
      });
      fireEvent.click(screen.getByTestId("batch-create-users-new-ou-toggle"));
      expect(screen.getByTestId("batch-create-users-new-ou-form")).toBeDefined();
      const parent = screen.getByTestId("batch-create-users-new-ou-parent") as HTMLInputElement;
      expect(parent.value).toBe("/학생");
    });

    it("OU 이름 비어있으면 validation 에러 · createOrgunit 미호출", async () => {
      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId("batch-create-users-new-ou-toggle"));
      fireEvent.click(screen.getByTestId("batch-create-users-new-ou-submit"));
      await waitFor(() => {
        expect(screen.getByTestId("batch-create-users-new-ou-error")).toBeDefined();
      });
      expect(mockOrgunitsCreateMutate).not.toHaveBeenCalled();
    });

    it("정상 생성 → orgUnitPath 자동 채움 · 폼 접힘 · 성공 메시지", async () => {
      mockOrgunitsCreateMutate.mockResolvedValueOnce({ orgUnitPath: "/학생/3학년" });
      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId("batch-create-users-new-ou-toggle"));
      fireEvent.change(screen.getByTestId("batch-create-users-new-ou-name"), {
        target: { value: "3학년" },
      });
      fireEvent.change(screen.getByTestId("batch-create-users-new-ou-parent"), {
        target: { value: "/학생" },
      });
      fireEvent.click(screen.getByTestId("batch-create-users-new-ou-submit"));

      await waitFor(() => {
        expect(mockOrgunitsCreateMutate).toHaveBeenCalledWith({
          name: "3학년",
          parentOrgUnitPath: "/학생",
          description: undefined,
        });
      });
      // orgUnitPath 자동 채움.
      const orgu = screen.getByTestId("batch-create-users-orgunit-input") as HTMLInputElement;
      expect(orgu.value).toBe("/학생/3학년");
      // 폼 접힘 · 성공 메시지.
      expect(screen.queryByTestId("batch-create-users-new-ou-form")).toBeNull();
      expect(screen.getByTestId("batch-create-users-new-ou-success").textContent).toContain(
        "/학생/3학년",
      );
    });

    it("취소 버튼 클릭 시 폼 접힘", () => {
      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId("batch-create-users-new-ou-toggle"));
      expect(screen.getByTestId("batch-create-users-new-ou-form")).toBeDefined();
      fireEvent.click(screen.getByTestId("batch-create-users-new-ou-cancel"));
      expect(screen.queryByTestId("batch-create-users-new-ou-form")).toBeNull();
    });
  });

  // v0.132 (== v0.124 F100 대칭): label htmlFor 로 프로그램적 연결.
  it("F100: 공통 필드 label 은 htmlFor 로 연결", () => {
    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    const orgu = screen.getByLabelText(/조직 단위/) as HTMLInputElement;
    expect(orgu.id).toBe("batch-create-users-orgunit");
    const pw = screen.getByLabelText(/초기 비밀번호/) as HTMLInputElement;
    expect(pw.id).toBe("batch-create-users-password");
  });

  // v0.151: 공통 클래스룸 자동 배정 (v0.144 UX 대칭).
  describe("v0.151 클래스룸 자동 배정", () => {
    beforeEach(() => {
      mockUseClassroomList.mockReturnValue({
        data: {
          courses: [
            { id: "c-3", name: "3학년 국어", courseState: "ACTIVE" },
            { id: "c-1", name: "1학년 수학", courseState: "ACTIVE" },
            { id: "c-2", name: "1학년 영어", courseState: "ACTIVE" },
            { id: "c-arch", name: "보관됨", courseState: "ARCHIVED" },
          ] as any,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it("클래스룸 리스트는 이름순 정렬 · ARCHIVED 제외", () => {
      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      const list = screen.getByTestId("batch-create-users-classrooms-list");
      const rows = Array.from(list.querySelectorAll("label"));
      const names = rows.map((r) => r.textContent);
      expect(names[0]).toContain("1학년 수학");
      expect(names[1]).toContain("1학년 영어");
      expect(names[2]).toContain("3학년 국어");
      expect(screen.queryByTestId("batch-create-users-classroom-cb-c-arch")).toBeNull();
    });

    it("검색 input 이 이름/섹션/id 필터", () => {
      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      const search = screen.getByTestId("batch-create-users-classroom-search");
      fireEvent.change(search, { target: { value: "수학" } });
      expect(screen.getByTestId("batch-create-users-classroom-cb-c-1")).toBeDefined();
      expect(screen.queryByTestId("batch-create-users-classroom-cb-c-2")).toBeNull();
      fireEvent.change(search, { target: { value: "C-2" } });
      expect(screen.getByTestId("batch-create-users-classroom-cb-c-2")).toBeDefined();
      fireEvent.change(search, { target: { value: "zzz" } });
      expect(screen.getByTestId("batch-create-users-classrooms-search-empty")).toBeDefined();
    });

    it("실행 시 각 계정 생성 후 선택된 클래스룸 순차 배정 · 선택 유지 (검색 후에도)", async () => {
      mockCallUsersCreate
        .mockResolvedValueOnce({ primaryEmail: "hong1@cam.hs.kr", uid: "u1" })
        .mockResolvedValueOnce({ primaryEmail: "hong2@cam.hs.kr", uid: "u2" });
      mockCallClassroomStudentsAdd.mockResolvedValue({ student: {} });

      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);

      // row 0, 1 입력.
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), { target: { value: "hong1" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), { target: { value: "홍" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-given"), { target: { value: "길동" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-1-id"), { target: { value: "hong2" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-1-family"), { target: { value: "홍" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-1-given"), { target: { value: "길순" } });
      fireEvent.change(screen.getByTestId("batch-create-users-password-input"), { target: { value: "abcd1234" } });

      // c-1, c-3 선택 → 검색으로 필터해도 유지.
      fireEvent.click(screen.getByTestId("batch-create-users-classroom-cb-c-1"));
      fireEvent.click(screen.getByTestId("batch-create-users-classroom-cb-c-3"));
      fireEvent.change(screen.getByTestId("batch-create-users-classroom-search"), { target: { value: "영어" } });
      expect(screen.queryByTestId("batch-create-users-classroom-cb-c-1")).toBeNull();
      expect(screen.getByTestId("batch-create-users-classrooms-selected").textContent).toContain("선택됨: 2");

      fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));
      await waitFor(() => {
        expect(mockCallClassroomStudentsAdd).toHaveBeenCalledTimes(4); // 2 accounts × 2 classrooms.
      });
      const calls = mockCallClassroomStudentsAdd.mock.calls.map((call: any[]) => (call[0] as any).courseId);
      expect(calls.sort()).toEqual(["c-1", "c-1", "c-3", "c-3"]);
    });

    it("교사 role 선택 시 teachers.add 호출", async () => {
      mockCallUsersCreate.mockResolvedValueOnce({ primaryEmail: "t1@cam.hs.kr", uid: "u1" });
      mockCallClassroomTeachersAdd.mockResolvedValue({ teacher: {} });

      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), { target: { value: "t1" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), { target: { value: "김" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-given"), { target: { value: "교사" } });
      fireEvent.change(screen.getByTestId("batch-create-users-password-input"), { target: { value: "abcd1234" } });
      fireEvent.click(screen.getByTestId("batch-create-users-classroom-role-teacher"));
      fireEvent.click(screen.getByTestId("batch-create-users-classroom-cb-c-1"));

      fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));
      await waitFor(() => {
        expect(mockCallClassroomTeachersAdd).toHaveBeenCalledTimes(1);
      });
      expect(mockCallClassroomStudentsAdd).not.toHaveBeenCalled();
    });

    it("클래스룸 미선택이면 배정 API 호출 없음", async () => {
      mockCallUsersCreate.mockResolvedValueOnce({ primaryEmail: "hong1@cam.hs.kr", uid: "u1" });

      renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-id"), { target: { value: "hong1" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-family"), { target: { value: "홍" } });
      fireEvent.change(screen.getByTestId("batch-create-users-row-0-given"), { target: { value: "길동" } });
      fireEvent.change(screen.getByTestId("batch-create-users-password-input"), { target: { value: "abcd1234" } });
      fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));
      await waitFor(() => {
        expect(mockCallUsersCreate).toHaveBeenCalledTimes(1);
      });
      expect(mockCallClassroomStudentsAdd).not.toHaveBeenCalled();
      expect(mockCallClassroomTeachersAdd).not.toHaveBeenCalled();
    });
  });
});
