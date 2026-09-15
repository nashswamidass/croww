const APP_ENV = process.env.APP_ENV;
const FIREBASE_PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

if (APP_ENV === "staging" && FIREBASE_PROJECT_ID !== "croww-staging-2026") {
  throw new Error(
    "Staging builds must set EXPO_PUBLIC_FIREBASE_PROJECT_ID=croww-staging-2026. Refusing to bake another Firebase project."
  );
}

if (APP_ENV === "production-preview" && FIREBASE_PROJECT_ID !== "croww-live-2026") {
  throw new Error(
    "Production-preview mode must set EXPO_PUBLIC_FIREBASE_PROJECT_ID=croww-live-2026. Refusing non-production project."
  );
}

export default {
  "expo": {
    "name": "Croww",
    "slug": "croww-app",
    "owner": "nashnewton",
    "version": "1.0.5",
    "orientation": "portrait",
    "icon": "./assets/app-icon.png",
    "scheme": "crowwapp",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.croww.app",
      "buildNumber": "28",
      "googleServicesFile": process.env.APP_ENV === 'staging' ? "./GoogleService-Info.staging.plist" : "./GoogleService-Info.plist",
      "config": {
        "googleMapsApiKey": process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false,
        "LSApplicationQueriesSchemes": [
          "phonepe",
          "tez",
          "paytmmp",
          "bhim",
          "amazonpay",
          "credpay",
          "upi",
          "gpay"
        ]
      }
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#1A1A1A",
        "foregroundImage": "./assets/app-icon.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/app-icon.png"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "package": "com.croww.app",
      "versionCode": 12,
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ],
      "config": {
        "googleMaps": {
          "apiKey": process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      "googleServicesFile": process.env.APP_ENV === 'staging' ? "./google-services.staging.json" : "./google-services.json",
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "crowwapp"
            }
          ],
          "category": [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ]
    },
    "web": {
      "output": "spa",
      "favicon": "./assets/croww favicon.png",
      "config": {
        "googleMaps": {
          "apiKey": process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
    },
    "plugins": [
      "@react-native-community/datetimepicker",
      [
        "expo-location",
        {
          "locationAlwaysPermission": "Allow Croww to access your location to show nearby properties and localities.",
          "locationWhenInUsePermission": "Allow Croww to access your location to show nearby properties and localities."
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "Allow Croww to access your camera to take property and profile photos and scan documents."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow Croww to access your photos to upload property and profile images."
        }
      ],
      // "@sentry/react-native",
      [
        "expo-splash-screen",
        {
          "image": "./assets/app-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#000000",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/app-icon.png",
          "color": "#ffffff"
        }
      ],
      "./plugins/withCashfree.js"
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": false
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "6a8dcff3-e1f3-47cb-be4d-8c3c21aead1f"
      }
    }
  }
};
