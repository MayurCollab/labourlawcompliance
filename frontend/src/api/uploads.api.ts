import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  ImportProgressEvent,
  ImportReport,
  ImportUploadPayload,
  ImportUploadResult,
  ListUploadRowsPayload,
  ListUploadsParams,
  ListUploadsResult,
  UploadDetail,
  UploadKind,
  UploadRowsResult,
} from '@/types/uploads.types';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { getCsrfHeaders } from '@/utils/csrfHeaders';
import {
  filenameFromContentDisposition,
  saveBlob,
} from '@/utils/download';
import { store } from '@/store';

const toQuery = (params: ListUploadsParams) => {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.kind) query.kind = params.kind;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return query;
};

type ImportStreamEvent =
  | ({ type: 'progress' } & ImportProgressEvent)
  | { type: 'complete'; data: ImportUploadResult }
  | {
      type: 'error';
      message: string;
      code?: string;
      status?: number;
    };

const parseImportStreamLine = (line: string): ImportStreamEvent | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as ImportStreamEvent;
};

const readImportStream = async (
  response: Response,
  onProgress: (event: ImportProgressEvent) => void,
): Promise<ImportUploadResult> => {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Import stream is not available');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let result: ImportUploadResult | null = null;
  let streamError: Error | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const event = parseImportStreamLine(line);
      if (!event) continue;

      if (event.type === 'progress') {
        const { type: _type, ...progress } = event;
        onProgress(progress);
      } else if (event.type === 'complete') {
        result = event.data;
      } else if (event.type === 'error') {
        streamError = new Error(event.message);
        (streamError as Error & { code?: string; status?: number }).code =
          event.code;
        (streamError as Error & { code?: string; status?: number }).status =
          event.status;
      }
    }
  }

  if (buffer.trim()) {
    const event = parseImportStreamLine(buffer);
    if (event?.type === 'progress') {
      const { type: _type, ...progress } = event;
      onProgress(progress);
    } else if (event?.type === 'complete') {
      result = event.data;
    } else if (event?.type === 'error') {
      streamError = new Error(event.message);
    }
  }

  if (streamError) throw streamError;
  if (!result) throw new Error('Import finished without a result');
  return result;
};

const importRequest = async (
  id: string,
  payload: ImportUploadPayload,
  stream: boolean,
  onProgress?: (event: ImportProgressEvent) => void,
): Promise<ImportUploadResult> => {
  const token = store.getState().auth.accessToken;
  const url = `${getApiBaseUrl()}/api/v1/uploads/${id}/import${
    stream ? '?stream=1' : ''
  }`;

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: stream ? 'application/x-ndjson' : 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (stream) {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('ndjson')) {
      const json = (await response.json()) as ApiSuccessResponse<unknown> & {
        message?: string;
      };
      throw new Error(json.message || 'Could not import this workbook');
    }
    return readImportStream(response, onProgress ?? (() => {}));
  }

  const json = (await response.json()) as ApiSuccessResponse<ImportUploadResult>;
  if (!response.ok) {
    throw new Error(json.message || 'Could not import this workbook');
  }
  return json.data;
};

export const uploadsApi = {
  list: async (params: ListUploadsParams = {}): Promise<ListUploadsResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ListUploadsResult>
    >('/api/v1/uploads', { params: toQuery(params) });
    return data.data;
  },

  getById: async (id: string): Promise<UploadDetail> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ upload: UploadDetail }>
    >(`/api/v1/uploads/${id}`);
    return data.data.upload;
  },

  create: async (file: File, kind: UploadKind = 'master') => {
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file);
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ upload: UploadDetail }>
    >('/api/v1/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.upload;
  },

  preview: async (id: string, sheetName: string): Promise<UploadDetail> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ upload: UploadDetail }>
    >(`/api/v1/uploads/${id}/preview`, { sheetName });
    return data.data.upload;
  },

  listRows: async (
    id: string,
    payload: ListUploadRowsPayload = {},
  ): Promise<UploadRowsResult> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<UploadRowsResult>
    >(`/api/v1/uploads/${id}/rows`, payload);
    return data.data;
  },

  import: async (id: string, payload: ImportUploadPayload) =>
    importRequest(id, payload, false),

  importWithProgress: async (
    id: string,
    payload: ImportUploadPayload,
    onProgress: (event: ImportProgressEvent) => void,
  ) => importRequest(id, payload, true, onProgress),

  downloadErrors: async (id: string): Promise<void> => {
    const response = await axiosInstance.get(`/api/v1/uploads/${id}/errors`, {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    const filename = filenameFromContentDisposition(
      response.headers['content-disposition'],
      'import_errors.xlsx',
    );
    saveBlob(blob, filename);
  },

  purgeMaster: async (confirmation: string) => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ clientsRemoved: number; filingsRemoved: number }>
    >('/api/v1/uploads/purge/master', { confirmation });
    return data.data;
  },

  purgeSalary: async (payload: {
    confirmation: string;
    period: string;
    companyName?: string | null;
  }) => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{
        period: string;
        companyName: string | null;
        employeesRemoved: number;
      }>
    >('/api/v1/uploads/purge/salary', payload);
    return data.data;
  },

  purgeClientMaster: async (confirmation: string) => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ addressesCleared: number }>
    >('/api/v1/uploads/purge/client-master', { confirmation });
    return data.data;
  },
};
