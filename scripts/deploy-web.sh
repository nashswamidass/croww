#!/bin/bash

echo "🚀 Starting web deployment process..."

# 1. Export Web
echo "📦 Exporting Expo web build..."
npx expo export --platform web --clear

# 2. Fix node_modules issues (Firebase Hosting ignores node_modules @ all levels)
echo "🔧 Patching asset paths recursively..."

# First, rename all node_modules directories to vendor recursively
# We use -depth to ensure we rename children before parents if needed
find dist/assets -depth -name "node_modules" -type d -execdir mv {} vendor \; 2>/dev/null

# Update ALL JS bundles to replace any /node_modules/ with /vendor/
# This catches nested ones and various path formats
perl -i -pe 's/node_modules/vendor/g' dist/_expo/static/js/web/*.js

echo "✅ All node_modules renamed to vendor and paths patched."

# 3. Cache Busting for JS bundles
echo "🧹 Applying cache busting..."
TIMESTAMP=$(date +%s)
APP_ENTRY_JS=$(ls dist/_expo/static/js/web/AppEntry-*.js 2>/dev/null | head -n 1)
if [ -f "$APP_ENTRY_JS" ]; then
    BASENAME=$(basename "$APP_ENTRY_JS")
    NEW_FILENAME="AppEntry-$TIMESTAMP.js"
    mv "$APP_ENTRY_JS" "dist/_expo/static/js/web/$NEW_FILENAME"
    sed -i '' "s/$BASENAME/$NEW_FILENAME/g" dist/index.html
    echo "✅ Applied cache bust: $BASENAME -> $NEW_FILENAME"
else
    echo "⚠️ Could not find AppEntry JS file for cache busting. Checking if already renamed..."
    # If it was already renamed to a previous timestamp, we might need to handle it, 
    # but since 'npx expo export' recreates dist, it should be there with a fresh hash.
fi

# 4. Prerender Static Pages for SEO
echo "🖼️ Prerendering static pages..."
node scripts/prerender.mjs

# 5. Deploy to Firebase
echo "🚀 Deploying to Firebase Hosting..."
npx -p firebase-tools firebase deploy --only hosting:croww-app --project croww-live-2026

echo "✨ Deployment complete!"
