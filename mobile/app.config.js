export default {
  expo: {
    name: "LawnFlow",
    slug: "lawnflow-customer",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "lawnflow",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "ai.lawnflow.customer",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        NSCameraUsageDescription: "Take photos of your property",
        NSPhotoLibraryUsageDescription: "Choose photos for job details",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "ai.lawnflow.customer",
      googleServicesFile: "./google-services.json",
      permissions: [
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "POST_NOTIFICATIONS",
      ],
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
    ],
    extra: {
      apiUrl: process.env.API_BASE_URL || "http://localhost:3000",
    },
  }
};
