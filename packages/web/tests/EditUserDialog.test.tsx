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

let mockOrgunitsQuery: {
  data?: { orgUnits: { orgUnitPath: string; name?: string }[] };
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
} = { data: { orgUnits: [] }, isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn() };

vi.mock("../src/api/orgunitsList.js", () => ({
  useOrgunitsList: () => mockOrgunitsQuery,
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
    mockOrgunitsQuery = { data: { orgUnits: [] }, isLoading: false, isError: false, isFetching: false, error: null, refetch: vi.fn() };
  });

  describe("v0.320: 기존 OU 드롭다운", () => {
    it("OU 목록을 select 로 보여주고 선택 시 입력칸에 반영 · 저장 payload 에 포함", async () => {
      mockOrgunitsQuery.data = {
        orgUnits: [
          { orgUnitPath: "/교사", name: "교사" },
          { orgUnitPath: "/학생/1학년", name: "1학년" },
        ],
      };
      mockMutateAsync.mockResolvedValueOnce({});
      render(<EditUserDialog open={true} onOpenChange={vi.fn()} user={sampleUser} />);
      const select = screen.getByTestId("edit-user-orgunit-select") as HTMLSelectElement;
      // 현재 OU (/교사) 가 목록에 있으면 선택 상태로 표시.
      expect(select.value).toBe("/교사");
      expect(select.options).toHaveLength(3);
      fireEvent.change(select, { target: { value: "/학생/1학년" } });
      expect((screen.getByTestId("edit-user-orgunit-input") as HTMLInputElement).value).toBe("/학생/1학년");
      fireEvent.click(screen.getByTestId("edit-user-submit"));
      await waitFor(() =>
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ orgUnitPath: "/학생/1학년" }),
        ),
      );
    });

    it("직접 입력한 경로가 목록에 없으면 select 는 placeholder · 입력값 유지", () => {
      mockOrgunitsQuery.data = { orgUnits: [{ orgUnitPath: "/교사" }] };
      render(<EditUserDialog open={true} onOpenChange={vi.fn()} user={sampleUser} />);
      const input = screen.getByTestId("edit-user-orgunit-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "/새경로" } });
      expect((screen.getByTestId("edit-user-orgunit-select") as HTMLSelectElement).value).toBe("");
      expect(input.value).toBe("/새경로");
    });

    it("목록 로드 실패 → 에러 메시지 + 다시 시도 · select 비활성 (직접 입력 가능)", () => {
      mockOrgunitsQuery = {
        data: undefined,
        isLoading: false,
        isError: true,
        isFetching: false,
        error: new Error("insufficient_scope:x"),
        refetch: vi.fn(),
      };
      render(<EditUserDialog open={true} onOpenChange={vi.fn()} user={sampleUser} />);
      expect(screen.getByTestId("edit-user-orgunits-error").textContent).toContain("insufficient_scope:x");
      fireEvent.click(screen.getByTestId("edit-user-orgunits-retry"));
      expect(mockOrgunitsQuery.refetch).toHaveBeenCalledTimes(1);
      expect((screen.getByTestId("edit-user-orgunit-select") as HTMLSelectElement).disabled).toBe(true);
      expect((screen.getByTestId("edit-user-orgunit-input") as HTMLInputElement).disabled).toBe(false);
    });
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

  // v0.179: familyName/givenName 60자 상한 검증 (v0.178 Create/Batch 대칭).
  describe("v0.179: name limit 60자", () => {
    it("familyName 이 60자 초과이면 validation error · mutate 미호출", () => {
      render(<EditUserDialog open={true} onOpenChange={vi.fn()} user={sampleUser} />);
      const familyInput = screen.getByLabelText(/성 \*/);
      fireEvent.change(familyInput, { target: { value: "A".repeat(61) } });
      fireEvent.click(screen.getByTestId("edit-user-submit"));
      expect(mockMutateAsync).not.toHaveBeenCalled();
      const err = screen.getByTestId("edit-user-error");
      expect(err.textContent).toContain("성은 최대 60자");
      expect(err.textContent).toContain("현재 61자");
    });

    it("givenName 이 60자 초과이면 validation error · mutate 미호출", () => {
      render(<EditUserDialog open={true} onOpenChange={vi.fn()} user={sampleUser} />);
      const givenInput = screen.getByLabelText(/이름 \*/);
      fireEvent.change(givenInput, { target: { value: "B".repeat(100) } });
      fireEvent.click(screen.getByTestId("edit-user-submit"));
      expect(mockMutateAsync).not.toHaveBeenCalled();
      const err = screen.getByTestId("edit-user-error");
      expect(err.textContent).toContain("이름은 최대 60자");
      expect(err.textContent).toContain("현재 100자");
    });

    it("카운터는 실시간 반영 · 초과 시 red · 60자 정확 정상", () => {
      render(<EditUserDialog open={true} onOpenChange={vi.fn()} user={sampleUser} />);
      const familyCounter = screen.getByTestId("edit-user-familyName-counter");
      const givenCounter = screen.getByTestId("edit-user-givenName-counter");
      // pre-filled 「홍」 = 1자
      expect(familyCounter.textContent).toContain("1 / 60");
      expect(givenCounter.textContent).toContain("2 / 60");
      // 60자 정확
      fireEvent.change(screen.getByLabelText(/성 \*/), { target: { value: "X".repeat(60) } });
      expect(familyCounter.textContent).toContain("60 / 60");
      expect(familyCounter.className).not.toContain("text-state-danger");
      // 61자 초과
      fireEvent.change(screen.getByLabelText(/이름 \*/), { target: { value: "Y".repeat(61) } });
      expect(givenCounter.textContent).toContain("61 / 60");
      expect(givenCounter.className).toContain("text-state-danger");
    });

    it("60자 정확이면 mutate 정상 호출 (경계 케이스)", async () => {
      mockMutateAsync.mockResolvedValueOnce({ primaryEmail: "teacher1@cam.hs.kr", updatedFields: ["lastName"] });
      render(<EditUserDialog open={true} onOpenChange={vi.fn()} user={sampleUser} />);
      fireEvent.change(screen.getByLabelText(/성 \*/), { target: { value: "A".repeat(60) } });
      fireEvent.click(screen.getByTestId("edit-user-submit"));
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          primaryEmail: "teacher1@cam.hs.kr",
          lastName: "A".repeat(60),
        });
      });
    });
  });
});
