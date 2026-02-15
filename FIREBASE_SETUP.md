# Firebase setup for carousel uploads

Uploaded photos are stored in **Firebase** so both you and your partner see the same carousel on any device (and it works on GitHub Pages).

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** → name it (e.g. `valentinesday2026`) → follow the steps (Analytics optional).
3. When the project is ready, click the **Web** icon (</>) to add an app.
4. Register the app with a nickname (e.g. "Valentine site"). You can leave **Firebase Hosting** unchecked.
5. Copy the `firebaseConfig` object they show you. You will paste it into `script.js` in the next step.

## 2. Enable Firestore and Storage

- In the left sidebar: **Build** → **Firestore Database** → **Create database** → start in **test mode** (you can tighten rules later) → choose a region.
- **Build** → **Storage** → **Get started** → use default (test mode) → Done.

You don’t create a bucket yourself: clicking **Get started** creates the project’s default bucket. If that step fails, see the section below.

## 3. Add your config to the site

Open **script.js** and find the block near the top that looks like:

```js
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};
```

Replace it with the config from the Firebase Console (keep the same property names; use your real values).

## 4. Create the Firestore index (one-time)

The carousel loads photos ordered by `createdAt`. The first time you load the site after adding config, the browser may show an error with a **link to create an index**. Open that link, create the index in Firebase, wait a minute, then refresh the site.  
If you prefer to create it manually: Firestore → **Indexes** → **Composite** → collection `carouselPhotos`, field `createdAt` ascending.

## 5. (Optional) Tighten security rules

In Firebase Console:

- **Firestore** → **Rules**: you can restrict who can write (e.g. only you two) if you add Firebase Auth later. For a private site with a password, test mode or the rules below are common:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /carouselPhotos/{doc} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }
  }
}
```

- **Storage** → **Rules**: allow uploads and reads for the carousel folder:

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /carousel/{allPaths=**} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

For a public repo, your upload password in `script.js` is the only gate; the rules above keep the project simple. You can lock down write access later with Firebase Auth.

## 6. If Storage won’t enable or “create bucket” fails

You only need the **default** bucket (created when you click **Get started** in Storage). If you get an error:

- **“Upgrade to Blaze” or billing**  
  Firebase sometimes asks for the Blaze plan to enable Storage. You can upgrade, set a budget (e.g. $0 or $5), and stay on the free tier for small use. No card charges unless you exceed the free limits.

- **“Permission denied” or “Access denied”**  
  Use the Google account that **owns** the Firebase project. If the project was created by someone else, they need to add you as Owner in **Project settings** → **Users and permissions**.

- **“Bucket already exists” or “Resource already exists”**  
  Storage may already be on. In the left sidebar click **Storage**. If you see a **Files** tab and **Rules**, the default bucket exists. Copy the bucket name from the top of the Storage page (or from **Project settings** → your app config → `storageBucket`) into `script.js` and skip creating anything.

- **“Location / region” errors**  
  When you click **Get started**, pick a **single region** (e.g. `us-central1` or `nam5`) and use the default bucket. Don’t try to create an extra bucket in another region unless you need it.

- **Enable the Storage API**  
  Open [Google Cloud Console](https://console.cloud.google.com/) → select your Firebase project → **APIs & Services** → **Library** → search **Cloud Storage for Firebase** → enable it. Then try **Get started** in Firebase → Storage again.

If Storage still won’t turn on, say what exact message you see (or a screenshot) and we can narrow it down.

## 7. If upload gets stuck or times out

- **Storage rules:** In Firebase Console → **Storage** → **Rules**, make sure the `carousel` path can be written. Use the rules in section 5 (allow read, write for `carousel/{allPaths=**}`). If rules are too strict, uploads hang or fail.
- **Bucket name:** In **Project settings** (gear) → **General** → your app’s config, copy the `storageBucket` value exactly into `script.js` (some projects use `.appspot.com`, others `.firebasestorage.app`).
- **Browser console:** Press F12 → **Console**. When you try to upload, look for red errors (e.g. `storage/unauthorized` or `permission-denied`). Those point to rules or config.

## 8. Deploy to GitHub Pages

Push your repo (with the real `firebaseConfig` in `script.js`) and publish the branch to GitHub Pages. Both of you can then open the site, unlock, and use **+ Add Photo**. New photos will appear for both of you and persist across devices.

**Note:** Your Firebase config (apiKey, etc.) will be visible in the client. That is normal for web apps. Security is enforced by Firestore and Storage rules, not by hiding the config.
