export type EmployeeClientRef = {
  id: string;
  clientCode: string;
  companyName: string;
  phyCode: string | null;
  location: { id: string; name: string | null } | null;
};

export type Employee = {
  id: string;
  client: EmployeeClientRef | null;
  clientCode: string | null;
  employeeNo: string;
  employeeName: string | null;
  phyCode: string;
  period: string;
  periodLabel: string | null;
  locationName: string | null;
  state: string | null;
  ptGross: number | null;
  pTax: number | null;
  unmatched: boolean;
  unmatchedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListEmployeesParams = {
  page?: number;
  limit?: number;
  search?: string;
  period?: string;
  clientId?: string;
  clientIds?: string[];
  phyCode?: string;
  unmatched?: boolean;
  sortBy?:
    | 'employeeNo'
    | 'employeeName'
    | 'phyCode'
    | 'period'
    | 'createdAt'
    | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
};

export type ListEmployeesResult = {
  employees: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
