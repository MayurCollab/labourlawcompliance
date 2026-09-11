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
