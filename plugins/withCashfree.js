const { withProjectBuildGradle, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withCashfree(config) {
    config = withProjectBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            config.modResults.contents = addCashfreeMaven(config.modResults.contents);
        } else {
            throw new Error('Cannot add Cashfree maven gradle because the build.gradle is not groovy');
        }
        return config;
    });

    config = withAndroidManifest(config, (config) => {
        const androidManifest = config.modResults;
        const mainApplication = androidManifest.manifest.application[0];

        // Add tools namespace
        if (!androidManifest.manifest.$['xmlns:tools']) {
            androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
        }

        // Add tools:replace="android:allowBackup"
        if (mainApplication.$['tools:replace']) {
            const currentReplace = mainApplication.$['tools:replace'];
            if (!currentReplace.includes('android:allowBackup')) {
                mainApplication.$['tools:replace'] = `${currentReplace},android:allowBackup`;
            }
        } else {
            mainApplication.$['tools:replace'] = 'android:allowBackup';
        }

        // Ensure android:allowBackup is set (usually true or false, Cashfree might require one)
        // But tools:replace allows overriding whatever libraries say.
        // We'll leave allowBackup as is, just ensure replacement is allowed.

        return config;
    });

    return config;
};

function addCashfreeMaven(buildGradle) {
    if (buildGradle.includes('maven.cashfree.com')) {
        return buildGradle;
    }

    const pattern = /allprojects\s*{\s*repositories\s*{/;
    if (buildGradle.match(pattern)) {
        return buildGradle.replace(
            pattern,
            `allprojects {
    repositories {
        maven { url "https://maven.cashfree.com/release" }`
        );
    }

    return buildGradle.replace(
        /repositories\s*{/,
        `repositories {
        maven { url "https://maven.cashfree.com/release" }`
    );
}
