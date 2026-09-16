import React from 'react';
import CrowwPostProgress from '../../rive/CrowwPostProgress';

const PostProgress = ({ stepIndex = 0, stepCount = 4, label }) => (
    <CrowwPostProgress
        step={stepIndex + 1}
        totalSteps={stepCount}
    />
);

export default PostProgress;
