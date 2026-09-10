// v0.114: 감사 로그 필터 preset 저장·조회·삭제 유틸.
// v0.114b F69/F70/F71: write 실패 상태 전달 · read 시 정규화·dedup·상한 · 이름 정규화 공유.
// localStorage 기반 (도메인·사용자 단위 로컬 상태).

const STORAGE_KEY = 'audit_filter_presets_v1';
export const MAX_PRESETS = 20;
export const MAX_NAME_LENGTH = 60;

export interface AuditFilterPreset {
  name: string;
  params: string;
}

/**
 * 이름 정규화 — trim + 최대 길이 컷. UI 사전 판정과 유틸이 같은 규칙 공유.
 * 결과 빈 문자열은 「유효하지 않음」 을 뜻함.
 */
export function normalizePresetName(raw: string): string {
  return raw.trim().slice(0, MAX_NAME_LENGTH);
}

/**
 * 저장된 배열을 안전하게 정규화. 손상/구버전 데이터도 불변식 통과.
 * - name 정규화 (trim + 60자).
 * - 이름 정규화 후 빈 문자열은 제외.
 * - 이름 중복은 last-write-wins (뒤에 오는 항목이 이김).
 * - 최대 MAX_PRESETS 로 slice.
 */
function normalizePresetList(list: unknown): AuditFilterPreset[] {
  if (!Array.isArray(list)) return [];
  const seen = new Map<string, AuditFilterPreset>();
  for (const item of list) {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as any).name !== 'string' ||
      typeof (item as any).params !== 'string'
    ) {
      continue;
    }
    const name = normalizePresetName((item as any).name);
    if (!name) continue;
    seen.set(name, { name, params: (item as any).params });
  }
  return Array.from(seen.values()).slice(0, MAX_PRESETS);
}

function readStorage(): AuditFilterPreset[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizePresetList(JSON.parse(raw));
  } catch {
    return [];
  }
}

/**
 * write 결과 status.
 * - 'ok': 성공적으로 저장됨.
 * - 'invalid_name': 이름이 비었음 (trim 후).
 * - 'limit_exceeded': 신규 추가인데 MAX_PRESETS 초과.
 * - 'storage_error': localStorage.setItem 실패 (quota, security 등).
 */
export type SavePresetStatus = 'ok' | 'invalid_name' | 'limit_exceeded' | 'storage_error';

export interface SavePresetResult {
  status: SavePresetStatus;
  presets: AuditFilterPreset[]; // 성공 시 갱신된 리스트, 실패 시 기존 리스트 (persisted 상태).
}

function writeStorage(presets: AuditFilterPreset[]): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}

export function listPresets(): AuditFilterPreset[] {
  return readStorage();
}

export function savePreset(name: string, params: string): SavePresetResult {
  const normalized = normalizePresetName(name);
  const current = readStorage();
  if (!normalized) {
    return { status: 'invalid_name', presets: current };
  }
  const idx = current.findIndex((p) => p.name === normalized);
  let next: AuditFilterPreset[];
  if (idx >= 0) {
    // 갱신 — 상한과 무관.
    next = current.slice();
    next[idx] = { name: normalized, params };
  } else {
    if (current.length >= MAX_PRESETS) {
      return { status: 'limit_exceeded', presets: current };
    }
    next = [...current, { name: normalized, params }];
  }
  const ok = writeStorage(next);
  if (!ok) {
    return { status: 'storage_error', presets: current };
  }
  return { status: 'ok', presets: next };
}

export function deletePreset(name: string): AuditFilterPreset[] {
  const normalized = normalizePresetName(name);
  const current = readStorage();
  const next = current.filter((p) => p.name !== normalized);
  if (next.length === current.length) return current;
  const ok = writeStorage(next);
  return ok ? next : current;
}
