import React from 'react';
import CrowwSaveButton from '../../rive/CrowwSaveButton';

/**
 * SaveButton now delegates to CrowwSaveButton.
 * Optimistic UI remains forbidden: visual state reflects confirmed React state.
 */
const SaveButton = ({
    saved,
    onToggle,
    disabled,
    accessibilityLabel,
    size = 44,
    style,
}) => {
    return (
        <CrowwSaveButton
            saved={saved}
            onToggle={onToggle}
            disabled={disabled}
            accessibilityLabel={accessibilityLabel}
            size={size}
            style={style}
        />
    );
};

export default SaveButton;

