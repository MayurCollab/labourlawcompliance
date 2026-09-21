/** One append-only audit log entry. Written by the backend, never edited. */
export type ActivityEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string | null; name: string | null; email: string | null };
  requestId: string | null;
  ip: string | null;
  changes: Record<string, unknown> | null;
  outcome: string;
  createdAt: string;
};

export type ListActivityParams = {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
};

export type ListActivityResult = {
  entries: ActivityEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
