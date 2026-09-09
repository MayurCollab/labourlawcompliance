import { themeQuartz } from 'ag-grid-community';

/**
 * Shared AG Grid theme — reads app CSS variables so light/dark stay in sync
 * with the full product theme.
 */
export const appAgGridTheme = themeQuartz.withParams({
  fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
  fontSize: 14,
  borderRadius: 10,
  wrapperBorderRadius: 14,
  spacing: 8,
  headerFontWeight: 600,
  headerFontSize: 12,
  rowBorder: true,
  columnBorder: false,
  accentColor: 'var(--primary)',
  backgroundColor: 'var(--card)',
  foregroundColor: 'var(--foreground)',
  borderColor: 'var(--border)',
  headerBackgroundColor: 'color-mix(in oklch, var(--primary) 8%, var(--muted))',
  headerTextColor: 'color-mix(in oklch, var(--foreground) 75%, var(--primary))',
  oddRowBackgroundColor: 'color-mix(in oklch, var(--muted) 55%, transparent)',
  rowHoverColor: 'color-mix(in oklch, var(--accent) 75%, transparent)',
  selectedRowBackgroundColor: 'color-mix(in oklch, var(--primary) 14%, transparent)',
  chromeBackgroundColor: 'var(--card)',
  cellTextColor: 'var(--foreground)',
});
