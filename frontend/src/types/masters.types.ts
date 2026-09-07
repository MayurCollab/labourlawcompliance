export type PtSlab = {
  id: string;
  salaryFrom: number;
  salaryTo: number | null;
  rate: number;
  label: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PtSlabPayload = {
  salaryFrom: number;
  salaryTo: number | null;
  rate: number;
  label?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  sortOrder?: number;
};

export type AppSettings = {
  signatoryName: string;
};
