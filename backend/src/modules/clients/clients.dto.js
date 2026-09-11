import { toLocationRefDto } from '../locations/locations.dto.js';

export const toClientDto = (client) => ({
  id: client.id,
  clientCode: client.clientCode,
  companyName: client.companyName,
  draftName: client.draftName,
  location: toLocationRefDto(client.location),
  authorityName: client.authorityName,
  address: client.address,
  rcNumber: client.rcNumber,
  contactNumber: client.contactNumber,
  recipientName: client.recipientName ?? null,
  fundCode: client.fundCode,
  phyCode: client.phyCode,
  status: client.status,
  signatoryName: client.signatoryName,
  includeEmployeesOnForm5: client.includeEmployeesOnForm5 !== false,
  createdAt: client.createdAt,
  updatedAt: client.updatedAt,
});

export const toClientListDto = (clients) => clients.map(toClientDto);
