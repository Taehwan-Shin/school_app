import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BasicDataGradeClass } from '@school-app/shared';
import { callCallable } from './callCallable';

export interface BasicDataSetRequest {
  year: number;
  grades: BasicDataGradeClass[];
  departments?: string[];
  rosters?: Record<string, Record<string, string[]>>;
}

export interface BasicDataSetResponse {
  year: number;
  updatedAt: number;
}

export async function callBasicDataSet(data: BasicDataSetRequest): Promise<BasicDataSetResponse> {
  return callCallable<BasicDataSetRequest, BasicDataSetResponse>(
    'basicDataSet',
    data,
  );
}

export function useBasicDataSet() {
  const queryClient = useQueryClient();
  return useMutation<BasicDataSetResponse, Error, BasicDataSetRequest>({
    mutationFn: (data) => callBasicDataSet(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['basic_data', 'get', variables.year] });
      queryClient.invalidateQueries({ queryKey: ['basic_data', 'list_years'] });
    },
  });
}
