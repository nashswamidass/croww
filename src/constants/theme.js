export const COLORS = {
  // Core Dark Palette
  background: '#0A0A0A',       // Pure black
  surface: '#1A1A1A',          // Card backgrounds
  surfaceHighlight: '#252525', // Hover/Active states
  border: '#333333',           // Subtle borders

  // Text
  primary: '#FFFFFF',          // Main text
  secondary: '#A0A0A0',        // Muted text

  // Accents (Neon/Vibrant)
  accent: '#C1FF72',           // Logo Green (Primary CTA)
  accentDark: '#A3E635',       // Darker lime/green for pressed states
  success: '#00FF88',          // Green for success/verified
  error: '#FF4444',            // Red for errors/destructive actions
  warning: '#FFB800',          // Yellow/Orange for warnings

  // Event Category Colors
  accents: {
    pink: '#FF006E',
    blue: '#00D9FF',
    orange: '#FF8C00',
    purple: '#A855F7',
    yellow: '#FFD700',
  }
};

export const SPACING = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
};

export const FONT_SIZES = {
  xs: 11,
  s: 12,
  m: 14,
  l: 16,
  xl: 22,
  xxl: 26,
  xxxl: 32,
};

// Dark shadows are subtle but add depth
export const SHADOWS = {
  soft: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
};

export const BORDER_RADIUS = {
  s: 6,
  m: 10,
  l: 16,
  xl: 24,
  round: 999,
};
