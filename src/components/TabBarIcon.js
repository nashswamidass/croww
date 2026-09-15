import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const TabBarIcon = ({ focused, name }) => {
    return (
        <Ionicons
            name={name}
            size={24}
            color={focused ? COLORS.accent : COLORS.secondary}
        />
    );
};

export default TabBarIcon;
