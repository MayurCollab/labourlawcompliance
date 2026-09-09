/**
 * Design tokens consumed by Tailwind / shadcn via CSS variables in
 * styles/index.css. Keep this file as the JS-side reference for spacing,
 * radius, and semantic color names.
 *
 * Brand: cool slate shell + teal primary (labour / compliance).
 */
export const designTokens = {
  colors: {
    background: 'var(--background)',
    foreground: 'var(--foreground)',
    primary: 'var(--primary)',
    secondary: 'var(--secondary)',
    muted: 'var(--muted)',
    accent: 'var(--accent)',
    destructive: 'var(--destructive)',
    border: 'var(--border)',
    sidebar: 'var(--sidebar)',
    ring: 'var(--ring)',
  },
  brand: {
    name: 'teal-slate',
    hue: 230,
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
  },
  spacing: {
    page: '1.5rem',
    section: '2rem',
    stack: '1rem',
  },
} as const;
