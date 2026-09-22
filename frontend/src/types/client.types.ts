export type Location = {
  id: string;
  name: string;
  defaultTemplate: {
    id: string;
    name: string | null;
    code: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type LocationRef = {
  id: string;
  name: string | null;
};

/** Client's most recent Form 5 filing status — not a period-specific value. */
export type ClientLatestFiling = {
  generateStatus: 'pending' | 'generated' | 'failed';
  period: string;
  periodLabel: string | null;
};

export type Client = {
  id: string;
  clientCode: string;
  companyName: string;
  draftName: string | null;
  location: LocationRef | null;
  authorityName: string | null;
  address: string | null;
  rcNumber: string | null;
  contactNumber: string | null;
  recipientName: string | null;
  fundCode: string | null;
  phyCode: string | null;
  status: string | null;
  signatoryName: string | null;
  includeEmployeesOnForm5: boolean;
  /** Only present on list rows — the client's latest Form 5 filing, if any. */
  latestFiling?: ClientLatestFiling | null;
  createdAt: string;
  updatedAt: string;
};

export type ListClientsParams = {
  page?: number;
  limit?: number;
  search?: string;
  locationId?: string;
  locationIds?: string[];
  fundCode?: string;
  generateStatus?: 'pending' | 'generated' | 'failed';
  recentlyAdded?: boolean;
  sortBy?: 'clientCode' | 'companyName' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
};

export type ListClientsResult = {
  clients: Client[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ClientPayload = {
  clientCode: string;
  companyName: string;
  locationName: string;
  draftName?: string | null;
  authorityName?: string | null;
  address?: string | null;
  rcNumber?: string | null;
  contactNumber?: string | null;
  recipientName?: string | null;
  fundCode?: string | null;
  phyCode?: string | null;
  status?: string | null;
  signatoryName?: string | null;
  includeEmployeesOnForm5?: boolean;
};

export type UpdateClientPayload = Partial<ClientPayload>;

export type ClientOption = {
  id: string;
  clientCode: string;
  companyName: string;
  phyCode: string | null;
  fundCode: string | null;
  locationId: string | null;
  locationName: string | null;
};

export type ClientCompanyOption = {
  name: string;
  clientCount: number;
  phyCodes: string[];
};

export type ClientOptionsResult = {
  clients: ClientOption[];
  companies: ClientCompanyOption[];
};

export type SendClientWhatsAppPayload = {
  templateId: string;
  phone?: string;
  savePhone?: boolean;
  recipientName?: string;
  saveRecipientName?: boolean;
  customValues?: Record<string, string>;
  /** Required when the chosen template references {{Period}}/month/year fields. */
  period?: string;
};

export type SendClientWhatsAppResult = {
  client: Client;
  phone: string;
};
