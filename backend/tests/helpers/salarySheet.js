import * as XLSX from 'xlsx';

export const SALARY_HEADER = [
  'SRNO',
  'EMPNO',
  'EMP_NAME',
  'LOCATION',
  'STATE',
  'PT GROSS',
  'PHY_CODE',
  'P_TAX',
];

export const defaultSalaryRow = [
  1,
  'E1001',
  'Test Employee',
  'Anand',
  'Gujarat',
  12478,
  '0083',
  200,
];

export const buildSalaryWorkbookBuffer = (
  rows = [defaultSalaryRow],
  { sheetName = 'OutPut', extraSheets = {} } = {},
) => {
  const aoa = [['Salary Sheet July-26']];
  aoa.push(SALARY_HEADER);
  aoa.push(...rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(aoa),
    sheetName,
  );
  for (const [name, data] of Object.entries(extraSheets)) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(data),
      name,
    );
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};
