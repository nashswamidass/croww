const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro resolves .riv files as bundled assets
if (!config.resolver.assetExts.includes('riv')) {
    config.resolver.assetExts.push('riv');
}

module.exports = config;
