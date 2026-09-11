export type WhatsAppSendStatus =
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

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
  requestId: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
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
