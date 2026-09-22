// v0.220 R1: shared page-size serializer/deserializer for `useLocalStorageState`.
// - 4 테이블 (Accounts/Groups/Classroom/AuditLog) 이 동일 패턴 (raw integer string,
//   whitelist 검증) 을 반복해서 추출.
// - `Number.parseInt` 는 "25junk" 을 25 로 partial-parse → whitelist 통과 → 손상 fallback
//   계약 위반. `Number()` + `Number.isInteger` 로 엄격 검증 (F-A 대응).

export const serializePageSize = <T extends number>(v: T): string => String(v);

export function makePageSizeDeserializer<T extends number>(
  options: readonly T[],
): (raw: string) => T | undefined {
  return (raw: string): T | undefined => {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) return undefined;
    return options.includes(parsed as T) ? (parsed as T) : undefined;
  };
}
