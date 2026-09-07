/**
 * Fixed Form 5 HTML layouts shipped with the app. Codes are stable API keys;
 * files live under html/ relative to this folder.
 */
const LOCATION_NAME_ALIASES = Object.freeze({
  kapadvanj: 'kapadwanj',
  kapadwanj: 'kapadwanj',
});

export const normalizeLocationMatchKey = (name) =>
  String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const matchBundledTemplateCodeForLocation = (locationName) => {
  const raw = normalizeLocationMatchKey(locationName);
  if (!raw) return null;
  const wanted = LOCATION_NAME_ALIASES[raw] || raw;

  for (const definition of BUNDLED_FORM5_TEMPLATES) {
    for (const name of definition.locationNames || []) {
      const key = normalizeLocationMatchKey(name);
      const aliased = LOCATION_NAME_ALIASES[key] || key;
      if (key === raw || aliased === wanted || key === wanted) {
        return definition.code;
      }
    }
  }
  return null;
};
export const BUNDLED_FORM5_TEMPLATES = Object.freeze([
  {
    code: 'form5-general',
    name: 'General Form-5 Template',
    file: 'general.html',
    originalName: 'general.html',
    isGlobalDefault: true,
    locationNames: [],
  },
  {
    code: 'form5-jamnagar-gandhidham',
    name: 'Jamnagar Gandhidham Form-5 Template',
    file: 'jamnagar-gandhidham.html',
    originalName: 'jamnagar-gandhidham.html',
    locationNames: ['Jamnagar', 'Gandhidham'],
  },
  {
    code: 'form5-kapadwanj',
    name: 'Kapadwanj Form-5 Template',
    file: 'kapadwanj.html',
    originalName: 'kapadwanj.html',
    locationNames: ['Kapadwanj', 'Kapadvanj'],
  },
  {
    code: 'form5-mehsana',
    name: 'Mehsana Form-5 Template',
    file: 'mehsana.html',
    originalName: 'mehsana.html',
    locationNames: ['Mehsana'],
  },
  {
    code: 'form5-navsari',
    name: 'Navsari Form-5 Template',
    file: 'navsari.html',
    originalName: 'navsari.html',
    locationNames: ['Navsari'],
  },
  {
    code: 'form5-surendranagar',
    name: 'Surendranagar Form-5 Template',
    file: 'surendranagar.html',
    originalName: 'surendranagar.html',
    locationNames: ['Surendranagar'],
  },
]);

export const BUNDLED_FORM5_BY_CODE = new Map(
  BUNDLED_FORM5_TEMPLATES.map((entry) => [entry.code, entry]),
);

export const bundledStoredPath = (code) => `bundled:${code}`;

export const codeFromBundledPath = (storedPath) => {
  const raw = String(storedPath || '');
  if (!raw.startsWith('bundled:')) return null;
  return raw.slice('bundled:'.length) || null;
};
