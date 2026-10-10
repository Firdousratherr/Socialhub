/**
 * Shared native design tokens aligned with the Socialhub website.
 * Keep screen-specific colors here so the Android app stays visually consistent.
 */
export const colors = {
  bg: "#F6F7FB",
  panel: "#FFFFFF",
  panel2: "#F0F2F7",
  panel3: "#E8EAF2",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  subtle: "#9CA3AF",
  accent: "#5A4BE8",
  accentBright: "#4C3FD0",
  accentSoft: "#EEEBFF",
  success: "#15803D",
  danger: "#DC2626",
  warning: "#B45309",
  black: "#111827",
  white: "#FFFFFF",
  // Reserved for full-screen media viewers that intentionally use a dark canvas.
  onDark: "#F8FAFC",
  mutedOnDark: "#D1D5DB",
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;
