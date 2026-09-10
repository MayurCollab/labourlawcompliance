import { resolvePTax } from './ptCompute.js';

export const normalizeLocationName = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const clientRefId = (client) => {
  if (!client) return null;
  if (client.id) return String(client.id);
  if (client._id) return String(client._id);
  return null;
};

const employeeClientId = (employee) => {
  if (!employee?.client) return null;
  if (typeof employee.client === 'object') {
    return employee.client.id
      ? String(employee.client.id)
      : employee.client._id
        ? String(employee.client._id)
        : null;
  }
  return String(employee.client);
};

export const employeeMatchesClient = (employee, client) => {
  if (!employee || employee.unmatched) return false;
  const clientId = clientRefId(client);
  if (clientId && employeeClientId(employee) === clientId) return true;

  const employeeCode = String(employee?.clientCode ?? '')
    .trim()
    .toUpperCase();
  const clientCode = String(client?.clientCode ?? '')
    .trim()
    .toUpperCase();
  return Boolean(employeeCode && clientCode && employeeCode === clientCode);
};

/**
 * Raw employee rows for PT compute and the Form 5 list.
 * Match by client id or client code only — not PHY_CODE (shared across
 * clients) and not employee LOCATION (branch city can differ from filing place).
 */
export const filterEmployeesForClientLocation = ({
  employees = [],
  client,
  period,
}) => {
  const periodKey = String(period ?? '').trim();

  return (employees || [])
    .filter((employee) => {
      if (periodKey && String(employee.period ?? '').trim() !== periodKey) {
        return false;
      }
      return employeeMatchesClient(employee, client);
    })
    .sort((left, right) =>
      String(left.employeeNo ?? '').localeCompare(
        String(right.employeeNo ?? ''),
        'en',
        { numeric: true },
      ),
    );
};

/**
 * Employees for one client filing, scoped to the client's location when set.
 */
export const employeesForClientLocation = ({
  employees = [],
  client,
  period,
  slabs = [],
}) => {
  const matched = filterEmployeesForClientLocation({ employees, client, period });

  return matched.map((employee, index) => {
    const computedPTax =
      slabs.length > 0
        ? resolvePTax(slabs, employee.ptGross)
        : (employee.pTax ?? resolvePTax([], employee.ptGross));

    return {
      srNo: index + 1,
      employeeNo: employee.employeeNo ?? '',
      employeeName: employee.employeeName ?? '',
      locationName: employee.locationName ?? '',
      ptGross: employee.ptGross ?? null,
      pTax: computedPTax,
      phyCode: employee.phyCode ?? '',
    };
  });
};

export const employeeCountsForList = (listed = [], slabs = []) => {
  let taxableEmployeeCount = 0;
  let exemptEmployeeCount = 0;

  for (const employee of listed) {
    const rate =
      slabs.length > 0
        ? resolvePTax(slabs, employee.ptGross)
        : Number(employee.pTax) || 0;
    if (Number(rate) > 0) {
      taxableEmployeeCount += 1;
    } else {
      exemptEmployeeCount += 1;
    }
  }

  return {
    totalEmployeeCount: listed.length,
    taxableEmployeeCount,
    exemptEmployeeCount,
  };
};
