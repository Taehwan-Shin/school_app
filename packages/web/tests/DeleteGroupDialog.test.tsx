import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock("../src/api/groupsDelete.js", () => ({
  useDeleteGroup: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { DeleteGroupDialog } from "../src/routes/admin/DeleteGroupDialog.js";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("DeleteGroupDialog component", () => {
  const targetGroup = {
    email: "team-a@cam.hs.kr",
    name: "Team A",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  // 1. 렌더
  it("renders target group info and disabled delete button initially", () => {
    renderWithRouter(<DeleteGroupDialog open={true} onOpenChange={vi.fn()} group={targetGroup} />);

    expect(screen.getByText("그룹 삭제 확인")).toBeDefined();
    expect(screen.getAllByText("team-a@cam.hs.kr").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Team A")).toBeDefined();

    const deleteBtn = screen.getByTestId("delete-group-submit") as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);
  });

  // 2. 이메일 재입력 검증
  it("enables delete button only when typed email matches target email exactly", () => {
    renderWithRouter(<DeleteGroupDialog open={true} onOpenChange={vi.fn()} group={targetGroup} />);

    const input = screen.getByLabelText(/삭제하려면/) as HTMLInputElement;
    const deleteBtn = screen.getByTestId("delete-group-submit") as HTMLButtonElement;

    fireEvent.change(input, { target: { value: "other@cam.hs.kr" } });
    expect(deleteBtn.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "team-a@cam.hs.kr" } });
    expect(deleteBtn.disabled).toBe(false);
  });

  // 3. 성공
  it("submits delete request and closes dialog on success", async () => {
    mockMutateAsync.mockResolvedValueOnce({ email: "team-a@cam.hs.kr", deleted: true });
    const onOpenChange = vi.fn();

    renderWithRouter(<DeleteGroupDialog open={true} onOpenChange={onOpenChange} group={targetGroup} />);

    const input = screen.getByLabelText(/삭제하려면/);
    fireEvent.change(input, { target: { value: "team-a@cam.hs.kr" } });

    const deleteBtn = screen.getByTestId("delete-group-submit");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ email: "team-a@cam.hs.kr" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("calls onSuccess callback after closing dialog on successful deletion", async () => {
    mockMutateAsync.mockResolvedValueOnce({ email: "team-a@cam.hs.kr", deleted: true });
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    renderWithRouter(
      <DeleteGroupDialog
        open={true}
        onOpenChange={onOpenChange}
        group={targetGroup}
        onSuccess={onSuccess}
      />,
    );

    const input = screen.getByLabelText(/삭제하려면/);
    fireEvent.change(input, { target: { value: "team-a@cam.hs.kr" } });

    const deleteBtn = screen.getByTestId("delete-group-submit");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ email: "team-a@cam.hs.kr" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // 4. 오류 매핑
  it("displays server error message when deletion fails", () => {
    mockError = new Error("permission-denied");

    renderWithRouter(<DeleteGroupDialog open={true} onOpenChange={vi.fn()} group={targetGroup} />);

    expect(screen.getByTestId("delete-group-error")).toBeDefined();
    expect(screen.getByText("그룹 삭제 권한이 없거나 스코프가 부족합니다.")).toBeDefined();
  });

  // 5. 취소
  it("resets confirm input when cancel is clicked", () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderWithRouter(
      <DeleteGroupDialog open={true} onOpenChange={onOpenChange} group={targetGroup} />,
    );

    const input = screen.getByLabelText(/삭제하려면/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "team-a@cam.hs.kr" } });

    const cancelBtn = screen.getByText("취소");
    fireEvent.click(cancelBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Reopen dialog to verify reset
    rerender(
      <MemoryRouter>
        <DeleteGroupDialog open={false} onOpenChange={onOpenChange} group={targetGroup} />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <DeleteGroupDialog open={true} onOpenChange={onOpenChange} group={targetGroup} />
      </MemoryRouter>,
    );

    const inputReopened = screen.getByLabelText(/삭제하려면/) as HTMLInputElement;
    expect(inputReopened.value).toBe("");
  });
});
