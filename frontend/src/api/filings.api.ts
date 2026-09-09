import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  BulkGeneratePayload,
  BulkGenerateProgressEvent,
  BulkGenerateReport,
  Filing,
  ListFilingsParams,
  ListFilingsResult,
  UpdateFilingOverridesPayload,
} from '@/types/filing.types';
import axiosInstance from '@/api/axiosInstance';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { getCsrfHeaders } from '@/utils/csrfHeaders';
import {
  filenameForDownloadBlob,
  filenameFromContentDisposition,
  saveBlob,
} from '@/utils/download';
import { store } from '@/store';

const toQuery = (params: ListFilingsParams) => {
  const query: Record<string, string> = {};
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.period) query.period = params.period;
  if (params.locationId) query.locationId = params.locationId;
  if (params.clientId) query.clientId = params.clientId;
  if (params.generateStatus) query.generateStatus = params.generateStatus;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  return query;
};

type BulkStreamEvent =
  | ({ type: 'progress' } & BulkGenerateProgressEvent)
  | { type: 'complete'; data: BulkGenerateReport }
  | {
      type: 'error';
      message: string;
      code?: string;
      status?: number;
    };

const parseStreamLine = (line: string): BulkStreamEvent | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as BulkStreamEvent;
};

const readBulkStream = async (
  response: Response,
  onProgress: (event: BulkGenerateProgressEvent) => void,
): Promise<BulkGenerateReport> => {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Bulk generate stream is not available');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let result: BulkGenerateReport | null = null;
  let streamError: Error | null = null;

  const handleEvent = (event: BulkStreamEvent) => {
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
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const event = parseStreamLine(line);
      if (event) handleEvent(event);
    }
  }

  if (buffer.trim()) {
    const event = parseStreamLine(buffer);
    if (event) handleEvent(event);
  }

  if (streamError) throw streamError;
  if (!result) throw new Error('Bulk generate finished without a result');
  return result;
};

export const filingsApi = {
  list: async (params: ListFilingsParams = {}): Promise<ListFilingsResult> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<ListFilingsResult>
    >('/api/v1/filings', { params: toQuery(params) });
    return data.data;
  },

  getById: async (id: string): Promise<Filing> => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{ filing: Filing }>
    >(`/api/v1/filings/${id}`);
    return data.data.filing;
  },

  compute: async (id: string): Promise<Filing> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ filing: Filing }>
    >(`/api/v1/filings/${id}/compute`);
    return data.data.filing;
  },

  generate: async (
    id: string,
    options?: { computeIfNeeded?: boolean },
  ): Promise<Filing> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ filing: Filing }>
    >(`/api/v1/filings/${id}/generate`, {
      computeIfNeeded: options?.computeIfNeeded ?? false,
    });
    return data.data.filing;
  },

  updateOverrides: async (
    id: string,
    payload: UpdateFilingOverridesPayload,
  ): Promise<Filing> => {
    const { data } = await axiosInstance.patch<
      ApiSuccessResponse<{ filing: Filing }>
    >(`/api/v1/filings/${id}/overrides`, payload);
    return data.data.filing;
  },

  bulkGenerate: async (
    payload: BulkGeneratePayload,
  ): Promise<BulkGenerateReport> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<BulkGenerateReport>
    >('/api/v1/filings/bulk-generate', payload);
    return data.data;
  },

  bulkGenerateWithProgress: async (
    payload: BulkGeneratePayload,
    onProgress: (event: BulkGenerateProgressEvent) => void,
    signal?: AbortSignal,
  ): Promise<BulkGenerateReport> => {
    const token = store.getState().auth.accessToken;
    const url = `${getApiBaseUrl()}/api/v1/filings/bulk-generate?stream=1`;

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('ndjson')) {
      const json = (await response.json()) as ApiSuccessResponse<unknown> & {
        message?: string;
      };
      throw new Error(json.message || 'Could not bulk generate Form 5');
    }

    return readBulkStream(response, onProgress);
  },

  download: async (
    id: string,
    options?: { version?: number; filename?: string | null },
  ): Promise<void> => {
    const file = await filingsApi.fetchDownloadBlob(id, options);
    saveBlob(file.blob, file.filename);
  },

  fetchDownloadBlob: async (
    id: string,
    options?: { version?: number; filename?: string | null },
  ): Promise<{ blob: Blob; filename: string }> => {
    const response = await axiosInstance.get(`/api/v1/filings/${id}/download`, {
      params: options?.version ? { version: options.version } : undefined,
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    const headerName = filenameFromContentDisposition(
      response.headers['content-disposition'],
      options?.filename || 'Form5.pdf',
    );
    const filename = await filenameForDownloadBlob(blob, headerName);
    return { blob, filename };
  },
};
