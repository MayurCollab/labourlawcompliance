export type TemplateKind = 'excel' | 'docx' | 'pdf' | 'html';

export type BundledTemplate = {
  id: string;
  code: string;
  name: string;
  kind: TemplateKind;
  isGlobalDefault: boolean;
  locationNames: string[];
};

export type CanonicalField = {
  key: string;
  label: string;
  group: string;
};

export type CanonicalSchema = {
  scalars: CanonicalField[];
  slabBinds: CanonicalField[];
};

export type TemplateCell = {
  sheet: string;
  address: string;
  bind: string;
  value: string;
  tokens: string[];
};

export type SlabMappingRow = {
  salaryFrom: number;
  salaryTo: number | null;
  rate: number;
  label?: string;
  binds: Record<string, string | null>;
};

export type TemplateMapping = {
  scalars: Record<string, string | null>;
  slabs: SlabMappingRow[];
};

export type TemplateListItem = {
  id: string;
  code: string;
  name: string;
  kind: TemplateKind;
  originalName: string;
  size: number;
  isGlobalDefault: boolean;
  isBundled?: boolean;
  placeholderCount: number;
  clientCount: number;
  locationCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TemplateDetail = TemplateListItem & {
  mimetype: string;
  sheetNames: string[];
  placeholders: string[];
  cells: TemplateCell[];
  warnings: string[];
  mapping: TemplateMapping;
  clients: { id: string; clientCode: string; companyName: string }[];
  locations: { id: string; name: string }[];
};

export type TemplateRef = {
  id: string;
  name: string | null;
  code: string | null;
  kind: TemplateKind | null;
};

export type ResolveTemplateResult = {
  source: 'global' | 'location' | 'client' | null;
  template: TemplateRef | null;
  mapping: TemplateMapping | null;
};

export type ListTemplatesParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'code' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
};

export type ListTemplatesResult = {
  templates: TemplateListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AssignTemplatePayload = {
  scope: 'global' | 'location' | 'client';
  locationId?: string;
  clientId?: string;
  clear?: boolean;
};
