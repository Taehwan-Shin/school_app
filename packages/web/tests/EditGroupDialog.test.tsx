import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock("../src/api/groupsUpdate.js", () => ({
  useUpdateGroup: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { EditGroupDialog, type EditGroupTarget } from "../src/routes/admin/EditGroupDialog.js";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("EditGroupDialog component", () => {
  const sampleGroup: EditGroupTarget = {
    email: "teachers@cam.hs.kr",
    name: "교사 전체",
    description: "교직원 안내용 그룹",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  // 1. group 없음 / open false
  it("does not render dialog content when open is false", () => {
    renderWithRouter(<EditGroupDialog open={false} onOpenChange={vi.fn()} group={null} />);
    expect(screen.queryByText("그룹 편집")).toBeNull();
  });

  // 2. pre-fill
  it("renders dialog and pre-fills group data with email read-only", () => {
    renderWithRouter(<EditGroupDialog open={true} onOpenChange={vi.fn()} group={sampleGroup} />);

    expect(screen.getByText("그룹 편집")).toBeDefined();
    expect(screen.getByText("그룹 이름과 설명을 수정합니다")).toBeDefined();

    // 이메일: 읽기 전용 텍스트
    const emailEl = screen.getByTestId("edit-group-email");
    expect(emailEl.textContent).toBe("teachers@cam.hs.kr");

    // 이름, 설명 필드 pre-fill 확인
    const nameInput = screen.getByLabelText(/이름 \*/) as HTMLInputElement;
    const descInput = screen.getByLabelText(/설명/) as HTMLInputElement;

    expect(nameInput.value).toBe("교사 전체");
    expect(descInput.value).toBe("교직원 안내용 그룹");
    expect(screen.getByTestId("edit-group-submit")).toBeDefined();
  });

  // 3. 변경 없음 검증
  it("shows validation error banner when attempting to submit with no changes", async () => {
    renderWithRouter(<EditGroupDialog open={true} onOpenChange={vi.fn()} group={sampleGroup} />);

    fireEvent.click(screen.getByTestId("edit-group-submit"));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("edit-group-error")).toBeDefined();
    expect(screen.getByText("변경된 내용이 없습니다.")).toBeDefined();
  });

  // 4. 성공 (부분 편집 payload)
  it("submits only changed fields (partial update) and closes dialog on success", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      email: "teachers@cam.hs.kr",
      updatedFields: ["name"],
    });
    const onOpenChange = vi.fn();

    renderWithRouter(<EditGroupDialog open={true} onOpenChange={onOpenChange} group={sampleGroup} />);

    const nameInput = screen.getByLabelText(/이름 \*/);
    fireEvent.change(nameInput, { target: { value: "전체 교직원" } });

    fireEvent.click(screen.getByTestId("edit-group-submit"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: "teachers@cam.hs.kr",
        name: "전체 교직원",
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // 5. permission-denied 매핑
  it("displays mapped permission-denied error message when mutation throws permission-denied", () => {
    mockError = new Error("permission-denied");

    renderWithRouter(<EditGroupDialog open={true} onOpenChange={vi.fn()} group={sampleGroup} />);

    expect(screen.getByTestId("edit-group-error")).toBeDefined();
    expect(screen.getByText("그룹 편집 권한이 없습니다.")).toBeDefined();
  });

  // v0.180: name 60자 상한 검증 (CreateGroup 대칭).
  describe("v0.180: name limit 60자", () => {
    it("이름이 60자 초과이면 validation error · mutate 미호출", () => {
      renderWithRouter(<EditGroupDialog open={true} onOpenChange={vi.fn()} group={sampleGroup} />);
      fireEvent.change(screen.getByLabelText(/이름 \*/), { target: { value: "A".repeat(61) } });
      fireEvent.click(screen.getByTestId("edit-group-submit"));
      expect(mockMutateAsync).not.toHaveBeenCalled();
      const err = screen.getByTestId("edit-group-error");
      expect(err.textContent).toContain("이름은 60자 이하");
      expect(err.textContent).toContain("현재 61자");
    });

    it("카운터는 pre-fill 반영 · 60자 정확 정상 · 61자 red", () => {
      renderWithRouter(<EditGroupDialog open={true} onOpenChange={vi.fn()} group={sampleGroup} />);
      const counter = screen.getByTestId("edit-group-name-counter");
      // pre-filled 「교사 전체」 = 5자
      expect(counter.textContent).toContain("5 / 60");
      fireEvent.change(screen.getByLabelText(/이름 \*/), { target: { value: "X".repeat(60) } });
      expect(counter.textContent).toContain("60 / 60");
      expect(counter.className).not.toContain("text-state-danger");
      fireEvent.change(screen.getByLabelText(/이름 \*/), { target: { value: "X".repeat(61) } });
      expect(counter.textContent).toContain("61 / 60");
      expect(counter.className).toContain("text-state-danger");
    });

    it("60자 정확이면 mutate 정상 호출 (경계 케이스)", async () => {
      mockMutateAsync.mockResolvedValueOnce({ email: "teachers@cam.hs.kr", updatedFields: ["name"] });
      renderWithRouter(<EditGroupDialog open={true} onOpenChange={vi.fn()} group={sampleGroup} />);
      fireEvent.change(screen.getByLabelText(/이름 \*/), { target: { value: "A".repeat(60) } });
      fireEvent.click(screen.getByTestId("edit-group-submit"));
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          email: "teachers@cam.hs.kr",
          name: "A".repeat(60),
        });
      });
    });
  });
});
