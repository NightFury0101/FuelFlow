# Switching on accounts and cloud sync (Firebase)

FuelFlow uses Firebase for accounts (email and password) and Cloud Firestore to back up and sync each person's data. The app itself stays on GitHub Pages. The free Firebase plan (Spark) is enough; no card is needed.

## 1. Create the project

1. Go to <https://console.firebase.google.com> and tap **Create a project**.
2. Name it `FuelFlow`. You can turn off Google Analytics.

## 2. Add the web app and copy its config

1. On the project overview page, tap the **</>** (Web) icon.
2. Give it a nickname (`FuelFlow web`) and tap **Register app**. You don't need Firebase Hosting.
3. Firebase shows a `firebaseConfig` block. Copy it into [`src/firebaseConfig.ts`](./src/firebaseConfig.ts), replacing `null`:

```ts
export const firebaseConfig: FirebaseWebConfig | null = {
  apiKey: 'AIza…',
  authDomain: 'fuelflow-xxxx.firebaseapp.com',
  projectId: 'fuelflow-xxxx',
  storageBucket: 'fuelflow-xxxx.firebasestorage.app',
  messagingSenderId: '…',
  appId: '1:…:web:…',
};
```

These values are public by design and safe to commit. **Never** commit a service-account file or anything containing `private_key`.

## 3. Turn on email sign-in

1. Go to **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**. Leave "Email link" off and save.
3. Under **Settings → Authorized domains**, tap **Add domain** and enter `nightfury0101.github.io`.

## 4. Create the database and its rules

1. Go to **Build → Firestore Database → Create database**.
2. Pick a nearby location, such as `asia-south1` (Mumbai) or `asia-southeast1` (Singapore). You can't change it later.
3. Choose **Start in production mode**.
4. Open the **Rules** tab, replace everything with the contents of [`firestore.rules`](./firestore.rules) and tap **Publish**.

The rules let each person read and write only their own data under `users/{their uid}`. Everything else is refused.

## 5. Recommended protections

- **API key restriction.** In <https://console.cloud.google.com/apis/credentials>, open the "Browser key" Firebase created and add the website restriction `https://nightfury0101.github.io/*`.
- **Password reset emails.** These work out of the box. To customise the wording, go to **Authentication → Templates**.

## How sync works

- Each phone keeps its own copy, so FuelFlow stays instant and works offline.
- Changes are queued on the phone and uploaded a moment later. If you're offline, they upload when the connection returns.
- When the app opens, it does one quick check for changes from your other devices, and only downloads when something changed.
- The first time someone signs in on a phone that already has data, both sides are kept. The account's version wins only where the same record exists on both.
- Signing out removes the data, the AI coach keys and the chat history from that phone. The data stays safe in the account.
- **Delete my account** (in Profile) deletes every document in the account and then the account itself.

### Firestore layout

| Path | Contents |
| --- | --- |
| `users/{uid}` | `json` (profile and recent foods), `syncId`, `updatedAt` |
| `users/{uid}/entries/{id}` | one diary entry per document |
| `users/{uid}/water/{id}`, `weights/{id}`, `planned/{id}` | water, weigh-ins, meal plan |
| `users/{uid}/customFoods/{id}`, `favorites/{id}`, `savedMeals/{id}` | foods, recipes, favourites, saved meals |

Free-plan limits are 50,000 reads and 20,000 writes per day, which is plenty for a pilot. Each logged item is one write, and opening the app costs one read unless another device changed something.
