/**
 * Compare MasterSheet P.Tax Amount with the salary-sheet employee PT total
 * for the same client and month.
 */

export const rupees = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : null;
};

/**
 * Warn only when the master amount is present and at least one salary
 * employee exists for that client/period.
 */
export const buildPtMismatch = ({
  ptAmount,
  salaryPtTotal,
  employeeCount = 0,
} = {}) => {
  const master = rupees(ptAmount);
  const salary = rupees(salaryPtTotal);
  const count = Number(employeeCount) || 0;
  const comparable = master !== null && salary !== null && count > 0;
  const delta = comparable ? master - salary : null;

  return {
    salaryPtTotal: salary,
    salaryEmployeeCount: count,
    ptMismatch: Boolean(comparable && delta !== 0),
    ptMismatchDelta: comparable ? delta : null,
  };
};

export const toPtMismatchDto = (filingDto) => {
  if (!filingDto?.ptMismatch) return null;
  return {
    id: filingDto.id,
    clientCode: filingDto.clientCode,
    companyName: filingDto.client?.companyName ?? null,
    ptAmount: rupees(filingDto.ptAmount),
    salaryPtTotal: filingDto.salaryPtTotal,
    salaryEmployeeCount: filingDto.salaryEmployeeCount ?? 0,
    ptMismatchDelta: filingDto.ptMismatchDelta,
  };
};
