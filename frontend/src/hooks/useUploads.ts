import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { uploadsApi } from '@/api/uploads.api';
import { clientsQueryKeys, locationsQueryKeys } from '@/hooks/useClients';
import { employeesQueryKeys } from '@/hooks/useEmployees';
import { filingsQueryKeys } from '@/hooks/useFilings';
import type {
  ImportProgressEvent,
  ImportUploadPayload,
  ListUploadRowsPayload,
  ListUploadsParams,
  UploadKind,
} from '@/types/uploads.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

export const uploadsQueryKeys = {
  all: ['uploads'] as const,
  list: (params: ListUploadsParams) => ['uploads', 'list', params] as const,
  detail: (id: string) => ['uploads', 'detail', id] as const,
};

export const useUploadsQuery = (
  params: ListUploadsParams,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: uploadsQueryKeys.list(params),
    queryFn: () => uploadsApi.list(params),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });

export const useUploadQuery = (id: string | null) =>
  useQuery({
    queryKey: uploadsQueryKeys.detail(id ?? ''),
    queryFn: () => uploadsApi.getById(id as string),
    enabled: Boolean(id),
  });

export const useCreateUploadMutation = () =>
  useMutation({
    mutationKey: ['uploads', 'create'],
    mutationFn: ({ file, kind }: { file: File; kind: UploadKind }) =>
      uploadsApi.create(file, kind),
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not parse this workbook'));
    },
  });

export const usePreviewUploadMutation = () =>
  useMutation({
    mutationKey: ['uploads', 'preview'],
    mutationFn: ({ id, sheetName }: { id: string; sheetName: string }) =>
      uploadsApi.preview(id, sheetName),
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not preview that sheet'));
    },
  });

export const useUploadRowsQuery = (
  id: string | null,
  payload: ListUploadRowsPayload,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: [
      ...uploadsQueryKeys.detail(id ?? ''),
      'rows',
      payload.page,
      payload.limit,
      payload.sheetName,
      payload.companyName,
      JSON.stringify(payload.mapping ?? {}),
    ] as const,
    queryFn: () => uploadsApi.listRows(id as string, payload),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });

export const useImportUploadMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['uploads', 'import'],
    mutationFn: ({
      id,
      payload,
      onProgress,
    }: {
      id: string;
      payload: ImportUploadPayload;
      onProgress?: (event: ImportProgressEvent) => void;
    }) => uploadsApi.importWithProgress(id, payload, onProgress ?? (() => {})),
    onSuccess: () => {
      toastSuccess('Data saved to the database');
      void queryClient.invalidateQueries({ queryKey: uploadsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: clientsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: locationsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: employeesQueryKeys.all });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not import this workbook'));
    },
  });
};

export const useDownloadImportErrorsMutation = () =>
  useMutation({
    mutationKey: ['uploads', 'errors'],
    mutationFn: (id: string) => uploadsApi.downloadErrors(id),
    onSuccess: () => {
      toastSuccess('Download started');
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not download import errors'));
    },
  });

const invalidateImportedData = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: uploadsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: clientsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: locationsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: employeesQueryKeys.all });
};

export const usePurgeMasterMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['uploads', 'purge-master'],
    mutationFn: (confirmation: string) => uploadsApi.purgeMaster(confirmation),
    onSuccess: (result) => {
      toastSuccess(
        `Cleared ${result.clientsRemoved} clients and ${result.filingsRemoved} filings`,
      );
      invalidateImportedData(queryClient);
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not clear master data'));
    },
  });
};

export const usePurgeSalaryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['uploads', 'purge-salary'],
    mutationFn: (payload: {
      confirmation: string;
      period: string;
      companyName?: string | null;
    }) => uploadsApi.purgeSalary(payload),
    onSuccess: (result) => {
      toastSuccess(`Cleared ${result.employeesRemoved} employee rows`);
      invalidateImportedData(queryClient);
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not clear salary data'));
    },
  });
};

export const usePurgeClientMasterMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['uploads', 'purge-client-master'],
    mutationFn: (confirmation: string) =>
      uploadsApi.purgeClientMaster(confirmation),
    onSuccess: (result) => {
      toastSuccess(
        `Cleared address/RC on ${result.addressesCleared} client${
          result.addressesCleared === 1 ? '' : 's'
        }`,
      );
      invalidateImportedData(queryClient);
    },
    onError: (error) => {
      toastError(
        getApiErrorMessage(error, 'Could not clear client address data'),
      );
    },
  });
};

