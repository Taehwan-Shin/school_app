// v0.221: shared visible-columns serializer/deserializer for `useLocalStorageState`.
// - 4 테이블 (Accounts/Groups/Classroom/AuditLog) 은 `Set<K>` 컬럼 표시 상태를
//   `JSON.stringify(Array.from(set))` 로 저장하고 mount 시 filter + default fallback.
// - v0.216 R1 F-A 계약: 저장값이 `[]` (사용자 명시적 전체 숨김) 은 유지, 저장값이
//   비어있지 않은데 valid key 필터 후 empty 면 default 로 복구.
// - 커스텀 T extends string (테이블별 union type) 유지.

export const serializeVisibleColumns = <T extends string>(
  s: Set<T>,
): string => JSON.stringify(Array.from(s));

export function makeVisibleColumnsDeserializer<T extends string>(
  validKeys: readonly T[],
  defaultKeys: readonly T[],
): (raw: string) => Set<T> | undefined {
  return (raw: string): Set<T> | undefined => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return undefined; // default fallback via hook.
      const filtered = parsed.filter(
        (k): k is T => typeof k === 'string' && (validKeys as readonly string[]).includes(k),
      );
      // v0.216 R1 F-A: 저장값이 있었는데 valid key 하나도 남지 않으면 default 복구.
      //                명시적 empty array `[]` 는 유지.
      if (parsed.length > 0 && filtered.length === 0) {
        return new Set(defaultKeys);
      }
      return new Set(filtered);
    } catch {
      return undefined; // default fallback via hook.
    }
  };
}
