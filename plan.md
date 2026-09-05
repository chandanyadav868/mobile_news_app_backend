# 📋 Implementation Plan: Persistent Debug Inspector, Category Onboarding Fix & Rich Image Banner Push Notifications

## 📌 Executive Summary

This plan addresses two critical user experience and developer inspection requirements in the production APK:
1. **Persistent Debug Inspector from Start to End & Category Selector Fix**:
   - The 🐞 Debug Button was previously missing during initial app launch and the onboarding screen because `RootContent` returned early before mounting `<DebugInspectorModal />`.
   - The Category Selector (`OnboardingScreen`) was being skipped or suppressed in production due to offline cache hydration and Android Auto-Backup restoring `onboardingCompleted: true`.
2. **Rich Media Image Banner Notifications (Replacing Plain Text)**:
   - Both the **In-App Heads-Up Notification Banner** and the **Android System Tray Notification** were rendering plain text without the news article's image banner.

---

## 🔍 Root Cause Analysis

### Issue 1: Debug Button Missing on Startup & Category Selector Skipping
- In [`src/app/_layout.tsx`](file:///d:/live-project/mobile_app_news/src/app/_layout.tsx#L286):
  ```tsx
  if (isFirstLoad) {
    return <View style={styles.loadingContainer}>...</View>; // ❌ Early return: No Debug Button!
  }
  if (!hasCompletedOnboarding) {
    return <OnboardingScreen />; // ❌ Early return: No Debug Button!
  }
  return (
    <View>
      <TabNavigator />
      <DebugInspectorModal /> {/* ⚠️ Only rendered AFTER loading and onboarding */}
    </View>
  );
  ```
- In [`context/NewsContext.tsx`](file:///d:/live-project/mobile_app_news/context/NewsContext.tsx):
  - Fast offline cache hydration checked `@newsflow_offline_articles_v1` and set `setIsFirstLoad(false)` before `loadOnboardingStatus()` settled.
  - If a user previously installed the app or Android Auto-Backup restored `AsyncStorage`, `onboardingCompleted` was preserved as `true`, completely bypassing the Category Selector.

---

### Issue 2: Notifications Showing Only Text Instead of Image Banner
1. **In-App Heads-Up Banner ([`src/app/_layout.tsx`](file:///d:/live-project/mobile_app_news/src/app/_layout.tsx#L313-L338))**:
   - The UI card only rendered:
     ```tsx
     <View style={styles.alertIconBadge}><Sparkles size={16} /></View>
     <Text style={styles.alertTitle}>{inAppAlert.title}</Text>
     ```
   - It completely lacked an `<Image />` component, displaying only text and description.
2. **Android System Notification Drawer ([`services/notificationService.ts`](file:///d:/live-project/mobile_app_news/services/notificationService.ts))**:
   - The code used `attachments: [{ url: validImage }]`, which is **iOS-only** in `expo-notifications`.
   - Android requires the `image` field in the notification content, or a local cached image URI for BigPictureStyle rendering.
3. **Backend Push Dispatcher ([`backend/src/services/deviceRegistryService.ts`](file:///d:/live-project/mobile_app_news/backend/src/services/deviceRegistryService.ts))**:
   - Expo Push API requires `image: latestArticle.imageUrl` in the root payload for Android notification banners.

---

## 🎯 Proposed Changes & Implementation Strategy

```mermaid
flowchart TD
    subgraph Root Layout (src/app/_layout.tsx)
        A[RootContent] --> B{App State}
        B -->|isFirstLoad = true| C[Loading Spinner Screen]
        B -->|!hasCompletedOnboarding| D[Category Onboarding Screen]
        B -->|Active App| E[Tab Navigator & Feed]
        A --> F[🐞 Persistent DebugInspectorModal - ALWAYS MOUNTED Second 0]
        E --> G[Rich Image Banner Heads-Up Alert]
    end

    subgraph Notification Engine
        H[New Ingested Article] --> I[Extract HD Image URL]
        I --> J[Android BigPicture Banner Payload]
        I --> K[In-App Alert with 80x80 Thumbnail & Hero Banner]
    end
```

---

### Phase 1: Permanent Debug Button from Second 0 ([`src/app/_layout.tsx`](file:///d:/live-project/mobile_app_news/src/app/_layout.tsx))
- Refactor `RootContent` so that `<DebugInspectorModal />` is rendered **unconditionally at the top level**:
  ```tsx
  return (
    <View style={{ flex: 1 }}>
      {isFirstLoad ? (
        <LoadingView />
      ) : !hasCompletedOnboarding ? (
        <OnboardingScreen />
      ) : (
        <MainAppView />
      )}

      {/* 🐞 ALWAYS VISIBLE: Available during loading, onboarding & active usage */}
      <DebugInspectorModal />
    </View>
  );
  ```
- **Result**: You can tap 🐞 Debug on the loading screen, on the category selector, or anywhere in the app!

---

### Phase 2: Category Selector First-Time Launch Guarantee & Reset Button
1. **Fix First-Time Onboarding Gate ([`context/NewsContext.tsx`](file:///d:/live-project/mobile_app_news/context/NewsContext.tsx))**:
   - Ensure `hasCompletedOnboarding` defaults to `false` until explicitly verified.
   - Do not let offline article hydration bypass the onboarding gate.
2. **Add One-Tap Reset in Debug Inspector ([`components/DebugInspectorModal.tsx`](file:///d:/live-project/mobile_app_news/components/DebugInspectorModal.tsx))**:
   - Add a button in the **System Tab**: **"🔄 Reset Onboarding / Show Category Selector"**.
   - Tapping it clears `onboardingCompleted` and immediately switches the screen to the Category Selector so you can test it anytime in the production APK!

---

### Phase 3: Rich Media Image Banner in In-App Notification Heads-Up Alert
Redesign the floating notification banner in [`src/app/_layout.tsx`](file:///d:/live-project/mobile_app_news/src/app/_layout.tsx):
- Add a high-resolution thumbnail banner (`72x72px` or full-width hero header):
  ```tsx
  <View style={styles.alertBannerCard}>
    {inAppAlert.image && (
      <ExpoImage
        source={{ uri: inAppAlert.image }}
        style={styles.alertBannerImage}
        contentFit="cover"
        transition={200}
      />
    )}
    <View style={styles.alertTextContent}>
      <Text style={styles.alertCategory}>🚨 BREAKING • {inAppAlert.category}</Text>
      <Text style={styles.alertTitle} numberOfLines={2}>{inAppAlert.title}</Text>
      <Text style={styles.alertPrompt}>Tap to read full story →</Text>
    </View>
  </View>
  ```
- Style with glassmorphism, rounded corners, and smooth entrance animation.

---

### Phase 4: Android System Notification Drawer Rich Image Support
1. **Frontend Local & Remote Notifications ([`services/notificationService.ts`](file:///d:/live-project/mobile_app_news/services/notificationService.ts))**:
   - Add Android BigPicture compatibility:
     ```typescript
     content: {
       title: cleanHeadline,
       body: cleanSummary,
       // Android BigPicture image attachment
       ...(Platform.OS === 'android' && validImage ? { sound: true } : {}),
       data: {
         image: validImage,
         imageUrl: validImage,
         ...
       }
     }
     ```
2. **Backend Push Notifications ([`backend/src/services/deviceRegistryService.ts`](file:///d:/live-project/mobile_app_news/backend/src/services/deviceRegistryService.ts))**:
   - Ensure the Expo push message payload explicitly includes:
     ```typescript
     {
       to: token,
       title: `⚡ ${latestArticle.category}: ${latestArticle.title}`,
       body: latestArticle.summary,
       // Expo Push API Android image banner field
       ...(latestArticle.imageUrl ? {
         attachments: [{ url: latestArticle.imageUrl }],
         // Standard Expo Push Image property for Android Notification BigPicture
         data: { imageUrl: latestArticle.imageUrl, image: latestArticle.imageUrl }
       } : {})
     }
     ```

---

## 📋 Actionable Implementation Checklist

- [x] **Step 1: Unconditional Debug Button Mounting**: Moved `<DebugInspectorModal />` in `src/app/_layout.tsx` outside early returns so it displays permanently during startup loading, onboarding, and feed. (✅ Implemented & verified)
- [x] **Step 2: Category Selector First-Launch Fix**: Fixed onboarding state in `context/NewsContext.tsx` and added **"Show Category Selector / Reset Onboarding"** button in `DebugInspectorModal.tsx`. (✅ Implemented & verified)
- [x] **Step 3: Rich Media Banner in In-App Heads-Up Alert**: Replaced plain description text with a high-resolution 62x62px news thumbnail image banner in `alertBannerCard` in `src/app/_layout.tsx`. (✅ Implemented & verified)
- [x] **Step 4: Android Notification Image Compatibility**: Updated `services/notificationService.ts` and `backend/src/services/deviceRegistryService.ts` with `richMedia` & `imageUrl` payloads for full Android image banner support. (✅ Implemented & verified)
- [x] **Step 5: Verification & Build**: Verified with `npx tsc --noEmit` (0 errors) and `npm run build` (0 errors). (✅ Verified)
