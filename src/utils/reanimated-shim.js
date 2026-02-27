import { Platform } from 'react-native';

if (typeof global !== 'undefined' && typeof global.Platform === 'undefined') {
    global.Platform = Platform;
}

// Add any other globals that Reanimated 4 worklets might miss
if (typeof global !== 'undefined' && typeof global.process === 'undefined') {
    global.process = { env: {} };
}
