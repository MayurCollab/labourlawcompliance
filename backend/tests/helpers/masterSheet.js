import * as XLSX from 'xlsx';

export const MASTER_HEADER = [
  'No.',
  'Status',
  'Task No.',
  'Client',
  'Name of Company',
  'Drafts to be prepared in the name of',
  'Location',
  'P.Tax Amount',
  'Ch. No.',
  'Sent Date',
  'Challan No.',
  'Dated',
  'Reg No.',
  'Contact Number',
  'Fund Code',
  'Month',
  'Received In Bank',
  'Less Payment Received',
  'Link',
  'Mail Status',
  'Original challan status',
];

export const defaultMasterRow = [
  1,
  'G',
  '',
  'C0001',
  'Acer India Pvt. Ltd.',
  'Acer India',
  'Ahmedabad',
  200,
  '',
  '',
  '',
  '',
  'PRC016780178',
  '',
  'G0001',
  'Jul-2026',
  '',
  '',
  '',
  '',
  '',
];

export const buildMasterWorkbookBuffer = (
  rows = [defaultMasterRow],
  sheetName = 'July.26',
) => {
  // Real MasterSheet headers sit on row 17. Leading cells must be non-empty
  // or SheetJS drops those rows from the sheet range.
  const aoa = Array.from({ length: 16 }, (_, index) => [
    index === 15 ? 'Monthly PT tracker' : ' ',
  ]);
  aoa.push(MASTER_HEADER);
  aoa.push(...rows);
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};
