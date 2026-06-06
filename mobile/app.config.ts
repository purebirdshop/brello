// mobile/app.config.ts
// Dynamic Expo config. Reads from environment variables
// so secrets never live in app.json.
// Run: EXPO_PUBLIC_* vars are safe to expose to the client.

import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name:    'LocalLoop',
  slug:    'localloop',
  version: '1.0.0',
  scheme:  'localloop',

  orientation:       'portrait',
  userInterfaceStyle: 'automatic',

  icon:    './assets/icon.png',
  splash: {
    image:      './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a',
  },

  assetBundlePatterns: ['**/*'],

  ios: {
    bundleIdentifier:  'com.localloop.app',
    supportsTablet:    true,
    buildNumber:       '1',
    infoPlist: {
      NSCameraUsageDescription:
        'LocalLoop needs camera access to record your introduction video.',
      NSMicrophoneUsageDescription:
        'LocalLoop needs microphone access to record audio in your introduction.',
      NSPhotoLibraryUsageDescription:
        'LocalLoop needs photo library access to upload your profile photo.',
      NSPhotoLibraryAddUsageDescription:
        'LocalLoop needs photo library access to save your introduction video.',
      NSContactsUsageDescription:
        'LocalLoop uses your contacts to find friends already on the app.',
      NSLocationWhenInUseUsageDescription:
        'LocalLoop shows jobs near you. Your exact location is never shared.',
    },
    config: {
      googleSignIn: {
        reservedClientId: process.env.GOOGLE_REVERSED_CLIENT_ID ?? '',
      },
    },
  },

  android: {
    package:     'com.localloop.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f172a',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_CONTACTS',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.VIBRATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
    ],
    googleServicesFile: './google-services.json',
  },

  plugins: [
    'expo-router',
    'expo-location',
    [
      'expo-camera',
      {
        cameraPermission:     'LocalLoop needs camera access to record your introduction video.',
        microphonePermission: 'LocalLoop needs microphone access for your introduction video.',
        recordAudioAndroid:   true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:  'LocalLoop needs photo library access to upload your profile photo.',
        cameraPermission:  'Allow LocalLoop to take photos.',
      },
    ],
    [
      'expo-notifications',
      {
        icon:  './assets/notification-icon.png',
        color: '#16a34a',
        sounds: ['./assets/notification.wav'],
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: process.env.GOOGLE_REVERSED_CLIENT_ID ?? '',
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    router: { origin: false },
    eas:    { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '' },
  },

  updates: {
    url: `https://u.expo.dev/${process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? ''}`,
  },

  runtimeVersion: {
    policy: 'appVersion',
  },
})
