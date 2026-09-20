// v0.168: v0.167 CreateGroupDialog 에서 시작한 local-part 자동 부착 helper.
// CreateClassroomDialog 소유자 필드에도 대칭 재사용하기 위해 lib 로 승격.

export const EMAIL_DOMAIN = "cam.hs.kr";

// Google Workspace local-part 규칙: 알파벳/숫자/`.`/`_`/`-` 만, 64자 이하.
// 첫 글자는 alphanumeric.
// v0.191: 64자 상한을 상수로 export (RFC 5321 · Google Workspace 규격).
// v0.181 CreateUser (`USER_LOCAL_PART_MAX`) 와 동일 값이지만 semantic home 은
// email 인프라이므로 여기에 둔다. 추가 dialog 는 이 상수를 참조.
export const EMAIL_LOCAL_PART_MAX = 64;
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

/**
 * v0.191: 입력에서 local-part (「@」 앞 부분) 를 추출. counter UI 에 사용.
 * - 「@」 있으면 앞 부분, 없으면 전체를 로컬로 간주 (사용자가 아이디만 입력 중일 때).
 * - trim 은 하지 않음 (raw 길이 유지 · 시각적으로 사용자가 본 그대로).
 */
export function extractEmailLocalPart(input: string): string {
  const at = input.lastIndexOf("@");
  return at >= 0 ? input.slice(0, at) : input;
}
