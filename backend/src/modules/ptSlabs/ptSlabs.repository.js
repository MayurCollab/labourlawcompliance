import PtSlab from './ptSlab.model.js';

export const createPtSlab = (data) => PtSlab.create(data);

export const findPtSlabs = (filter = {}, { sort } = {}) =>
  PtSlab.find(filter).sort(sort ?? { sortOrder: 1, salaryFrom: 1 });

export const findPtSlabById = (id) => PtSlab.findById(id);

export const findPtSlabByRange = ({ salaryFrom, salaryTo, effectiveFrom }) =>
  PtSlab.findOne({ salaryFrom, salaryTo, effectiveFrom });

export const savePtSlab = (slab, session = null) =>
  slab.save(session ? { session } : {});
