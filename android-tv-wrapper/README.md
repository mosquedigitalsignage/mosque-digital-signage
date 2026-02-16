# MAP Chromecast Stream - Android TV Wrapper

A native Android TV application that wraps the MAP Chromecast Stream web app for optimal TV viewing experience.

## 🎯 **Features**

- **Full-Screen TV Experience**: Optimized for Android TV and Google TV
- **WebView Integration**: Loads your HTML app from GitHub Pages
- **TV Remote Navigation**: Full D-pad and remote control support
- **Chromecast Ready**: Integrates with your existing Chromecast functionality
- **Hardware Acceleration**: Smooth performance on TV hardware
- **Landscape Orientation**: Optimized for TV displays

## 🏗️ **Project Structure**

```
android-tv-wrapper/
├── app/
│   ├── src/main/
│   │   ├── java/com/map/chromecaststream/
│   │   │   └── MainActivity.kt          # Main TV activity
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   └── activity_main.xml    # TV-optimized layout
│   │   │   ├── values/
│   │   │   │   ├── colors.xml           # MAP brand colors
│   │   │   │   ├── strings.xml          # App strings
│   │   │   │   └── themes.xml           # TV themes
│   │   │   └── drawable/
│   │   │       └── app_banner.png       # TV banner (320x180)
│   │   └── AndroidManifest.xml          # TV manifest
│   └── build.gradle                     # App dependencies
├── build.gradle                         # Project config
├── settings.gradle                      # Project settings
└── README.md                            # This file
```

## 🚀 **Build Instructions**

### **Prerequisites**
- Android Studio Arctic Fox (2020.3.1) or later
- Android SDK 34 (Android 14)
- Kotlin 1.9.10 or later
- Google Play Services (for TV features)

### **Build Steps**

1. **Open Project**
   ```bash
   # Open Android Studio
   # File → Open → Select android-tv-wrapper folder
   ```

2. **Sync Project**
   ```bash
   # Click "Sync Project with Gradle Files"
   # Or File → Sync Project with Gradle Files
   ```

3. **Build APK**
   ```bash
   # Build → Build Bundle(s) / APK(s) → Build APK(s)
   # Or use command line:
   ./gradlew assembleDebug
   ```

4. **Install on TV**
   ```bash
   # Enable Developer Options on your Android TV
   # Enable USB Debugging
   # Connect via ADB and install:
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

## 📱 **Installation on Android TV**

### **Method 1: ADB Installation (Recommended)**
```bash
# Connect to your TV via ADB
adb connect YOUR_TV_IP:5555

# Install the APK
adb install app/build/outputs/apk/debug/app-debug.apk

# Launch the app
adb shell am start -n com.map.chromecaststream/.MainActivity
```

### **Method 2: Google Play Store (Production)**
1. Build release APK with signing
2. Upload to Google Play Console
3. Publish to Android TV category
4. Install from Play Store on TV

### **Method 3: Sideload via USB**
1. Copy APK to USB drive
2. Insert into Android TV
3. Use file manager to install APK
4. Enable "Install from unknown sources"

## 🎮 **TV Remote Navigation**

- **D-pad**: Navigate between elements
- **Center/Enter**: Activate focused element
- **Back**: Navigate back in WebView history
- **Home**: Return to TV home screen
- **Menu**: Context menu (if available)

## 🔧 **Customization**

### **Change Web App URL**
Edit `MainActivity.kt`:
```kotlin
// Change this line to your web app URL
webView.loadUrl("https://your-domain.com/your-app")
```

### **Modify TV Optimizations**
Edit the CSS injection in `MainActivity.kt`:
```kotlin
private fun injectTVOptimizations() {
    val css = """
        <style>
            /* Your custom TV CSS here */
        </style>
    """.trimIndent()
    // ... rest of the function
}
```

### **Add App Icon and Banner**
- **App Icon**: Replace `app/src/main/res/mipmap/ic_launcher.png`
- **TV Banner**: Replace `app/src/main/res/drawable/app_banner.png`
  - Size: 320x180 pixels
  - Format: PNG
  - Style: TV-optimized with clear branding

## 🧪 **Testing**

### **Local Testing**
1. Build and install on Android TV device
2. Test WebView loading and navigation
3. Verify TV remote functionality
4. Check full-screen display

### **Chromecast Testing**
1. Ensure your web app Chromecast integration works
2. Test casting from the TV app
3. Verify media playback controls

### **Performance Testing**
1. Monitor memory usage on TV
2. Check WebView performance
3. Test with different TV resolutions (4K, 8K)

## 🚨 **Troubleshooting**

### **Common Issues**

**WebView Not Loading**
- Check internet connection
- Verify URL accessibility
- Check WebView permissions

**TV Navigation Issues**
- Ensure focus handling is correct
- Check D-pad event handling
- Verify TV-specific themes

**Performance Problems**
- Enable hardware acceleration
- Check memory usage
- Optimize WebView settings

### **Debug Commands**
```bash
# Check app logs
adb logcat | grep "MAPChromecastStream"

# Force stop and restart
adb shell am force-stop com.map.chromecaststream
adb shell am start -n com.map.chromecaststream/.MainActivity

# Clear app data
adb shell pm clear com.map.chromecaststream
```

## 📋 **Requirements**

- **Minimum SDK**: 21 (Android 5.0 Lollipop)
- **Target SDK**: 34 (Android 14)
- **TV Features**: Leanback launcher support
- **Permissions**: Internet, Network State, Wake Lock
- **Orientation**: Landscape (TV-optimized)

## 🔗 **Links**

- **Web App**: [https://itsecretary-map.github.io/chromecast_stream/](https://itsecretary-map.github.io/chromecast_stream/)
- **GitHub Repository**: [Your Repo URL]
- **Google Play Console**: [For production deployment]

## 📄 **License**

This project is part of the MAP Chromecast Stream application.
Contact the Muslim Association of Greater Pittsburgh for usage rights.

---

**Built with ❤️ for the MAP Community**
