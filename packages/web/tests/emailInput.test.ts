import { describe, it, expect } from "vitest";
import {
  EMAIL_DOMAIN,
  EMAIL_LOCAL_PART_MAX,
  extractEmailLocalPart,
  LOCAL_PART_RE,
  FULL_EMAIL_RE,
  normalizeSchoolEmailInput,
  previewSchoolEmail,
} from "../src/lib/emailInput";

// v0.168: v0.167 CreateGroupDialog 에서 시작한 helper 를 lib 로 승격 하고
// CreateClassroomDialog owner 필드에도 재사용. 두 dialog 모두 이 helper 를 통과
// 하는 값만 서버에 전송하므로 여기서 원본 순수 함수 회귀를 잡음.
describe("emailInput helpers", () => {
  it("EMAIL_DOMAIN 상수", () => {
    expect(EMAIL_DOMAIN).toBe("cam.hs.kr");
  });

  it("LOCAL_PART_RE: alnum/._- · 64자 이하 · 첫 글자 alnum", () => {
    expect(LOCAL_PART_RE.test("team-a")).toBe(true);
    expect(LOCAL_PART_RE.test("HONG1")).toBe(true);
    expect(LOCAL_PART_RE.test("a.b_c-d")).toBe(true);
    expect(LOCAL_PART_RE.test("_start")).toBe(false); // 첫 글자 _ 안 됨.
    expect(LOCAL_PART_RE.test("-start")).toBe(false);
    expect(LOCAL_PART_RE.test(".start")).toBe(false);
    expect(LOCAL_PART_RE.test("team!")).toBe(false);
    expect(LOCAL_PART_RE.test("with space")).toBe(false);
    expect(LOCAL_PART_RE.test("")).toBe(false);
    expect(LOCAL_PART_RE.test("a".repeat(65))).toBe(false); // 64 넘음.
    expect(LOCAL_PART_RE.test("a".repeat(64))).toBe(true);
  });

  it("FULL_EMAIL_RE: local + @cam.hs.kr", () => {
    expect(FULL_EMAIL_RE.test("team-a@cam.hs.kr")).toBe(true);
    expect(FULL_EMAIL_RE.test("HONG1@cam.hs.kr")).toBe(true);
    expect(FULL_EMAIL_RE.test("team-a@other.com")).toBe(false);
    expect(FULL_EMAIL_RE.test("@cam.hs.kr")).toBe(false);
    expect(FULL_EMAIL_RE.test("team-a")).toBe(false);
  });

  it("normalizeSchoolEmailInput: local-part → 자동 부착 · lower-case", () => {
    expect(normalizeSchoolEmailInput("team-a")).toBe("team-a@cam.hs.kr");
    expect(normalizeSchoolEmailInput("Team-A")).toBe("team-a@cam.hs.kr");
    expect(normalizeSchoolEmailInput("  team_1  ")).toBe("team_1@cam.hs.kr");
  });

  it("normalizeSchoolEmailInput: full email → lower-case 로 그대로", () => {
    expect(normalizeSchoolEmailInput("team-b@cam.hs.kr")).toBe("team-b@cam.hs.kr");
    expect(normalizeSchoolEmailInput("TEAM-B@CAM.HS.KR")).toBe("team-b@cam.hs.kr");
  });

  it("normalizeSchoolEmailInput: 부적합 → null", () => {
    expect(normalizeSchoolEmailInput("")).toBeNull();
    expect(normalizeSchoolEmailInput("   ")).toBeNull();
    expect(normalizeSchoolEmailInput("team-c@other.com")).toBeNull();
    expect(normalizeSchoolEmailInput("team!")).toBeNull();
    expect(normalizeSchoolEmailInput("_team")).toBeNull();
  });

  it("previewSchoolEmail: 유효 → canonical · 부적합 → 빈 문자열", () => {
    expect(previewSchoolEmail("team-a")).toBe("team-a@cam.hs.kr");
    expect(previewSchoolEmail("team-a@cam.hs.kr")).toBe("team-a@cam.hs.kr");
    expect(previewSchoolEmail("")).toBe("");
    expect(previewSchoolEmail("team!")).toBe("");
    expect(previewSchoolEmail("team@other.com")).toBe("");
  });

  // v0.191: local-part 상한 상수 + 추출 helper.
  it("EMAIL_LOCAL_PART_MAX = 64 (RFC 5321 / Google Workspace)", () => {
    expect(EMAIL_LOCAL_PART_MAX).toBe(64);
  });

  it("extractEmailLocalPart: @ 있으면 앞부분 · 없으면 전체 · 마지막 @ 기준", () => {
    expect(extractEmailLocalPart("hong1@cam.hs.kr")).toBe("hong1");
    expect(extractEmailLocalPart("hong1")).toBe("hong1");
    expect(extractEmailLocalPart("")).toBe("");
    // 이론적으로 여러 @ 는 유효 이메일 아니지만 helper 는 마지막 @ 기준으로 안전 분리.
    expect(extractEmailLocalPart("a@b@cam.hs.kr")).toBe("a@b");
  });
});
