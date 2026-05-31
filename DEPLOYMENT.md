# Croww Mobile App Deployment Guide

## Environments
- **Production**: Project `croww-live-2026`
- **Staging**: Project `croww-staging-2026` (Uses `TEST` Cashfree env)

## Switching Environments
I have added automated scripts to `package.json` to swap your database config:

### 1. Switch to Staging
```bash
npm run set-env:staging
```
This copies `.env.staging` to `.env`. Now when you run `npx expo start`, it will hit the staging database.

### 2. Switch to Production
```bash
npm run set-env:production
```
This copies `.env.production` to `.env`.

## Native Configurations
The `app.config.js` is set up to automatically toggle between native config files:
- **Staging**: Uses `google-services.staging.json` and `GoogleService-Info.staging.plist`.
- **Production**: Uses `google-services.json` and `GoogleService-Info.plist`.

## Branching & Deployment
1. **Develop** in the `staging` branch.
2. **Test** locally by running `APP_ENV=staging npx expo start`.
3. **Release** by merging `staging` into `main` and building the production IPA/APK.
