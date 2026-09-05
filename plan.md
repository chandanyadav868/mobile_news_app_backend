# 📋 Implementation Plan: Inshorts-Style Rich Image Banner Notifications on Android

## 📌 Executive Summary

The user provided a photographic comparison of notifications on their physical Android device:
1. **Top Notification ("News Flow")**: Rendered as a plain-text card (`BigTextStyle`) without an image, showing only `Sports • Breaking Alert`, headline, and summary.
2. **Bottom Notification ("Inshorts")**: Rendered with a full-width, edge-to-edge **BigPictureStyle image banner** with a built-in **"Share"** action button.

This document details the exact root causes in the frontend and backend, explains the Android OS notification architecture, and presents a rock-solid implementation plan to achieve the identical Inshorts visual presentation.

---

## 🔍 Deep-Dive Root Cause Analysis

### 1. Frontend: The `expo-notifications` Architectural Limitation
In [`services/notificationService.ts`](file:///d:/live-project/mobile_app_news/services/notificationService.ts#L220-L241), notifications are scheduled using:
```typescript
await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
        title: cleanHeadline,
        subtitle: `${category || 'News'} • Breaking Alert`,
        body: cleanSummary,
        attachments: [
            {
                url: validImage,
                identifier: 'news-image',
                type: 'image',
            },
        ],
        data: { ... }
    }
});
```

#### Why Android Completely Ignores `attachments`:
1. In `node_modules/expo-notifications/src/Notifications.types.ts`:
   ```typescript
   export type NotificationContentInput = {
       ...
       /**
        * The visual and audio attachments to display alongside the notification's main content.
        * @platform ios
        */
       attachments?: NotificationContentAttachmentIos[];
   }
   ```
   **`attachments` is an iOS-only API** that maps to Apple's `UNNotificationAttachment`.
2. In `node_modules/expo-notifications/android/.../NotificationContent.java`:
   - For local notifications, `getImage()` only inspects `ai.metaData.getInt("expo.modules.notifications.large_icon")` (a static app icon defined at compile-time in `AndroidManifest.xml`).
   - It **does not parse `attachments`** and **does not download remote HTTP image URLs**.
3. In `node_modules/expo-notifications/android/.../ExpoNotificationBuilder.kt`:
   - Line 152 sets:
     ```kotlin
     bitmap?.let { builder.setLargeIcon(it) }
     ```
     `setLargeIcon()` on Android only shows a small square avatar on the right side of the notification.
   - It hardcodes `NotificationCompat.BigTextStyle` for text content.
   - **`ExpoNotificationBuilder` does NOT implement `NotificationCompat.BigPictureStyle` for local notifications.**

---

### 2. Backend: Remote Push Limitations
In [`backend/src/services/deviceRegistryService.ts`](file:///d:/live-project/mobile_app_news/backend/src/services/deviceRegistryService.ts#L149-L155):
```typescript
const messages = pushTokens.map((token) => ({
    to: token,
    sound: 'default',
    priority: 'high',
    channelId: 'breaking-news',
    title: `⚡ ${latestArticle.category.toUpperCase()}: ${latestArticle.title}`,
    body: latestArticle.summary,
    attachments: [{ url: latestArticle.imageUrl }],
    richMedia: { image: latestArticle.imageUrl },
}));
```
- While Expo Push Service accepts `richMedia: { image }`, when the push arrives on an Android device, `expo-notifications`'s Android client builder still routes through `ExpoNotificationBuilder.kt`.
- Because `ExpoNotificationBuilder.kt` only calls `builder.setLargeIcon(it)`, it **never expands into the hero edge-to-edge BigPictureStyle** banner seen in Inshorts.

---

### 3. How Inshorts Achieves BigPictureStyle on Android
In native Android development, Inshorts uses the Android Support/AndroidX Notification API:
```kotlin
val bigPictureStyle = NotificationCompat.BigPictureStyle()
    .bigPicture(downloadedBitmap)         // The large image banner
    .setBigContentTitle(headline)          // Headline shown when expanded
    .setSummaryText(summary)               // Summary shown beneath image
    .bigLargeIcon(null as Bitmap?)         // Removes the thumbnail when expanded

val notification = NotificationCompat.Builder(context, "breaking-news")
    .setSmallIcon(R.drawable.ic_notification)
    .setContentTitle(headline)
    .setContentText(summary)
    .setStyle(bigPictureStyle)
    .setPriority(NotificationCompat.PRIORITY_MAX)
    .addAction(R.drawable.ic_share, "Share", shareIntent) // Inshorts Share Action Button
    .setAutoCancel(true)
    .build()
```

---

## 🎯 Architecture Comparison & Solution Options

| Feature | `expo-notifications` (Current) | `react-native-notify-kit` (Inshorts Equivalent) |
| :--- | :--- | :--- |
| **Android BigPictureStyle** | ❌ Not Supported (Only small icon or BigText) | ✅ Native First-Class (`AndroidStyle.BIGPICTURE`) |
| **Automatic Image Download** | ❌ Fails on Android local notifications | ✅ Automatically fetches & decodes image URL into Bitmap |
| **Notification Action Buttons** | ⚠️ Complex/limited on Android | ✅ Full support (`actions: [{ title: 'Share' }]`) |
| **Expo Managed Workflow** | ✅ Standard Expo module | ✅ Official Expo Config Plugin (`react-native-notify-kit`) |
| **TurboModules & React Native 0.85+** | ⚠️ Legacy bridge | ✅ Modern TurboModules / New Architecture |
| **Reliability on Android 12-15** | ⚠️ Falls back to plain text | ✅ Verified on Android 10, 11, 12, 13, 14, 15 |

---

## 🚀 Step-by-Step Implementation Strategy

### Step 1: Install `react-native-notify-kit`
Install the community-maintained, TurboModule-ready Notifee fork designed specifically for Android BigPictureStyle, rich media, and Expo CNG in modern React Native:
```bash
npm install react-native-notify-kit
```
Add `"react-native-notify-kit"` to `plugins` in [`app.json`](file:///d:/live-project/mobile_app_news/app.json).

---

### Step 2: Implement Inshorts-Style Notification Dispatcher ([`services/notificationService.ts`](file:///d:/live-project/mobile_app_news/services/notificationService.ts))
Upgrade `triggerLocalDeviceNotification` and `scheduleDelayedNotification` to use `react-native-notify-kit` on Android:
```typescript
import notifee, { AndroidStyle, AndroidImportance } from 'react-native-notify-kit';

public async triggerLocalDeviceNotification(
    title: string,
    body: string,
    category: string,
    article?: NewsItem,
    imageUrl?: string | null
) {
    const validImage = imageUrl || article?.image || article?.imageUrl;
    const cleanHeadline = title.replace(/^⚡\s*\d+\s*New\s+[^:]+:\s*/i, '').trim();
    const cleanSummary = body.replace(/<[^>]+>/g, '').slice(0, 140).trim();

    // 1. Create high-importance Android Notification Channel with sound & vibration
    const channelId = await notifee.createChannel({
        id: 'breaking-news',
        name: 'NewsFlow Breaking Alerts',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
    });

    // 2. Display identical Inshorts-grade notification with BigPicture & Share action
    await notifee.displayNotification({
        id: article?.id ? `news-${article.id}` : `news-${Date.now()}`,
        title: cleanHeadline,
        body: cleanSummary,
        data: {
            category,
            articleId: article?.id,
            articleUrl: article?.link,
            imageUrl: validImage,
        },
        android: {
            channelId,
            importance: AndroidImportance.HIGH,
            pressAction: {
                id: 'default',
            },
            // 🖼️ INSHORTS BIG PICTURE HERO BANNER:
            style: validImage
                ? {
                      type: AndroidStyle.BIGPICTURE,
                      picture: validImage,
                  }
                : {
                      type: AndroidStyle.BIGTEXT,
                      text: cleanSummary,
                  },
            actions: [
                {
                    title: 'Share ↗',
                    pressAction: { id: 'share' },
                },
            ],
        },
    });
}
```

---

### Step 3: Handle Notification Action Clicks (Share & Open Story)
Listen for notification action events (e.g., when the user taps "Share ↗" directly from the Android status bar):
```typescript
notifee.onForegroundEvent(async ({ type, detail }) => {
    if (detail.pressAction?.id === 'share') {
        const articleUrl = detail.notification?.data?.articleUrl;
        const title = detail.notification?.title;
        if (articleUrl) {
            Share.share({ message: `${title}\n\nRead more on NewsFlow: ${articleUrl}` });
        }
    }
});
```

---

### Step 4: Backend Notification Payload Alignment ([`backend/src/services/deviceRegistryService.ts`](file:///d:/live-project/mobile_app_news/backend/src/services/deviceRegistryService.ts))
Ensure the backend push dispatcher includes both Expo and FCM-compliant image keys:
```typescript
data: {
    articleId: latestArticle.id,
    category: latestArticle.category,
    url: latestArticle.url,
    imageUrl: latestArticle.imageUrl,
    image: latestArticle.imageUrl,
    bigPicture: latestArticle.imageUrl,
}
```

---

### Step 5: Verification & Testing
1. **Local Notification Test**: Trigger a test notification via `NotificationManager.triggerLocalDeviceNotification`.
2. **Visual Verification**: Pull down Android notification shade and confirm:
   - ✅ Big picture hero image expands edge-to-edge.
   - ✅ Title and summary appear cleanly above and below image.
   - ✅ "Share ↗" action button is clickable directly in the notification card.
3. **Build Verification**: Run `npx tsc --noEmit` and EAS build / Expo export.
