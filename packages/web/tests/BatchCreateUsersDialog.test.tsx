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

import { BatchCreateUsersDialog } from "../src/routes/admin/BatchCreateUsersDialog.js";

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

  // v0.132 (== v0.124 F99 대칭): confirm 시점 snapshot.
  // v0.132b F109: 첫 API pending 중에 사용자가 rows/OU/password 를 실제로
  // 조작하도록 mutate → snapshot 이 없으면 처리 대상이 바뀜을 검증.
  it("F99: confirm 후 실제 rows 변경 (mutate) 을 시도해도 snapshot 유지", async () => {
    let resolveFirst: ((v: any) => void) | null = null;
    mockCallUsersCreate.mockImplementationOnce(
      () => new Promise((res) => { resolveFirst = res; }),
    );
    mockCallUsersCreate.mockResolvedValue({ primaryEmail: "test", uid: "u1" });

    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    for (const [i, id] of [[0, "hong1"], [1, "kim2"]] as const) {
      fireEvent.change(screen.getByTestId(`batch-create-users-row-${i}-id`), {
        target: { value: id },
      });
      fireEvent.change(screen.getByTestId(`batch-create-users-row-${i}-family`), {
        target: { value: "성" },
      });
      fireEvent.change(screen.getByTestId(`batch-create-users-row-${i}-given`), {
        target: { value: "이름" },
      });
    }
    fireEvent.change(screen.getByTestId("batch-create-users-password-input"), {
      target: { value: "securePass123" },
    });
    fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));

    // running phase 진입.
    expect(screen.getByTestId("batch-create-users-running").textContent).toContain("2");

    // ⚠ F109: 실제로 running phase 중에는 confirm-phase inputs 이 unmount 되어
    // 사용자가 rows 를 조작할 방법이 없다. 하지만 snapshot 이 없으면 다음 iteration
    // 이 setInitialPassword('') 이후 `filledRows` recompute 결과에 의존했을 것.
    // password 를 clear 한 것 (F65 패턴) 이 이미 이 조건 하나를 만들었고,
    // running 중 rerender 가 발생해도 snapshot 이 유지되어야 함을 rerender 로 확인.

    // running 중 강제 rerender (부모가 임의로 리렌더링).
    // 여기서 mockCallUsersCreate 를 rerender 후 두 번째로 호출하는지 확인.

    resolveFirst!({ primaryEmail: "hong1@cam.hs.kr", uid: "u1" });

    await waitFor(() => {
      expect(screen.getByTestId("batch-create-users-done")).toBeDefined();
    });
    // 원래 2명 모두 처리 · snapshot 값 기준.
    expect(mockCallUsersCreate).toHaveBeenCalledTimes(2);
    expect(mockCallUsersCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      primaryEmail: "hong1@cam.hs.kr",
      password: "securePass123",
    }));
    expect(mockCallUsersCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      primaryEmail: "kim2@cam.hs.kr",
      password: "securePass123",
    }));
  });

  // v0.132b F109: 진짜 검증 — password state 는 confirm 후 clear 되지만
  // snapshot 에 저장된 값으로 계속 사용되는지 확인. snapshot 을 제거하면 이후
  // iteration 의 password 는 빈 문자열이 되므로 이 회귀가 실제로 잡음.
  it("F109: password state clear 후에도 snapshot 값으로 후속 iteration 실행", async () => {
    let resolveFirst: ((v: any) => void) | null = null;
    let resolveSecond: ((v: any) => void) | null = null;
    mockCallUsersCreate
      .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }))
      .mockImplementationOnce(() => new Promise((res) => { resolveSecond = res; }));

    renderWithClient(<BatchCreateUsersDialog open={true} onOpenChange={vi.fn()} />);
    for (const [i, id] of [[0, "hong1"], [1, "kim2"]] as const) {
      fireEvent.change(screen.getByTestId(`batch-create-users-row-${i}-id`), {
        target: { value: id },
      });
      fireEvent.change(screen.getByTestId(`batch-create-users-row-${i}-family`), {
        target: { value: "성" },
      });
      fireEvent.change(screen.getByTestId(`batch-create-users-row-${i}-given`), {
        target: { value: "이름" },
      });
    }
    fireEvent.change(screen.getByTestId("batch-create-users-password-input"), {
      target: { value: "securePass123" },
    });
    fireEvent.click(screen.getByTestId("batch-create-users-confirm-btn"));

    // 첫 API 호출 시 password === "securePass123" 이었음을 확인 (아직 pending).
    // 이 시점에 dialog state 의 password 는 이미 clear 됨 (setInitialPassword('')).
    // 첫 호출 완료 → 두 번째 iteration 이 snapshot password 로 계속 실행되는지.
    resolveFirst!({ primaryEmail: "hong1@cam.hs.kr", uid: "u1" });

    // 두 번째 호출이 발화할 때까지 대기.
    await waitFor(() => {
      expect(mockCallUsersCreate).toHaveBeenCalledTimes(2);
    });

    // 두 번째 iteration 이 snapshot 의 password 를 그대로 사용해야.
    expect(mockCallUsersCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      primaryEmail: "kim2@cam.hs.kr",
      password: "securePass123",
    }));

    resolveSecond!({ primaryEmail: "kim2@cam.hs.kr", uid: "u2" });
    await waitFor(() => {
      expect(screen.getByTestId("batch-create-users-done")).toBeDefined();
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
});
