import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock("../src/api/groupsCreate.js", () => ({
  useCreateGroup: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { CreateGroupDialog } from "../src/routes/admin/CreateGroupDialog.js";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("CreateGroupDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  // 1. 렌더
  it("renders dialog fields when open", () => {
    renderWithRouter(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Google Workspace 그룹 추가")).toBeDefined();
    expect(screen.getByLabelText(/이메일/)).toBeDefined();
    expect(screen.getByLabelText(/이름/)).toBeDefined();
    expect(screen.getByLabelText(/설명/)).toBeDefined();
    expect(screen.getByTestId("create-group-submit")).toBeDefined();
  });

  // 2. 검증 (이메일 도메인 · 이름 필수)
  it("validates email domain and required name", async () => {
    renderWithRouter(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);

    // Test invalid domain
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "invalid@other.com" } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "Team A" } });
    fireEvent.click(screen.getByTestId("create-group-submit"));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("create-group-error")).toBeDefined();
    expect(screen.getByText("이메일은 @cam.hs.kr 도메인이어야 합니다.")).toBeDefined();

    // Test empty name
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "team-a@cam.hs.kr" } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("create-group-submit"));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("create-group-error")).toBeDefined();
    expect(screen.getByText("이름을 입력해주세요.")).toBeDefined();
  });

  // 3. 성공
  it("submits valid group data and closes dialog on success", async () => {
    mockMutateAsync.mockResolvedValueOnce({ email: "team-a@cam.hs.kr", id: "gid-123" });
    const onOpenChange = vi.fn();

    renderWithRouter(<CreateGroupDialog open={true} onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "team-a@cam.hs.kr" } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "Team A" } });
    fireEvent.change(screen.getByLabelText(/설명/), { target: { value: "Description for Team A" } });

    fireEvent.click(screen.getByTestId("create-group-submit"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: "team-a@cam.hs.kr",
        name: "Team A",
        description: "Description for Team A",
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // 4. permission-denied 매핑
  it("displays mapped permission-denied error message when mutation fails", () => {
    mockError = new Error("permission-denied");

    renderWithRouter(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByTestId("create-group-error")).toBeDefined();
    expect(screen.getByText("그룹 생성 권한이 없거나 스코프가 부족합니다.")).toBeDefined();
  });

  // 5. 취소 리셋
  it("resets input fields when cancel is clicked", () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderWithRouter(
      <CreateGroupDialog open={true} onOpenChange={onOpenChange} />,
    );

    const emailInput = screen.getByLabelText(/이메일/) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/이름/) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: "team-a@cam.hs.kr" } });
    fireEvent.change(nameInput, { target: { value: "Team A" } });

    const cancelBtn = screen.getByText("취소");
    fireEvent.click(cancelBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Reopen dialog to verify reset
    rerender(
      <MemoryRouter>
        <CreateGroupDialog open={false} onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <CreateGroupDialog open={true} onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );

    const emailInputReopened = screen.getByLabelText(/이메일/) as HTMLInputElement;
    const nameInputReopened = screen.getByLabelText(/이름/) as HTMLInputElement;
    expect(emailInputReopened.value).toBe("");
    expect(nameInputReopened.value).toBe("");
  });
});
