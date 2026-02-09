import React from 'react';
import { View } from 'react-native';
// We will use a simple text placeholder or vector icons if available.
// For now, let's just assume we'll use text or a simple shape.
// Ideally usage of @expo/vector-icons
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const TabBarIcon = ({ focused, name }) => {
    return (
        <Ionicons
            name={name}
            size={24}
            color={focused ? COLORS.primary : COLORS.secondary}
        />
    );
};

export default TabBarIcon;
