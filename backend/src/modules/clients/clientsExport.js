import * as XLSX from 'xlsx';

export const CLIENT_EXPORT_HEADERS = Object.freeze([
  'Client',
  'Name of Company',
  'Drafts to be prepared in the name of',
  'Location',
  'Authority name',
  'Address',
  'Reg No.',
  'Contact Number',
  'Fund Code',
  'PHY Code',
  'Status',
  'Signatory name',
  'Include employees on Form 5',
]);

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const cell = (value) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const yesNo = (value) => (value === false ? 'No' : 'Yes');

export const clientExportFilename = (date = new Date()) => {
  const stamp = date.toISOString().slice(0, 10);
  return `clients-${stamp}.xlsx`;
};

export const clientToExportRow = (client) => [
  cell(client.clientCode),
  cell(client.companyName),
  cell(client.draftName),
  cell(client.location?.name),
  cell(client.authorityName),
  cell(client.address),
  cell(client.rcNumber),
  cell(client.contactNumber),
  cell(client.fundCode),
  cell(client.phyCode),
  cell(client.status),
  cell(client.signatoryName),
  yesNo(client.includeEmployeesOnForm5),
];

/**
 * Excel of employer clients for the Clients master page download.
 */
export const buildClientsWorkbook = (clients = []) => {
  const aoa = [CLIENT_EXPORT_HEADERS, ...clients.map(clientToExportRow)];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = CLIENT_EXPORT_HEADERS.map((header, index) => {
    const longest = aoa.reduce(
      (max, row) => Math.max(max, String(row[index] ?? '').length),
      header.length,
    );
    return { wch: Math.min(48, Math.max(12, longest + 2)) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

  return {
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    filename: clientExportFilename(),
    mimetype: XLSX_MIME,
  };
};
