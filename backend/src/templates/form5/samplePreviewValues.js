/**

 * Sample Form 5 values for bundled HTML template preview and tests.

 */

export const sampleForm5PreviewValues = () => ({

  scalars: {

    formTitle: 'Form 5',

    actName:

      'Gujarat State Tax on Professions, Trades, Callings and Employments Act',

    periodMonthLabel: 'Jul-26',

    professionalTaxMonthLabel: 'July-26',

    periodFrom: '01/07/2026',

    periodTo: '31/07/2026',

    employerName: 'SMFG India Credit Co. Ltd.',

    companyName: 'SMFG India Credit Co. Ltd.',

    employerAddress: 'Sample Branch Address, Gujarat',
    rcNumber: 'PRC016780178',

    signatoryName: 'Authorised Signatory',

    place: 'Anand',

    filingDate: '31/08/2026',

    receiptNumber: 'CH-12345',

    paymentDate: '15/07/2026',

    amountPaid: 11800,

    totalA: 11800,

    totalB: 0,

    interest: 0,

    totalPayable: 11800,

    totalEmployeeCount: 59,

    taxableEmployeeCount: 59,

    exemptEmployeeCount: 0,

    includeEmployees: true,

    employeesTotalPtGross: 33000,

    employeesTotalPTax: 400,

  },
  slabs: [

    {

      label: 'Rs. 0 – 2,999',

      salaryFrom: 0,

      salaryTo: 2999,

      rate: 0,

      employeeCount: 0,

      exemptCount: 0,

      taxableCount: 0,

      taxAmount: 0,

    },

    {

      label: 'Rs. 3,000 – 5,999',

      salaryFrom: 3000,

      salaryTo: 5999,

      rate: 0,

      employeeCount: 0,

      exemptCount: 0,

      taxableCount: 0,

      taxAmount: 0,

    },

    {

      label: 'Rs. 6,000 – 8,999',

      salaryFrom: 6000,

      salaryTo: 8999,

      rate: 80,

      employeeCount: 0,

      exemptCount: 0,

      taxableCount: 0,

      taxAmount: 0,

    },

    {

      label: 'Rs. 9,000 – 11,999',

      salaryFrom: 9000,

      salaryTo: 11999,

      rate: 150,

      employeeCount: 0,

      exemptCount: 0,

      taxableCount: 0,

      taxAmount: 0,

    },

    {

      label: 'Rs. 12,000 and above',

      salaryFrom: 12000,

      salaryTo: null,

      rate: 200,

      employeeCount: 59,

      exemptCount: 0,

      taxableCount: 59,

      taxAmount: 11800,

    },

  ],

  employees: [

    {

      srNo: 1,

      employeeNo: 'E1001',

      employeeName: 'Asha Shah',

      locationName: 'Anand',

      phyCode: '0083',

      ptGross: 15000,

      pTax: 200,

    },

    {

      srNo: 2,

      employeeNo: 'E1002',

      employeeName: 'Ravi Patel',

      locationName: 'Anand',

      phyCode: '0083',

      ptGross: 18000,

      pTax: 200,

    },

  ],

  meta: {

    templateCode: 'preview',

    clientCode: 'C0001',

    period: '2026-07',

  },

});

