import mongoose from 'mongoose';

import Employee from './employee.model.js';

const CLIENT_POPULATE = {
  path: 'client',
  select: 'clientCode companyName location phyCode',
  populate: { path: 'location', select: 'name' },
};

export const createEmployee = (data) => Employee.create(data);

export const findEmployees = (filter, { sort, skip, limit }) =>
  Employee.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate(CLIENT_POPULATE);

export const countEmployees = (filter = {}) => Employee.countDocuments(filter);

export const findEmployeeById = (id) =>
  Employee.findById(id).populate(CLIENT_POPULATE);

export const findEmployeesForCompute = (filter) =>
  Employee.find(filter).select(
    'employeeNo employeeName ptGross pTax unmatched phyCode client clientCode period locationName',
  );

export const findEmployeeByKey = (employeeNo, phyCode, period) =>
  Employee.findOne({ employeeNo, phyCode: phyCode || '', period });

/** Preload employees for a salary period so import can skip per-row finds. */
export const findEmployeesByPeriod = (period) =>
  Employee.find({ period: String(period).trim() });

export const findUnmatchedEmployees = () =>
  Employee.find({ unmatched: true }).select(
    'employeeNo employeeName phyCode clientCode period locationName state ptGross pTax upload',
  );

export const saveEmployee = (employee, session = null) =>
  employee.save(session ? { session } : {});

export const bulkWriteEmployees = (ops, options = {}) =>
  Employee.bulkWrite(ops, { ordered: false, ...options });

export const softDeleteEmployees = (filter, actorId) =>
  Employee.updateMany(
    { ...filter, isDeleted: false },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: actorId,
      },
    },
  );

export const countEmployeesForPurge = (filter) =>
  Employee.countDocuments({ ...filter, isDeleted: false });

/**
 * Sum stored P.Tax per client/period for Form 5 vs MasterSheet checks.
 * Soft-delete is not auto-applied on aggregate — filter isDeleted here.
 */
export const aggregatePTaxByClientPeriod = ({
  periods = [],
  clientIds = [],
  clientCodes = [],
} = {}) => {
  const periodList = [...new Set((periods || []).map(String).filter(Boolean))];
  const objectIds = [...new Set((clientIds || []).map(String).filter(Boolean))]
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const codes = [
    ...new Set(
      (clientCodes || [])
        .map((code) => String(code).trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  if (!periodList.length || (!objectIds.length && !codes.length)) {
    return Promise.resolve([]);
  }

  const or = [];
  if (objectIds.length) or.push({ client: { $in: objectIds } });
  if (codes.length) or.push({ clientCode: { $in: codes } });

  return Employee.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        unmatched: { $ne: true },
        period: { $in: periodList },
        $or: or,
      },
    },
    {
      $group: {
        _id: {
          period: '$period',
          client: '$client',
          clientCode: '$clientCode',
        },
        salaryPtTotal: { $sum: { $ifNull: ['$pTax', 0] } },
        employeeCount: { $sum: 1 },
      },
    },
  ]);
};
