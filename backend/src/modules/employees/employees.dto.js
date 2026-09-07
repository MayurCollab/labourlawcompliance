import { toLocationRefDto } from '../locations/locations.dto.js';

export const toEmployeeDto = (employee) => ({
  id: employee.id,
  client: employee.client
    ? {
        id: employee.client.id,
        clientCode: employee.client.clientCode,
        companyName: employee.client.companyName,
        phyCode: employee.client.phyCode ?? null,
        location: toLocationRefDto(employee.client.location),
      }
    : null,
  clientCode: employee.clientCode,
  employeeNo: employee.employeeNo,
  employeeName: employee.employeeName,
  phyCode: employee.phyCode,
  period: employee.period,
  periodLabel: employee.periodLabel,
  locationName: employee.locationName,
  state: employee.state,
  ptGross: employee.ptGross,
  pTax: employee.pTax,
  unmatched: employee.unmatched,
  unmatchedReason: employee.unmatchedReason,
  createdAt: employee.createdAt,
  updatedAt: employee.updatedAt,
});

export const toEmployeeListDto = (employees) => employees.map(toEmployeeDto);
