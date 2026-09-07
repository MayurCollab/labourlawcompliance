import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { filingsApi } from '@/api/filings.api';
import type {
  BulkGeneratePayload,
  Filing,
  ListFilingsParams,
  UpdateFilingOverridesPayload,
} from '@/types/filing.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

export const filingsQueryKeys = {
  all: ['filings'] as const,
  list: (params: ListFilingsParams) => ['filings', 'list', params] as const,
  detail: (id: string) => ['filings', 'detail', id] as const,
};

export const useFilingsQuery = (
  params: ListFilingsParams,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: filingsQueryKeys.list(params),
    queryFn: () => filingsApi.list(params),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });

export const useFilingQuery = (id: string | null) =>
  useQuery({
    queryKey: filingsQueryKeys.detail(id ?? ''),
    queryFn: () => filingsApi.getById(id as string),
    enabled: Boolean(id),
  });

export const useComputeFilingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['filings', 'compute'],
    mutationFn: (id: string) => filingsApi.compute(id),
    onSuccess: (filing) => {
      toastSuccess('PT slabs computed');
      void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
      queryClient.setQueryData(filingsQueryKeys.detail(filing.id), filing);
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not compute PT slabs'));
    },
  });
};

export const useGenerateFilingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['filings', 'generate'],
    mutationFn: ({
      id,
      computeIfNeeded,
    }: {
      id: string;
      computeIfNeeded?: boolean;
    }) => filingsApi.generate(id, { computeIfNeeded }),
    onSuccess: (filing) => {
      toastSuccess('Form 5 generated');
      void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
      queryClient.setQueryData(
        filingsQueryKeys.detail(filing.id),
        (previous: Filing | undefined) =>
          previous
            ? {
                ...previous,
                ...filing,
                employeePreview: previous.employeePreview ?? filing.employeePreview,
              }
            : filing,
      );
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not generate Form 5'));
    },
  });
};

export const useUpdateFilingOverridesMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['filings', 'overrides'],
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateFilingOverridesPayload;
    }) => filingsApi.updateOverrides(id, payload),
    onSuccess: (filing) => {
      toastSuccess('Generate fields saved');
      void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
      queryClient.setQueryData(filingsQueryKeys.detail(filing.id), filing);
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not save generate fields'));
    },
  });
};

export const useBulkGenerateFilingsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['filings', 'bulk-generate'],
    mutationFn: (payload: BulkGeneratePayload) =>
      filingsApi.bulkGenerate(payload),
    onSuccess: (report) => {
      toastSuccess(
        `Generated ${report.generated}. Skipped ${report.skipped} (no template). Failed ${report.failed}.`,
      );
      void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not bulk generate Form 5'));
    },
  });
};

export const useDownloadFilingMutation = () =>
  useMutation({
    mutationKey: ['filings', 'download'],
    mutationFn: ({
      id,
      version,
      filename,
    }: {
      id: string;
      version?: number;
      filename?: string | null;
    }) => filingsApi.download(id, { version, filename }),
    onSuccess: () => {
      toastSuccess('Download started');
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not download Form 5'));
    },
  });
