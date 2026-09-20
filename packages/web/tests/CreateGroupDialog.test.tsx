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

  // 2. 검증 (이메일 도메인 · 이름 필수) — v0.167 부터: local-part 허용, 잘못된 도메인 거부.
  it("validates email domain and required name", async () => {
    renderWithRouter(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);

    // Test invalid domain (@other.com)
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: "invalid@other.com" } });
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "Team A" } });
    fireEvent.click(screen.getByTestId("create-group-submit"));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId("create-group-error")).toBeDefined();
    expect(screen.getByTestId("create-group-error").textContent).toContain("이메일 형식");

    // Test empty name (full email 은 유효 · name 만 비어야 함)
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

  // v0.167: local-part 입력 + 자동 @cam.hs.kr 부착.
  describe("v0.167: local-part input + auto-suffix", () => {
    it("local-part 만 입력 시 preview 노출", () => {
      renderWithRouter(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("create-group-email-input"), {
        target: { value: "team-a" },
      });
      expect(screen.getByTestId("create-group-email-preview").textContent).toContain(
        "team-a@cam.hs.kr",
      );
    });

    it("local-part 입력 + 실행 → 서버에 team-a@cam.hs.kr 로 전송 (자동 부착)", async () => {
      mockMutateAsync.mockResolvedValueOnce({ email: "team-a@cam.hs.kr", id: "g1" });
      renderWithRouter(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("create-group-email-input"), {
        target: { value: "team-a" },
      });
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "Team A" } });
      fireEvent.click(screen.getByTestId("create-group-submit"));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          email: "team-a@cam.hs.kr",
          name: "Team A",
          description: undefined,
        });
      });
    });

    it("대문자 local-part → lower-case canonical 로 전송", async () => {
      mockMutateAsync.mockResolvedValueOnce({ email: "hong1@cam.hs.kr", id: "g1" });
      renderWithRouter(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("create-group-email-input"), {
        target: { value: "HONG1" },
      });
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "홍1반" } });
      fireEvent.click(screen.getByTestId("create-group-submit"));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ email: "hong1@cam.hs.kr" }),
        );
      });
    });

    it("full email (뒤호환) 도 정상 수용", async () => {
      mockMutateAsync.mockResolvedValueOnce({ email: "team-b@cam.hs.kr", id: "g2" });
      renderWithRouter(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("create-group-email-input"), {
        target: { value: "team-b@cam.hs.kr" },
      });
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "Team B" } });
      fireEvent.click(screen.getByTestId("create-group-submit"));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ email: "team-b@cam.hs.kr" }),
        );
      });
    });

    it("잘못된 도메인 (@other.com) 은 거부", () => {
      renderWithRouter(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("create-group-email-input"), {
        target: { value: "team-c@other.com" },
      });
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "Team C" } });
      fireEvent.click(screen.getByTestId("create-group-submit"));

      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(screen.getByTestId("create-group-error").textContent).toContain("이메일 형식");
    });

    it("잘못된 local-part (특수문자 !) 는 preview 없음 · 거부", () => {
      renderWithRouter(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("create-group-email-input"), {
        target: { value: "team!" },
      });
      // preview 안 나옴.
      expect(screen.queryByTestId("create-group-email-preview")).toBeNull();
      // 실행 → 거부.
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "T" } });
      fireEvent.click(screen.getByTestId("create-group-submit"));
      expect(mockMutateAsync).not.toHaveBeenCalled();
      expect(screen.getByTestId("create-group-error").textContent).toContain("이메일 형식");
    });
  });

  // v0.180: name 60자 상한 검증 (Workspace Directory groups.name 규격).
  describe("v0.180: name limit 60자", () => {
    it("이름이 60자 초과이면 validation error · mutate 미호출", () => {
      render(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      fireEvent.change(screen.getByTestId("create-group-email-input"), {
        target: { value: "team-a" },
      });
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "A".repeat(61) } });
      fireEvent.click(screen.getByTestId("create-group-submit"));
      expect(mockMutateAsync).not.toHaveBeenCalled();
      const err = screen.getByTestId("create-group-error");
      expect(err.textContent).toContain("이름은 60자 이하");
      expect(err.textContent).toContain("현재 61자");
    });

    it("카운터는 실시간 반영 · 초과 시 red · 60자 정확 정상", () => {
      render(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      const counter = screen.getByTestId("create-group-name-counter");
      expect(counter.textContent).toContain("0 / 60");
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "X".repeat(60) } });
      expect(counter.textContent).toContain("60 / 60");
      expect(counter.className).not.toContain("text-state-danger");
      fireEvent.change(screen.getByLabelText(/이름/), { target: { value: "X".repeat(61) } });
      expect(counter.textContent).toContain("61 / 60");
      expect(counter.className).toContain("text-state-danger");
    });
  });

  // v0.187: description counter v0.180 name counter 스타일 통일 (mt-1 text-small conditional-danger).
  describe("v0.187: description counter 스타일 통일", () => {
    it("설명 카운터 텍스트는 「N / 4096 자」 (「현재」 prefix 제거) · 4096자 이내 muted", () => {
      render(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      const counter = screen.getByTestId("create-group-description-counter");
      expect(counter.textContent).toBe("0 / 4096 자");
      expect(counter.className).toContain("text-small");
      expect(counter.className).toContain("text-fg-muted");
      expect(counter.className).not.toContain("text-state-danger");
    });

    it("4096자 초과 시 카운터 red · text-state-danger class 추가", () => {
      render(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      const textarea = screen.getByTestId("create-group-description-input");
      fireEvent.change(textarea, { target: { value: "x".repeat(4097) } });
      const counter = screen.getByTestId("create-group-description-counter");
      expect(counter.textContent).toBe("4097 / 4096 자");
      expect(counter.className).toContain("text-state-danger");
    });
  });

  // v0.192: local-part 64자 카운터 (v0.181/v0.191 대칭).
  describe("v0.192: local-part 카운터", () => {
    it("빈 값이면 카운터 미노출", () => {
      render(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      expect(screen.queryByTestId("create-group-email-local-counter")).toBeNull();
    });

    it("local-part 실시간 반영 · 64 이내 muted · 65+ red", () => {
      render(<CreateGroupDialog open={true} onOpenChange={vi.fn()} />);
      const input = screen.getByTestId("create-group-email-input");
      fireEvent.change(input, { target: { value: "team-a" } });
      const counter = screen.getByTestId("create-group-email-local-counter");
      expect(counter.textContent).toContain("6 / 64");
      expect(counter.className).toContain("text-fg-muted");
      // 65자 초과 (@ 없이도 local 로 간주)
      fireEvent.change(input, { target: { value: "a".repeat(65) } });
      expect(counter.textContent).toContain("65 / 64");
      expect(counter.className).toContain("text-state-danger");
    });
  });
});

// v0.167: normalizeGroupEmailInput 순수 함수 회귀 (helper 직접).
import { normalizeGroupEmailInput } from "../src/routes/admin/CreateGroupDialog.js";

describe("v0.167 normalizeGroupEmailInput", () => {
  it("local-part → @cam.hs.kr 자동 부착 · lower-case", () => {
    expect(normalizeGroupEmailInput("team-a")).toBe("team-a@cam.hs.kr");
    expect(normalizeGroupEmailInput("Team-A")).toBe("team-a@cam.hs.kr");
    expect(normalizeGroupEmailInput("  team_1  ")).toBe("team_1@cam.hs.kr");
  });

  it("full email 은 lower-case 로 그대로", () => {
    expect(normalizeGroupEmailInput("team-b@cam.hs.kr")).toBe("team-b@cam.hs.kr");
    expect(normalizeGroupEmailInput("TEAM-B@CAM.HS.KR")).toBe("team-b@cam.hs.kr");
  });

  it("다른 도메인 · 특수문자 · 빈 값 → null", () => {
    expect(normalizeGroupEmailInput("")).toBeNull();
    expect(normalizeGroupEmailInput("  ")).toBeNull();
    expect(normalizeGroupEmailInput("team-c@other.com")).toBeNull();
    expect(normalizeGroupEmailInput("team!")).toBeNull();
    expect(normalizeGroupEmailInput("_team")).toBeNull(); // 첫 글자는 알파벳/숫자만.
  });
});
