// v0.221 R1: shared sort serializer/deserializer for `useLocalStorageState`.
// - 3 admin 테이블 (Accounts/Groups/Classroom) 이 identical `StoredSortPref` shape
//   (JSON object with sort/dir string fields, both optional) 을 반복.
// - v0.221 R0 F-A: deserializer 가 배열·빈 객체·필드 타입 오류를 「invalid shape」
//   → undefined 로 취급하도록 엄격 검증. valid 는 「object with at least one string
//   sort or dir field」 뿐. null 은 명시적 「no preference」 (default fallback).

export interface StoredSortPref {
  sort?: string;
  dir?: string;
}

export function deserializeSort(raw: string): StoredSortPref | null | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    // null 은 명시적 「no preference」 (reset semantic).
    if (parsed === null) return null;
    // 배열/기본형은 invalid shape.
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const rec = parsed as Record<string, unknown>;
    // 필드가 있는데 string 이 아니면 invalid shape.
    if (rec.sort !== undefined && typeof rec.sort !== 'string') return undefined;
    if (rec.dir !== undefined && typeof rec.dir !== 'string') return undefined;
    // 유효한 string field 가 하나도 없으면 invalid (empty object 도 undefined).
    const hasSort = typeof rec.sort === 'string';
    const hasDir = typeof rec.dir === 'string';
    if (!hasSort && !hasDir) return undefined;
    return {
      sort: hasSort ? (rec.sort as string) : undefined,
      dir: hasDir ? (rec.dir as string) : undefined,
    };
  } catch {
    return undefined;
  }
}
