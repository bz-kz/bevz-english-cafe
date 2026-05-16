import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
};

export const firebaseApp: FirebaseApp = getApps()[0] ?? initializeApp(config);

export const firebaseAuth: Auth = getAuth(firebaseApp);

// e2e/local-only: env-gated Auth emulator wiring. In prod (Vercel) this env
// var is unset at build time → Next.js inlines `undefined` → dead branch,
// behaviour identical to before this block existed.
if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST) {
  connectAuthEmulator(
    firebaseAuth,
    `http://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST}`,
    { disableWarnings: true }
  );
}
