import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface OrgunitsCreateRequest {
  name: string;
  parentOrgUnitPath: string;
  description?: string;
  blockInheritance?: boolean;
}

export interface OrgunitsCreateResponse {
  orgUnitPath: string;
  name: string;
  description?: string;
  parentOrgUnitPath: string;
}

export async function callOrgunitsCreate(
  input: OrgunitsCreateRequest,
): Promise<OrgunitsCreateResponse> {
  return callCallable<OrgunitsCreateRequest, OrgunitsCreateResponse>(
    'orgunitsCreate',
    input,
    { scopes: 'https://www.googleapis.com/auth/admin.directory.orgunit' },
  );
}

export function useOrgunitsCreate() {
  const qc = useQueryClient();
  return useMutation<OrgunitsCreateResponse, Error, OrgunitsCreateRequest>({
    mutationFn: callOrgunitsCreate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgunits', 'list'] });
    },
  });
}
