import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
    MOBILE_MAX: 767,
    TABLET_MIN: 768,
    TABLET_MAX: 1100,
    DESKTOP_MIN: 1101,
};

/**
 * Responsive layout hook for Croww.
 * Breakpoint strategy:
 * - < 768px: Mobile (strictly unchanged)
 * - 768px – 1100px: Tablet adaptation
 * - > 1100px: Dedicated Desktop composition
 */
export function useResponsiveLayout() {
    const { width, height } = useWindowDimensions();

    const isMobile = width < BREAKPOINTS.TABLET_MIN;
    const isTablet = width >= BREAKPOINTS.TABLET_MIN && width <= BREAKPOINTS.TABLET_MAX;
    const isDesktop = width > BREAKPOINTS.TABLET_MAX;

    return {
        width,
        height,
        isMobile,
        isTablet,
        isDesktop,
        isWide: width >= BREAKPOINTS.TABLET_MIN,
        contentMaxWidth: isDesktop ? 1280 : isTablet ? 900 : '100%',
    };
}

export default useResponsiveLayout;
