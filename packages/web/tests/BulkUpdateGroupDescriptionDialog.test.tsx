import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockCallGroupsUpdate = vi.fn();

vi.mock("../src/api/groupsUpdate.js", () => ({
  callGroupsUpdate: (data: unknown) => mockCallGroupsUpdate(data),
}));

import { BulkUpdateGroupDescriptionDialog } from "../src/routes/admin/BulkUpdateGroupDescriptionDialog.js";

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

describe("BulkUpdateGroupDescriptionDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const emails = ["g1@cam.hs.kr", "g2@cam.hs.kr"];

  it("빈 설명도 실행 허용 (설명 지우기)", async () => {
    mockCallGroupsUpdate.mockResolvedValue({ email: "x", updatedFields: ["description"] });
    renderWithClient(
      <BulkUpdateGroupDescriptionDialog
        open={true}
        onOpenChange={vi.fn()}
        emails={emails}
      />
    );
    // description 빈 채로 실행.
    fireEvent.click(screen.getByTestId("bulk-update-group-description-confirm-btn"));
    await waitFor(() => {
      expect(mockCallGroupsUpdate).toHaveBeenCalledWith({
        email: "g1@cam.hs.kr",
        description: "",
      });
    });
  });

  it("정상 설명 입력 → 각 email 순차 호출 · done 배너 성공 count + 적용 설명", async () => {
    mockCallGroupsUpdate.mockResolvedValue({ email: "x", updatedFields: ["description"] });
    renderWithClient(
      <BulkUpdateGroupDescriptionDialog
        open={true}
        onOpenChange={vi.fn()}
        emails={emails}
      />
    );
    fireEvent.change(screen.getByTestId("bulk-update-group-description-input"), {
      target: { value: "2026학년도 3학년 5반" },
    });
    fireEvent.click(screen.getByTestId("bulk-update-group-description-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("bulk-update-group-description-done")).toBeDefined();
    });
    expect(mockCallGroupsUpdate).toHaveBeenCalledTimes(2);
    expect(mockCallGroupsUpdate).toHaveBeenNthCalledWith(1, {
      email: "g1@cam.hs.kr",
      description: "2026학년도 3학년 5반",
    });
    expect(mockCallGroupsUpdate).toHaveBeenNthCalledWith(2, {
      email: "g2@cam.hs.kr",
      description: "2026학년도 3학년 5반",
    });
    // 적용된 설명 표시.
    expect(
      screen.getByTestId("bulk-update-group-description-applied").textContent,
    ).toContain("2026학년도 3학년 5반");
  });

  it("4096 자 초과 → validation 에러 · 버튼 disabled · callable 미호출", () => {
    renderWithClient(
      <BulkUpdateGroupDescriptionDialog
        open={true}
        onOpenChange={vi.fn()}
        emails={emails}
      />
    );
    fireEvent.change(screen.getByTestId("bulk-update-group-description-input"), {
      target: { value: "x".repeat(4097) },
    });
    const btn = screen.getByTestId(
      "bulk-update-group-description-confirm-btn",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // Even if we somehow click, no callable fire (disabled guard).
    fireEvent.click(btn);
    expect(mockCallGroupsUpdate).not.toHaveBeenCalled();
  });

  it("부분 실패 → done 배너에 실패 목록", async () => {
    mockCallGroupsUpdate
      .mockResolvedValueOnce({ email: "g1@cam.hs.kr", updatedFields: ["description"] })
      .mockRejectedValueOnce(new Error("permission-denied"));
    renderWithClient(
      <BulkUpdateGroupDescriptionDialog
        open={true}
        onOpenChange={vi.fn()}
        emails={emails}
      />
    );
    fireEvent.change(screen.getByTestId("bulk-update-group-description-input"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByTestId("bulk-update-group-description-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("bulk-update-group-description-done")).toBeDefined();
    });
    const failures = screen.getByTestId("bulk-update-group-description-failures");
    expect(failures.textContent).toContain("g2@cam.hs.kr");
    expect(failures.textContent).toContain("permission-denied");
  });

  it("F99: confirm 후 부모 emails·description 변경돼도 snapshot 대로 처리", async () => {
    mockCallGroupsUpdate.mockImplementation(() =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ email: "x", updatedFields: ["description"] }), 10),
      ),
    );
    const { rerender } = renderWithClient(
      <BulkUpdateGroupDescriptionDialog
        open={true}
        onOpenChange={vi.fn()}
        emails={emails}
      />
    );
    fireEvent.change(screen.getByTestId("bulk-update-group-description-input"), {
      target: { value: "original" },
    });
    fireEvent.click(screen.getByTestId("bulk-update-group-description-confirm-btn"));

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkUpdateGroupDescriptionDialog
            open={true}
            onOpenChange={vi.fn()}
            emails={["z@cam.hs.kr"]}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("bulk-update-group-description-done")).toBeDefined();
    });
    expect(mockCallGroupsUpdate).toHaveBeenCalledTimes(2);
    const args = mockCallGroupsUpdate.mock.calls.map((c) => c[0]);
    // Both original emails, both original description.
    const ids = args.map((a) => a.email).sort();
    expect(ids).toEqual(["g1@cam.hs.kr", "g2@cam.hs.kr"]);
    expect(args.every((a) => a.description === "original")).toBe(true);
  });
});
