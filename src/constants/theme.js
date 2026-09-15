export const COLORS = {
  // Core Light Consumer Palette
  background: '#F7F7F5',       // Warm, soft light neutral canvas
  surface: '#FFFFFF',          // Pure white card surfaces
  surfaceElevated: '#FFFFFF',  // Floating cards & sheets
  surfaceHighlight: '#F0F0EE', // Hover / active pill states
  surfaceSubtle: '#FAFAFA',    // Secondary containers
  border: '#E5E7EB',           // Standard soft borders
  borderSubtle: '#F1F2F4',     // Very soft delimiters
  borderLight: '#D1D5DB',      // Active focus borders

  // Text
  primary: '#111827',          // Deep charcoal / near-black
  secondary: '#6B7280',        // Modern neutral mid-grey
  tertiary: '#9CA3AF',         // Soft metadata grey
  text: '#111827',             // Alias for primary
  textSecondary: '#6B7280',    // Alias for secondary

  // Accents (Restrained, high-contrast Croww emerald)
  accent: '#0F766E',           // Restrained teal/emerald CTA
  accentDark: '#0D645D',       // Darker tone for active/press
  accentMuted: '#ECFDF5',      // Soft mint badge/container
  accentGlow: 'rgba(15, 118, 110, 0.12)',

  // Status Colors
  success: '#059669',          // Verified green
  successMuted: '#ECFDF5',     // Soft verified badge container
  error: '#DC2626',            // Destructive / error red
  warning: '#D97706',          // Alert / warning amber
  info: '#2563EB',             // Informational blue

  // Event Category Colors (preserves legacy support)
  accents: {
    pink: '#E11D48',
    blue: '#2563EB',
    orange: '#EA580C',
    purple: '#7C3AED',
    yellow: '#D97706',
  }
};

export const SPACING = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const FONT_SIZES = {
  micro: 11,
  xs: 12,
  s: 13,
  m: 15,
  l: 17,
  xl: 20,
  xxl: 24,
  title: 28,
  display: 34,
};

export const TOUCH_TARGETS = {
  min: 48,
  button: 52,
  buttonLarge: 56,
  buttonSmall: 44,
  iconButton: 48,
  hitSlop: { top: 12, bottom: 12, left: 12, right: 12 },
};

export const BORDER_RADIUS = {
  s: 8,
  m: 12,
  l: 18,
  card: 20,
  xl: 24,
  sheet: 28,
  round: 999,
  pill: 999,
  button: 16,
  input: 14,
};

export const SHADOWS = {
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};
