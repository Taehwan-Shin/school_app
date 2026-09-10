// v0.114: 감사 로그 필터 preset 저장·조회·삭제 유틸.
// localStorage 기반 (도메인·사용자 단위 로컬 상태). super_admin 이 자주 쓰는 필터
// 조합을 저장해서 URL 을 매번 손으로 만들지 않게.

const STORAGE_KEY = 'audit_filter_presets_v1';
const MAX_PRESETS = 20;
const MAX_NAME_LENGTH = 60;

export interface AuditFilterPreset {
  name: string;
  params: string; // URL search params 원문 (예: "action=users.read&result=error").
}

function readStorage(): AuditFilterPreset[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is AuditFilterPreset =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as any).name === 'string' &&
        typeof (p as any).params === 'string',
    );
  } catch {
    return [];
  }
}

function writeStorage(presets: AuditFilterPreset[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // quota 초과 등은 무시 (사용자 UI 에는 불필요한 오류).
  }
}

export function listPresets(): AuditFilterPreset[] {
  return readStorage();
}

export function savePreset(name: string, params: string): AuditFilterPreset[] {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) return readStorage();
  const current = readStorage();
  // 같은 이름 있으면 갱신, 없으면 append (MAX 초과 시 가장 오래된 것 대체 안 하고 그대로 반환).
  const idx = current.findIndex((p) => p.name === trimmed);
  if (idx >= 0) {
    current[idx] = { name: trimmed, params };
  } else {
    if (current.length >= MAX_PRESETS) return current;
    current.push({ name: trimmed, params });
  }
  writeStorage(current);
  return current;
}

export function deletePreset(name: string): AuditFilterPreset[] {
  const trimmed = name.trim();
  const current = readStorage().filter((p) => p.name !== trimmed);
  writeStorage(current);
  return current;
}
