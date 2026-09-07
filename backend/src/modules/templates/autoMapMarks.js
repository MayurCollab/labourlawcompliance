/**
 * Guess canonical binds from sample values in a filled / highlighted template.
 * Distinctive strings first; leftover numeric marks stay for the mapper.
 */
export const autoMapFromMarks = (cells = [], mapping) => {
  const scalars = { ...mapping.scalars };
  const used = new Set(Object.values(scalars).filter(Boolean));

  const unused = () =>
    cells.filter((cell) => cell.value && !used.has(cell.bind));

  const take = (key, predicate) => {
    if (scalars[key]) return;
    const cell = unused().find((item) => predicate(item.value, item));
    if (!cell) return;
    scalars[key] = cell.bind;
    used.add(cell.bind);
  };

  const compact = (value) => String(value).replace(/\s+/g, '');
  const asNumber = (value) => {
    const n = Number(String(value).replace(/[, ]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  take(
    'employerName',
    (value) => {
      if (value.length <= 8) return false;
      if (/name of the employer\s*:/i.test(value)) return true;
      return (
        /(ltd|limited|pvt|llp|insurance|finance|credit co)/i.test(value) &&
        !/return of tax payable by employer under|address\s*:/i.test(value)
      );
    },
  );
  take(
    'employerAddress',
    (value) => {
      if (
        /name of the employer\s*:/i.test(value) &&
        /address\s*:/i.test(value)
      ) {
        return true;
      }
      return (
        /(road|floor|shop|plot|stand|arcade|plaza|survey|complex|ward|bazar)/i.test(
          value,
        ) && value.length > 12
      );
    },
  );
  take(
    'rcNumber',
    (value) =>
      /^(PRN?|PRC|KRN)[-]?\d+/i.test(compact(value)) ||
      /^P\s*R\s*[\d\s]{3,}$/i.test(value.trim()),
  );
  take(
    'periodMonthLabel',
    (value) =>
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[.\s-]*\d{2}$/i.test(
        compact(value),
      ),
  );
  take(
    'periodFrom',
    (value) => /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim()),
  );
  take(
    'periodTo',
    (value) => /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim()),
  );
  take(
    'signatoryName',
    (value) => /(shri|shree)\s+[A-Za-z]/i.test(value),
  );
  take('place', (value) => /^place\s*:\s*[A-Za-z]/i.test(value.trim()));
  take(
    'filingDate',
    (value) =>
      /dt\.?\s*:\s*\d{2}\/\d{2}\/\d{4}/i.test(value) ||
      /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim()),
  );
  take('totalB', (value) => /^(nil|\/\/\/+)$/i.test(value.trim()));
  take('interest', (value) => /^(nil|\/\/\/+)$/i.test(value.trim()));

  const amounts = unused()
    .map((cell) => ({
      cell,
      number: asNumber(cell.value),
    }))
    .filter((item) => item.number != null && item.number >= 200);

  // Prefer amounts that repeat (Form 5 shows Total A in several cells).
  const byValue = new Map();
  for (const item of amounts) {
    const list = byValue.get(item.number) || [];
    list.push(item);
    byValue.set(item.number, list);
  }
  const rankedAmounts = [...byValue.entries()]
    .map(([number, list]) => ({
      number,
      list,
      score: list.length * 10 + (number % 200 === 0 ? 5 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.number - a.number);

  if (!scalars.totalA && rankedAmounts[0]) {
    scalars.totalA = rankedAmounts[0].list[0].cell.bind;
    used.add(rankedAmounts[0].list[0].cell.bind);
  }
  if (!scalars.totalPayable && rankedAmounts[0]?.list[1]) {
    scalars.totalPayable = rankedAmounts[0].list[1].cell.bind;
    used.add(rankedAmounts[0].list[1].cell.bind);
  } else if (!scalars.totalPayable && scalars.totalA) {
    if (/^(docx:|pdf:)/.test(String(scalars.totalA))) {
      scalars.totalPayable = scalars.totalA;
    } else if (rankedAmounts[0]?.list[0]) {
      // same Total A value often reused for total payable
      const again = rankedAmounts[0].list.find(
        (item) => !used.has(item.cell.bind),
      );
      if (again) {
        scalars.totalPayable = again.cell.bind;
        used.add(again.cell.bind);
      } else {
        scalars.totalPayable = scalars.totalA;
      }
    }
  }
  if (
    !scalars.amountPaid &&
    scalars.totalA &&
    /^(docx:|pdf:)/.test(String(scalars.totalA))
  ) {
    scalars.amountPaid = scalars.totalA;
  }

  const topSlab = (mapping.slabs || []).find((row) => row.salaryFrom === 12000);
  if (topSlab) {
    const totalAValue =
      asNumber(
        cells.find((cell) => cell.bind === scalars.totalA)?.value,
      ) || rankedAmounts[0]?.number;

    const rate = Number(topSlab.rate) || 200;
    const expectedCount =
      totalAValue && rate > 0 && totalAValue % rate === 0
        ? totalAValue / rate
        : null;

    if (expectedCount != null) {
      const countCells = unused()
        .map((cell) => ({ cell, number: asNumber(cell.value) }))
        .filter((item) => item.number === expectedCount);
      if (!topSlab.binds.employeeCount && countCells[0]) {
        topSlab.binds.employeeCount = countCells[0].cell.bind;
        used.add(countCells[0].cell.bind);
      }
      if (!topSlab.binds.taxableCount && countCells[1]) {
        topSlab.binds.taxableCount = countCells[1].cell.bind;
        used.add(countCells[1].cell.bind);
      } else if (!topSlab.binds.taxableCount && topSlab.binds.employeeCount) {
        topSlab.binds.taxableCount = topSlab.binds.employeeCount;
      }
      if (!topSlab.binds.taxAmount && totalAValue) {
        const taxCell = unused().find(
          (cell) => asNumber(cell.value) === totalAValue,
        );
        if (taxCell) {
          topSlab.binds.taxAmount = taxCell.bind;
          used.add(taxCell.bind);
        } else if (scalars.totalA) {
          topSlab.binds.taxAmount = scalars.totalA;
        }
      }
      if (!topSlab.binds.rate) {
        const rateCell = unused().find((cell) => asNumber(cell.value) === rate);
        if (rateCell) {
          topSlab.binds.rate = rateCell.bind;
          used.add(rateCell.bind);
        }
      }
    } else {
      const counts = unused()
        .map((cell) => ({
          cell,
          number: asNumber(cell.value),
        }))
        .filter(
          (item) =>
            item.number != null &&
            Number.isInteger(item.number) &&
            item.number > 0 &&
            item.number < 500 &&
            item.number !== 80 &&
            item.number !== 150 &&
            item.number !== 200,
        );
      if (!topSlab.binds.employeeCount && counts[0]) {
        topSlab.binds.employeeCount = counts[0].cell.bind;
        used.add(counts[0].cell.bind);
      }
      if (!topSlab.binds.taxableCount && counts[1]) {
        topSlab.binds.taxableCount = counts[1].cell.bind;
        used.add(counts[1].cell.bind);
      }
      const tax = unused()
        .map((cell) => ({
          cell,
          number: asNumber(cell.value),
        }))
        .find((item) => item.number != null && item.number >= 200 && item.number % 200 === 0);
      if (!topSlab.binds.taxAmount && tax) {
        topSlab.binds.taxAmount = tax.cell.bind;
        used.add(tax.cell.bind);
      }
    }
  }

  return { ...mapping, scalars };
};
