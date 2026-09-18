import React from 'react';
import Svg, { Circle, Path, G } from 'react-native-svg';

/**
 * CrowwAreaIntelligenceIcon
 *
 * Custom geometric vector icon for Croww Locality Intelligence:
 * - Central location node
 * - Concentric curved signal contour rings
 * - Converging locality data nodes & radial network geometry
 * - Balanced circular form
 *
 * Replaces generic AI sparkle icons across the app.
 */
export default function CrowwAreaIntelligenceIcon({
    size = 24,
    color = '#7C3AED',
    focused = false,
    style,
}) {
    return (
        <Svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            style={style}
        >
            <G id="croww-locality-intelligence">
                {/* Outer signal boundary */}
                <Circle
                    cx="12"
                    cy="12"
                    r="10.5"
                    stroke={color}
                    strokeWidth="1.1"
                    strokeDasharray="3 2.5"
                    opacity={focused ? 0.5 : 0.35}
                />

                {/* Middle locality contour ring */}
                <Circle
                    cx="12"
                    cy="12"
                    r="7.8"
                    stroke={color}
                    strokeWidth="1.3"
                    strokeDasharray="8 3"
                    opacity={focused ? 0.75 : 0.6}
                />

                {/* Inner signal ring */}
                <Circle
                    cx="12"
                    cy="12"
                    r="5.0"
                    stroke={color}
                    strokeWidth="1.4"
                    opacity={focused ? 0.95 : 0.8}
                />

                {/* Radial connection spokes (signals converging onto location) */}
                <Path
                    d="M12 9.6 L12 4.8 M14.4 12 L18.2 12 M12 14.4 L12 19.2 M9.6 12 L5.8 12"
                    stroke={color}
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    opacity={focused ? 0.85 : 0.65}
                />

                {/* Converging signal nodes */}
                <Circle cx="12" cy="3.6" r="1.3" fill={color} />
                <Circle cx="19.4" cy="12" r="1.3" fill={color} />
                <Circle cx="12" cy="20.4" r="1.3" fill={color} />
                <Circle cx="4.6" cy="12" r="1.3" fill={color} />

                {/* Central location core */}
                <Circle
                    cx="12"
                    cy="12"
                    r="2.5"
                    fill={color}
                />
            </G>
        </Svg>
    );
}
