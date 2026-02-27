export default {
  "expo": {
    "name": "Croww",
    "slug": "croww-app",
    "owner": "nashnewton",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/app-icon.jpg",
    "scheme": "crowwapp",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.croww.app",
      "googleServicesFile": "./GoogleService-Info.plist",
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
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/app-icon.jpg",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/app-icon.jpg"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "package": "com.croww.app",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ],
      "config": {
        "googleMaps": {
          "apiKey": process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      "googleServicesFile": "./google-services.json",
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
      "favicon": "./assets/app-icon.jpg",
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
          "locationAlwaysPermission": "Allow Croww to access your location to show nearby events.",
          "locationWhenInUsePermission": "Allow Croww to access your location to show nearby events."
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "Allow Croww to access your camera to take profile photos and scan documents."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow Croww to access your photos to upload profile images."
        }
      ],
      // "@sentry/react-native",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
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
