import * as XLSX from 'xlsx';

export const CLIENT_MASTER_HEADER = [
  'clientno',
  'fname.1',
  'fname.2',
  'Location',
  'ClientGroup.groupname',
  'Address.1',
  'EC Professional Tax Number',
  'RC Professional Tax Number',
  'S & E Number',
];

export const defaultClientMasterRow = [
  'C0039',
  'SGC',
  'SMFG India Credit Co. Ltd. [534]',
  'Bhavnagar',
  'SMFG - CREDIT',
  'Office No 102, First Floor, Sopan Complex, Bhavnagar',
  'PEC050009559',
  'PRC050000751',
  'CI005000089',
];

export const buildClientMasterWorkbookBuffer = (
  rows = [defaultClientMasterRow],
  sheetName = 'Sheet1',
) => {
  const aoa = [CLIENT_MASTER_HEADER, ...rows];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(aoa),
    sheetName,
  );
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};
