export type WhatsAppSendStatus =
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

/** Plain, non-alarming status shown to normal (non-admin) users — never the raw code/text. */
export type WhatsAppUserStatus =
  | 'delivering'
  | 'delivered'
  | 'read'
  | 'retry_scheduled'
  | 'unreachable'
  | 'opted_out'
  | 'needs_review';

export type WhatsAppFailureCategory =
  | 'permanent_opt_out'
  | 'long_backoff_retry'
  | 'short_backoff_retry'
  | 'quality_throttle'
  | 'undeliverable_fallback'
  | 'other';

export type WhatsAppRetryState = 'none' | 'scheduled' | 'exhausted' | 'suppressed';

export type WhatsAppSendActor = {
  id: string | null;
  name: string | null;
  email: string | null;
};

export type WhatsAppSendClientRef = {
  id: string;
  clientCode: string | null;
  companyName: string | null;
  location: { id: string; name: string | null } | null;
};

export type WhatsAppSend = {
  id: string;
  filingId: string | null;
  client: WhatsAppSendClientRef | null;
  clientCode: string | null;
  companyName: string | null;
  phone: string;
  period: string | null;
  periodLabel: string | null;
  filename: string | null;
  mediaUrl: string | null;
  templateName: string | null;
  status: WhatsAppSendStatus;
  userStatus: WhatsAppUserStatus;
  requestId: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  failureCode: string | null;
  failureCategory: WhatsAppFailureCategory | null;
  retryCount: number;
  retryState: WhatsAppRetryState;
  nextRetryAt: string | null;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  statusUpdatedAt: string | null;
  actor: WhatsAppSendActor | null;
  createdAt: string;
  updatedAt: string;
};

export type ListWhatsAppSendsParams = {
  page?: number;
  limit?: number;
  search?: string;
  period?: string;
  clientId?: string;
  clientIds?: string[];
  locationId?: string;
  locationIds?: string[];
  status?: WhatsAppSendStatus;
  phone?: string;
  sortBy?:
    | 'sentAt'
    | 'status'
    | 'phone'
    | 'period'
    | 'clientCode'
    | 'createdAt'
    | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
};

export type ListWhatsAppSendsResult = {
  sends: WhatsAppSend[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type RefreshWhatsAppSendsResult = {
  checked: number;
  logsFetched: number;
  matched: number;
  updated: number;
  providerError: string | null;
};

export type WhatsAppFailureSummaryRow = {
  category: WhatsAppFailureCategory;
  count: number;
  lastSeenAt: string | null;
};

export type WhatsAppFailureSummaryParams = {
  period?: string;
  clientId?: string;
  clientIds?: string[];
  locationId?: string;
  locationIds?: string[];
  sinceDays?: number;
};

export type WhatsAppSuppression = {
  id: string;
  phone: string;
  reason: 'opted_out' | 'manual';
  failureCode: string | null;
  notes: string | null;
  suppressedAt: string;
};

export type ListWhatsAppSuppressionsResult = {
  suppressions: WhatsAppSuppression[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
