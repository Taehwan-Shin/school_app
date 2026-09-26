import { useQuery } from '@tanstack/react-query';
import { callCallable } from './callCallable';

// v0.312: v0.309 callCallable helper 이식 (batch). 기존 signature 유지 · 내부만 shared helper.

export interface OrgunitEntry {
  orgUnitPath: string;
  name?: string;
  description?: string;
  parentOrgUnitPath?: string;
}

export interface OrgunitsListResponse {
  orgUnits: OrgunitEntry[];
}

export async function callOrgunitsList(): Promise<OrgunitsListResponse> {
  return callCallable<Record<string, never>, OrgunitsListResponse>(
    'orgunitsList',
    {},
    { scopes: 'https://www.googleapis.com/auth/admin.directory.orgunit.readonly' },
  );
}

export function useOrgunitsList(enabled = true) {
  return useQuery<OrgunitsListResponse, Error>({
    queryKey: ['orgunits', 'list'],
    queryFn: callOrgunitsList,
    enabled,
    staleTime: 60_000, // 1분 캐시 — dialog 여러 번 열어도 재요청 안 함.
  });
}
