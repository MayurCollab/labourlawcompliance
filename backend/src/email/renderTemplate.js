/**
 * Minimal template renderer — replaces {{placeholder}} tokens with values.
 * Missing variables render as an empty string.
 */
const renderTemplate = (template, variables = {}) =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, key) =>
    variables[key] !== undefined && variables[key] !== null
      ? String(variables[key])
      : '',
  );

export default renderTemplate;
