import { normalizeClientCode } from '../clients/clients.constants.js';
import * as clientsRepository from '../clients/clients.repository.js';
import * as employeesRepository from '../employees/employees.repository.js';
import * as filingsRepository from '../filings/filings.repository.js';
import { toLocationNameKey } from '../locations/locations.constants.js';
import * as locationsRepository from '../locations/locations.repository.js';
import { normalizePhyCode } from './masterParse.js';

export const filingCacheKey = (clientId, period) =>
  `${String(clientId)}|${String(period)}`;

export const employeeCacheKey = (employeeNo, phyCode, period) =>
  `${String(employeeNo)}|${String(phyCode)}|${String(period)}`;

/**
 * Prefetch clients + locations so MasterSheet / Client-Master import can
 * match by client code (C0001) in memory instead of one DB find per row.
 */
export const createClientImportCache = async () => {
  const [clients, locations] = await Promise.all([
    clientsRepository.findAllForImport(),
    locationsRepository.findAllLocations(),
  ]);

  const clientsByCode = new Map();
  for (const client of clients) {
    const code = normalizeClientCode(client.clientCode);
    if (code) clientsByCode.set(code, client);
  }

  const locationsByNameKey = new Map();
  for (const location of locations) {
    if (location.nameKey) locationsByNameKey.set(location.nameKey, location);
  }

  return {
    clientsByCode,
    locationsByNameKey,
    filingsByKey: new Map(),
  };
};

export const loadFilingsIntoCache = async (cache, periods) => {
  if (!cache?.filingsByKey) return cache;
  const filings = await filingsRepository.findFilingsByPeriods(periods);
  for (const filing of filings) {
    cache.filingsByKey.set(
      filingCacheKey(filing.client, filing.period),
      filing,
    );
  }
  return cache;
};

/**
 * Compact client list + code Map for salary matching (prefer C0001-style codes).
 */
export const createSalaryMatchCache = async (period) => {
  const [clients, employees] = await Promise.all([
    clientsRepository.findAllCompact(),
    period
      ? employeesRepository.findEmployeesByPeriod(period)
      : Promise.resolve([]),
  ]);

  const clientsByCode = new Map();
  for (const client of clients) {
    const code = normalizeClientCode(client.clientCode);
    if (code) clientsByCode.set(code, client);
  }

  const employeesByKey = new Map();
  for (const employee of employees) {
    const phy = normalizePhyCode(employee.phyCode);
    if (!phy) continue;
    employeesByKey.set(
      employeeCacheKey(employee.employeeNo, phy, employee.period),
      employee,
    );
  }

  return { clients, clientsByCode, employeesByKey };
};

export const rememberLocation = (cache, location) => {
  if (!cache?.locationsByNameKey || !location) return;
  const key = location.nameKey || toLocationNameKey(location.name);
  if (key) cache.locationsByNameKey.set(key, location);
};

export const rememberClient = (cache, client) => {
  if (!cache?.clientsByCode || !client) return;
  const code = normalizeClientCode(client.clientCode);
  if (code) cache.clientsByCode.set(code, client);
};

export const rememberFiling = (cache, filing) => {
  if (!cache?.filingsByKey || !filing) return;
  cache.filingsByKey.set(filingCacheKey(filing.client, filing.period), filing);
};

export const rememberEmployee = (cache, employee) => {
  if (!cache?.employeesByKey || !employee) return;
  const phy = normalizePhyCode(employee.phyCode);
  if (!phy) return;
  cache.employeesByKey.set(
    employeeCacheKey(employee.employeeNo, phy, employee.period),
    employee,
  );
};
