const { withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RIVE_SOURCE_DIR = 'assets/rive';

/**
 * Expo Config Plugin to copy and link .riv animation assets into the iOS app bundle.
 * Ensures Bundle.main.url(forResource:withExtension:) resolves successfully on native iOS.
 */
module.exports = function withRiveAssets(config) {
    // 1. Copy .riv files into the native iOS project directory during prebuild
    config = withDangerousMod(config, [
        'ios',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const iosNamedDir = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName);
            const sourceDir = path.join(projectRoot, RIVE_SOURCE_DIR);

            if (!fs.existsSync(sourceDir)) {
                return config;
            }

            if (!fs.existsSync(iosNamedDir)) {
                fs.mkdirSync(iosNamedDir, { recursive: true });
            }

            const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.riv'));

            files.forEach((file) => {
                const srcPath = path.join(sourceDir, file);
                // Copy original filename (e.g. empty-states.riv)
                const destOriginal = path.join(iosNamedDir, file);
                fs.copyFileSync(srcPath, destOriginal);

                // Also copy underscored version (e.g. empty_states.riv) to match nativeResource resolution
                const underscoredFile = file.replace(/-/g, '_');
                if (underscoredFile !== file) {
                    const destUnderscored = path.join(iosNamedDir, underscoredFile);
                    fs.copyFileSync(srcPath, destUnderscored);
                }
            });

            return config;
        },
    ]);

    // 2. Link copied .riv files into the Xcode project "Resources" build phase
    config = withXcodeProject(config, (config) => {
        const xcodeProject = config.modResults;
        const projectName = config.modRequest.projectName;
        const projectRoot = config.modRequest.projectRoot;
        const sourceDir = path.join(projectRoot, RIVE_SOURCE_DIR);

        if (!fs.existsSync(sourceDir)) {
            return config;
        }

        const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.riv'));
        const allFiles = new Set();
        files.forEach((f) => {
            allFiles.add(f);
            allFiles.add(f.replace(/-/g, '_'));
        });

        const groupName = projectName; // Main project group in Xcode

        try {
            IOSConfig.XcodeUtils.ensureGroupRecursively(xcodeProject, groupName);
        } catch (_) {}

        allFiles.forEach((file) => {
            const relativeFilePath = path.join(projectName, file);
            try {
                IOSConfig.XcodeUtils.addResourceFileToGroup({
                    filepath: relativeFilePath,
                    groupName: groupName,
                    project: xcodeProject,
                    isBuildFile: true,
                });
            } catch (err) {
                // If already added or group resolution fails, avoid blocking build
                console.warn(`[withRiveAssets] Warning adding ${file} to Xcode resources:`, err?.message);
            }
        });

        return config;
    });

    return config;
};
