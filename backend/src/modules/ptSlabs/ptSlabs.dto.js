export const toPtSlabDto = (slab) => ({
  id: slab.id,
  salaryFrom: slab.salaryFrom,
  salaryTo: slab.salaryTo,
  rate: slab.rate,
  label: slab.label,
  effectiveFrom: slab.effectiveFrom,
  effectiveTo: slab.effectiveTo,
  sortOrder: slab.sortOrder,
  createdAt: slab.createdAt,
  updatedAt: slab.updatedAt,
});

export const toPtSlabListDto = (slabs) => slabs.map(toPtSlabDto);
