# Labour Law Compliance — Form 5 implementation prompt

Edit this file, then tell the agent: **implement from this prompt, starting at Phase __**.

Do not skip phases. Follow the existing blueprint patterns. Do not invent extra products (PF, ESI, etc.) unless a later prompt adds them.

---

## 1. Product

Build **ACC Labour Law Compliance** (repo: `labourlawcompliance`) on the current full-stack blueprint (Express 5 + MongoDB + React 19).

This app is a **Gujarat Professional Tax** operations tool for a consultancy that files **Form 5 (Namuno-5)** — *Return of tax payable by employer* under the Gujarat State Tax on Professions, Trades, Callings and Employments Act.

Users upload Excel data, the system stores and processes it, then fills **dynamic Form 5 templates** (different layouts per location / client). More templates will be added later, so **no district layout may be hardcoded**.

### Out of scope for v1

- Online payment to municipality
- Emailing filled forms (only store Mail Status if present)
- Forms other than Form 5
- Multi-company tenancy beyond one consultancy operating many employer clients

---

## 2. Source files already inspected

Base folder: `d:\labourlawcompliance_Docs\OneDrive_1_8-20-2026\`

| File | Meaning |
|---|---|
| `MasterSheet.xlsm` sheet `July.26` | Client register + monthly PT payment tracker. Headers at **row 17**. Data from row 18. Title row 16. |
| `Salary Sheet.xlsx` sheet `OutPut` | Employee dump. Headers at **row 2**. |
| `Salary Sheet.xlsx` sheet `Sheet2` | Pivot of one location — **do not use as primary import**. |
| `Form-5/Form5_General.xlsm` | English Excel Form 5 |
| `Form-5/*.docx` | Gujarati district Word templates (Jamnagar/Gandhidham, Kapadwanj, Mehsana, Navsari, Surendranagar) |
| `Anand-Demo.pdf` | Filled sample |

### MasterSheet columns (row 17)

No. · Status · Task No. · **Client** · **Name of Company** · Drafts to be prepared in the name of · **Location** · P.Tax Amount · Ch. No. · Sent Date · Challan No. · Dated · **Reg No.** · Contact Number · **Fund Code** · **Month** · Received In Bank · Less Payment Received · Link · Mail Status · Original challan status

Sample: Client `C0001`, company `Acer India Pvt. Ltd.`, location `Ahmedabad`, Reg No. `PRC016780178`, Fund Code `G0001`, Month `Jul-2026`.

July-26 snapshot: **152 client rows**, **98 company names**, **72 locations**, **24 fund codes**. Status mostly `G`, some `SGC`. Same legal entity can appear many times with different Client codes and branch tags, e.g. `SMFG India Credit Co. Ltd. [83]`.

### Salary OutPut columns (row 2)

SRNO · **EMPNO** · EMP_NAME · LOCATION · STATE · **PT GROSS** · **PHY_CODE** · **P_TAX**

July SMFG file: **1700 employees**, all Gujarat, all `P_TAX = 200`, `PT GROSS` from ~12,478 upward (all in 12,000+ slab). `PHY_CODE` is a branch code (e.g. `0083`, `0654`).

### Form 5 fields to fill (canonical schema)

Templates differ visually but share this data:

- formTitle / actName
- periodMonthLabel (e.g. `July-26`)
- periodFrom, periodTo
- employerName
- employerAddress
- rcNumber (Reg No.)
- signatoryName (samples: `Dipen C Shah`)
- place (location)
- filingDate
- receiptNumber, paymentDate, amountPaid
- slabs[]: { label, salaryFrom, salaryTo, employeeCount, exemptCount, taxableCount, rate, taxAmount }
- totalA, totalB (default NIL), interest (default NIL), totalPayable
- declaration text (keep as template static text)

Gujarat default slabs (configurable in DB, not hardcoded in generator):

| Slab | Rate |
|---|---|
| Rs. 0 – 2,999 | 0 |
| Rs. 3,000 – 5,999 | 0 |
| Rs. 6,000 – 8,999 | 80 |
| Rs. 9,000 – 11,999 | 150 |
| Rs. 12,000 and above | 200 |

If a template has fewer/more slab rows, map by `salaryFrom`/`salaryTo`/`rate`, not by row index.

---

## 3. Non-negotiable rules

1. **Follow the blueprint.** Backend: Routes → Controller → Service → Repository → Model. Frontend: Pages → React Query hooks → Axios API → Redux only for auth. Zod on both ends. Permissions in `PERMISSION_NAMES` + seeder + frontend `PERMISSIONS` + `PermissionRoute` + nav.
2. **Upsert, never silent-delete.** Re-upload of the same client/employee **updates**. Rows in DB that are **absent from the new file are kept**. Do not wipe a collection on import.
3. **Split master vs monthly.** Client identity (code, name, location, RC, fund code, authority) is stable. PT amount, challan, dates, generated files belong to a **filing for a month**.
4. **Templates are data, not code.** Upload DOCX/XLSX, store a field-mapping JSON against the canonical schema, assign as global default / location default / **client saved default**. Generator only writes mapped fields.
5. **No hardcoded Anand/Mehsana/Navsari layouts.** New templates must work after upload + mapping, without a code change.
6. **Activity log** every import, mapping change, and generate.
7. **Do not commit secrets or binary client Excel dumps into git.** Keep sample fixtures tiny if tests need them.

---

## 4. Upsert keys (locked unless edited below)

| Entity | Match key | On match | On miss in file |
|---|---|---|---|
| Client | `clientCode` (Master `Client`, e.g. C0001) | Update master fields | Keep existing client |
| Client location / RC | same as client (one RC per client code in source) | Update | Keep |
| Monthly filing | `clientCode` + `period` (`YYYY-MM`) | Update month fields (PT amount, challan, etc.) | Keep other months |
| Employee month row | `clientId` or `phyCode` + `employeeNo` + `period` | Update name, location, PT GROSS, P_TAX | Keep employees not in file |
| Template | `code` or filename slug | Update file + mapping if user confirms | Keep |

Import must return a report: `inserted`, `updated`, `unchanged`, `skipped` (with reason), `unmatched` (salary rows that could not be tied to a client).

**Assumption to confirm:** salary `PHY_CODE` matches the number in the company name brackets (`[83]` ↔ `0083` or `83`) and/or Master Client rows for that company. If unmatched, show them in the import report; do not drop them — store against a pending/unmatched bucket for that upload.

---

## 5. Salary upload identity

A salary workbook is **one employer (legal company)**, many locations/branches.

On upload the user must select:

- Company / fund (or we parse the header company name if present)
- Period month (default from filename/header, e.g. July-26)
- Which sheet to import (default `OutPut` if present)

Then map each row’s `PHY_CODE` + `LOCATION` to Client records.

---

## 6. Template assignment

Priority when generating Form 5 for a client:

1. Client saved template (if set)
2. Location default template
3. Global default template
4. Block generate with a clear error if none

UI: user picks a template **once** and can **Save as default for this client**. Also allow Save as default for this location, and Set global default.

Mapping UI: list canonical fields → bind to placeholder names in the uploaded file (`{{rcNumber}}`) or to Excel cells (`F14`). Support DOCX and XLSX. PDF output via conversion of the filled DOCX/XLSX is fine in a later phase if DOCX download ships first.

Gujarati Word files currently use a non-Unicode font (extracted text is garbled). **Do not try to OCR them in v1.** For v1: convert/upload templates that use **Unicode Gujarati or English placeholders**. Keep originals as reference. Document this in the Templates page help text.

---

## 7. Architecture to add

### Backend modules

- `clients` — employer client master
- `locations` — optional lookup (or embed on client if simpler; prefer a Location collection because 72 places and template-per-location)
- `uploads` — stored file + parse job + import report
- `employees` — employee month snapshots
- `filings` — one Form 5 return per client per month (computed slabs + amounts + generated files)
- `templates` — file, mapping, assignment (global / location / client)
- `ptSlabs` — effective-dated slab table

### Permissions (add to seeder)

```
clients.view | clients.create | clients.edit | clients.delete
uploads.view | uploads.create
employees.view
filings.view | filings.create | filings.edit | filings.generate
templates.view | templates.create | templates.edit | templates.delete
```

### Frontend pages

- Dashboard (counts: clients, this month filings, pending generate, unmatched salary)
- Clients (table + drawer)
- Uploads (master + salary, preview, import report)
- Employees (filter by client / location / month)
- Form 5 workspace (pick month, list clients, compute, generate, download)
- Templates (upload, map fields, assignments)

Reuse DataTable, Drawer, FileUpload, FormWrapper, ConfirmDialog, PermissionGate.

### Suggested libraries (backend)

- `xlsx` or `exceljs` for Excel parse/fill
- `pizzip` + `docxtemplater` for DOCX fill
- Keep PDF generation for a later phase unless it is cheap after DOCX

---

## 8. Phases (implement in this order)

### Phase 0 — Foundation

- App copy: ACC Labour Law Compliance (package.json description, dashboard title, README).
- Permissions + seeder + frontend constants + nav + routes.
- Generic document upload middleware (xlsx, xlsm, xls, docx, pdf) with size limits; store via existing storage driver.
- Empty page shells behind permission routes so nav works.

**Done when:** admin can log in and see the new nav items; seeder is idempotent.

### Phase 1 — Masters

- Client model + CRUD UI.
- Location + authority name on client.
- PT slabs CRUD with Gujarat defaults seeded.
- Manual client create/edit without Excel.

**Done when:** admin can create a client and see default slabs.

### Phase 2 — Master sheet ingest

- Upload MasterSheet, detect header row (search for `Client` + `Name of Company` + `Reg No.`).
- Preview first N rows + column mapping (auto-map known headers, allow override).
- Import with upsert rules in section 4.
- Monthly filing stub created/updated for the sheet’s Month + P.Tax Amount + challan fields.

**Done when:** re-uploading the same file updates the 152 clients and does not delete any; adding a new Client code inserts; removing a row from Excel does not delete the DB client.

### Phase 3 — Salary ingest

- Upload salary Excel, sheet picker, period picker, company picker.
- Import OutPut rows with upsert rules.
- Unmatched PHY_CODE report.

**Done when:** re-upload updates matching EMPNO+phyCode+month; employees only in DB remain; new EMPNOs insert.

### Phase 4 — PT processing engine

- Given client + month: load employees (by phyCode/client), bucket by PT GROSS into slabs, compute tax.
- Prefer computed slab from PT GROSS; keep source `P_TAX` for variance checks (flag if computed rate ≠ sheet P_TAX).
- Save result on the filing (Total A, Total B NIL, interest NIL).
- UI: show slab table before generate.

**Done when:** Anand SMFG-style data produces one slab row 12,000+ with count × 200 = tax, matching Form 5 samples.

### Phase 5 — Dynamic templates

- Upload template file.
- Field mapper vs canonical schema.
- Assignments: global, location, client.
- “Save this template for this client”.

**Done when:** a second template can be added and used with mapping only — no new generator code.

### Phase 6 — Generate Form 5

- Fill mapped template, store output, download.
- Re-generate replaces current output but keeps previous files in history (or version number).
- Filename: `{clientCode}_{location}_{YYYY-MM}_Form5.ext`

**Done when:** generating for a mapped English Excel template produces a downloadable file with employer name, RC, period, slab counts, totals, signatory, place, date.

### Phase 7 — Month workspace

- Filter by month, location, client, generate status.
- Bulk generate for selected rows (skip those without a template).
- Show master payment fields (challan, sent date) on the same row.

**Done when:** user can process a full month list without opening each client.

### Phase 8 — Harden

- Unit tests: slab math, upsert (insert/update/keep).
- Integration: upload parse + generate happy path with a tiny fixture.
- Import error Excel download.
- Activity log coverage.

**Done when:** tests pass; failed rows are visible; no data loss on re-import.

---

## 9. Assumptions (edit if wrong)

1. One consultancy, many employer **clients**. App users are staff, not the employers.
2. Client code `C0001` is the stable business key from MasterSheet.
3. `PHY_CODE` in salary maps to the branch tag in company names and/or a field we should add on Client (`phyCode`).
4. Signatory defaults to a single global setting, overridable per client. Seed empty; do not hardcode a person’s name in code. Store in settings/client.
5. Employer **address** is missing from MasterSheet — add an editable field on Client; templates need it.
6. Status `G` / `SGC` is stored as-is; meaning can be documented later.
7. First generate format is **filled XLSX and/or DOCX**, not PDF.
8. Implement **inside this repo**, do not clone a second project.
9. Complete one phase at a time and wait for confirmation before starting the next.

---

## 10. Open questions — fill before or during Phase 0

Copy answers under each item:

1. **Salary ↔ client match:** PHY_CODE vs [83] vs Client code — which is official?
   - **Answer:** Client code (`C0001`) is the stable business key. Salary `PHY_CODE` maps to the branch tag in company names (`[83]` ↔ `0083` / `83`) and/or a `phyCode` field on Client (added in Phase 1). Unmatched salary rows go to a pending bucket for that upload — they are never dropped.
2. **Address source:** will you add addresses in the app, or is there another sheet?
   - **Answer:** Editable `address` field on Client in the app. No other sheet identified.
3. **Signatory:** one person for all filings, or per client?
   - **Answer:** One global default, overridable per client. Seed empty; do not hardcode a person’s name.
4. **Gujarati templates:** will you provide Unicode/placeholder versions, or should Phase 5 include a conversion helper?
   - **Answer:** Unicode Gujarati or English placeholder templates. No OCR/conversion helper in v1. Keep originals as reference.
5. **Should unmatched salary rows block Form 5 for that branch, or generate with a warning?**
   - **Answer:** Generate with a warning. Unmatched rows are excluded from slab counts until mapped; they stay in the pending bucket.
6. **Replace-month option:** later, a checkbox “this file is the full list for this company/month — deactivate missing employees”? Default is **no**.
   - **Answer:** Default is **no**. Do not add this checkbox in v1 unless a later phase asks.
7. **Any extra Form 5 templates to include in v1 besides the six already in Form-5/?**
   - **Answer:** No extra templates in v1. New templates are uploaded and mapped in-app.

---

## 11. Implementation constraints for the coding agent

- Small, reviewable diffs per phase. After each phase, stop and summarize what to click-test.
- Do not drive-by refactor the blueprint.
- Do not add markdown docs other than updating this file’s “Phase status” below.
- Verify UI in the browser when frontend changes (login, new pages, upload preview).
- Keep Excel original files on disk as user data; do not copy the full 1700-row production sheet into the repo.

---

## Phase status

| Phase | Status |
|---|---|
| 0 Foundation | Done |
| 1 Masters | Done |
| 2 Master ingest | Done |
| 3 Salary ingest | Done |
| 4 PT engine | Done |
| 5 Templates | Done |
| 6 Generate | Done |
| 7 Workspace | Done |
| 8 Harden | Done |
