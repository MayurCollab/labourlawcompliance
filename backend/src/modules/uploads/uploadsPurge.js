import AppError from '../../utils/AppError.js';
import * as clientsRepository from '../clients/clients.repository.js';
import * as employeesRepository from '../employees/employees.repository.js';
import * as filingsRepository from '../filings/filings.repository.js';
import {
  legalCompanyName,
  normalizePhyCode,
} from './masterParse.js';
import { PURGE_CONFIRMATIONS, UPLOADS_CODES } from './uploads.constants.js';

const assertConfirmation = (provided, expected) => {
  if (String(provided ?? '').trim() !== expected) {
    throw new AppError(
      `Type ${expected} to confirm this action.`,
      422,
      { code: UPLOADS_CODES.CONFIRMATION_REQUIRED },
    );
  }
};

/**
 * Build the employee purge filter for a salary month, optionally scoped
 * to one legal company / fund.
 */
export const buildSalaryPurgeFilter = async ({ period, companyName }) => {
  const filter = { period: String(period).trim() };

  const cleaned = String(companyName ?? '').trim();
  if (!cleaned) return filter;

  const clients = await clientsRepository.findAllCompact();
  const legal = legalCompanyName(cleaned);
  const fundKey = cleaned.toLowerCase();

  const matched = clients.filter((client) => {
    const company = legalCompanyName(client.companyName);
    const draft = legalCompanyName(client.draftName);
    const fund = String(client.fundCode ?? '').trim().toLowerCase();
    return (
      (legal && (company === legal || draft === legal)) ||
      (fund && fund === fundKey)
    );
  });

  const clientIds = matched.map((client) => client.id || client._id);
  const phyCodes = [
    ...new Set(
      matched
        .map((client) => normalizePhyCode(client.phyCode))
        .filter(Boolean),
    ),
  ];

  const or = [];
  if (clientIds.length) or.push({ client: { $in: clientIds } });
  if (phyCodes.length) or.push({ phyCode: { $in: phyCodes } });

  if (!or.length) {
    return { period: filter.period, _id: { $in: [] } };
  }

  return { period: filter.period, $or: or };
};

export const purgeMasterData = async ({ confirmation }, actorId) => {
  assertConfirmation(confirmation, PURGE_CONFIRMATIONS.MASTER);

  const [clients, filings] = await Promise.all([
    clientsRepository.softDeleteAllClients(actorId),
    filingsRepository.softDeleteAllFilings(actorId),
  ]);

  return {
    clientsRemoved: clients.modifiedCount ?? 0,
    filingsRemoved: filings.modifiedCount ?? 0,
  };
};

export const purgeSalaryData = async (
  { confirmation, period, companyName },
  actorId,
) => {
  assertConfirmation(confirmation, PURGE_CONFIRMATIONS.SALARY);

  const filter = await buildSalaryPurgeFilter({ period, companyName });
  const matched = await employeesRepository.countEmployeesForPurge(filter);
  if (matched === 0) {
    throw new AppError(
      'No salary employee rows matched this purge scope.',
      422,
      { code: UPLOADS_CODES.PURGE_SCOPE_EMPTY },
    );
  }

  const result = await employeesRepository.softDeleteEmployees(filter, actorId);

  return {
    period,
    companyName: companyName || null,
    employeesRemoved: result.modifiedCount ?? 0,
  };
};

/**
 * Clear address + RC Professional Tax Number from Client-Master imports.
 * Clients and filings stay; only the address sheet fields are wiped.
 */
export const purgeClientMasterData = async ({ confirmation }, actorId) => {
  assertConfirmation(confirmation, PURGE_CONFIRMATIONS.CLIENT_MASTER);

  const result = await clientsRepository.clearAddressFields(actorId);

  return {
    addressesCleared: result.modifiedCount ?? 0,
  };
};
