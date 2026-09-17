import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const TabBarIcon = ({ focused, name, color, size = 22 }) => {
    return (
        <Ionicons
            name={name}
            size={size}
            color={color || (focused ? COLORS.accent : COLORS.navInactive)}
        />
    );
};

export default TabBarIcon;
