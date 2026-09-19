import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCallClassroomTransferOwnership = vi.fn();

vi.mock("../src/api/classroomTransferOwnership.js", () => ({
  callClassroomTransferOwnership: (data: unknown) =>
    mockCallClassroomTransferOwnership(data),
}));

import { BulkTransferClassroomOwnerDialog } from "../src/routes/admin/BulkTransferClassroomOwnerDialog.js";

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

describe("BulkTransferClassroomOwnerDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const courses = [
    { id: "c-1", name: "1학년 수학" },
    { id: "c-2", name: "2학년 영어" },
  ];

  it("email 비어있으면 실행 버튼 disabled", () => {
    renderWithClient(
      <BulkTransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />
    );
    const btn = screen.getByTestId("bulk-transfer-owner-confirm-btn") as HTMLButtonElement;
    // 개수 채워도 email 비었으면 disabled.
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-confirm-input"), {
      target: { value: "2" },
    });
    expect(btn.disabled).toBe(true);
  });

  it("확인 개수 안 맞으면 실행 버튼 disabled", () => {
    renderWithClient(
      <BulkTransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />
    );
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-email-input"), {
      target: { value: "new@cam.hs.kr" },
    });
    const btn = screen.getByTestId("bulk-transfer-owner-confirm-btn") as HTMLButtonElement;
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-confirm-input"), {
      target: { value: "1" },
    });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-confirm-input"), {
      target: { value: "2" },
    });
    expect(btn.disabled).toBe(false);
  });

  it("잘못된 도메인 email → validation 에러 · callable 미호출", async () => {
    renderWithClient(
      <BulkTransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />
    );
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-email-input"), {
      target: { value: "new@gmail.com" },
    });
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-confirm-input"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("bulk-transfer-owner-confirm-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("bulk-transfer-owner-error").textContent).toContain("cam.hs.kr");
    });
    expect(mockCallClassroomTransferOwnership).not.toHaveBeenCalled();
  });

  it("정상 실행 → 각 course 에 순차 호출 · done 배너 성공 count", async () => {
    mockCallClassroomTransferOwnership.mockResolvedValue({
      course: { id: "x" },
      addedAsTeacher: true,
    });
    renderWithClient(
      <BulkTransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />
    );
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-email-input"), {
      target: { value: "new@cam.hs.kr" },
    });
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-confirm-input"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("bulk-transfer-owner-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("bulk-transfer-owner-done")).toBeDefined();
    });
    expect(mockCallClassroomTransferOwnership).toHaveBeenCalledTimes(2);
    expect(mockCallClassroomTransferOwnership).toHaveBeenNthCalledWith(1, {
      courseId: "c-1",
      newOwnerEmail: "new@cam.hs.kr",
    });
    expect(mockCallClassroomTransferOwnership).toHaveBeenNthCalledWith(2, {
      courseId: "c-2",
      newOwnerEmail: "new@cam.hs.kr",
    });
    expect(screen.getByTestId("bulk-transfer-owner-done").textContent).toContain("2");
  });

  it("부분 실패 → done 배너에 실패 목록 · addedTeacherButPatchFailed 경고", async () => {
    const err = new Error("upstream_transfer_failed") as Error & { details?: unknown };
    err.details = { addedTeacherButPatchFailed: true };
    mockCallClassroomTransferOwnership
      .mockResolvedValueOnce({ course: { id: "c-1" }, addedAsTeacher: true })
      .mockRejectedValueOnce(err);
    renderWithClient(
      <BulkTransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />
    );
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-email-input"), {
      target: { value: "new@cam.hs.kr" },
    });
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-confirm-input"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("bulk-transfer-owner-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("bulk-transfer-owner-done")).toBeDefined();
    });
    const failures = screen.getByTestId("bulk-transfer-owner-failures");
    expect(failures.textContent).toContain("2학년 영어");
    expect(failures.textContent).toContain("upstream_transfer_failed");
    expect(failures.textContent).toContain("교사가 남아 있을 수 있음");
  });

  it("F99: confirm 후 부모 courses 변경돼도 snapshot 대로 처리", async () => {
    mockCallClassroomTransferOwnership.mockImplementation(() =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ course: { id: "x" }, addedAsTeacher: true }), 10),
      ),
    );
    const { rerender } = renderWithClient(
      <BulkTransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        courses={courses}
      />
    );
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-email-input"), {
      target: { value: "new@cam.hs.kr" },
    });
    fireEvent.change(screen.getByTestId("bulk-transfer-owner-confirm-input"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("bulk-transfer-owner-confirm-btn"));

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkTransferClassroomOwnerDialog
            open={true}
            onOpenChange={vi.fn()}
            courses={[{ id: "c-99", name: "new" }]}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("bulk-transfer-owner-done")).toBeDefined();
    });
    expect(mockCallClassroomTransferOwnership).toHaveBeenCalledTimes(2);
    const ids = mockCallClassroomTransferOwnership.mock.calls.map((c) => c[0].courseId);
    expect(ids.sort()).toEqual(["c-1", "c-2"]);
  });
});
