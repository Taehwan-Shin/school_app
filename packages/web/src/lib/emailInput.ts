// v0.168: v0.167 CreateGroupDialog 에서 시작한 local-part 자동 부착 helper.
// CreateClassroomDialog 소유자 필드에도 대칭 재사용하기 위해 lib 로 승격.

export const EMAIL_DOMAIN = "cam.hs.kr";

// Google Workspace local-part 규칙: 알파벳/숫자/`.`/`_`/`-` 만, 64자 이하.
// 첫 글자는 alphanumeric.
export const LOCAL_PART_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export const FULL_EMAIL_RE = new RegExp(
  `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}@${EMAIL_DOMAIN.replace(/\./g, "\\.")}$`,
);

/**
 * 입력값을 canonical (lower-case + @cam.hs.kr) email 로 정규화.
 * - trim 후 lower-case (case-insensitive 인식).
 * - @ 없으면 local-part 로 간주 → `<x>@cam.hs.kr` 로 자동 부착.
 * - @ 있으면 full email — 도메인 일치 + local-part 규칙 만족해야 함.
 * - 부적합 (빈 값 · 다른 도메인 · 특수문자 · 첫 글자 non-alnum 등) → null.
 */
export function normalizeSchoolEmailInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  if (!trimmed.includes("@")) {
    if (!LOCAL_PART_RE.test(trimmed)) return null;
    return `${trimmed}@${EMAIL_DOMAIN}`;
  }
  if (!FULL_EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * 실시간 preview 텍스트 계산 helper. Dialog 렌더에서 사용.
 * 유효한 local-part 이거나 full email 이면 canonical 반환, 아니면 빈 문자열.
 */
export function previewSchoolEmail(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  return normalizeSchoolEmailInput(trimmed) ?? "";
}
