import type { FirebaseOptions } from "firebase/app";

type RuntimeEnv = Record<string, string | undefined>;

const runtimeEnv = import.meta.env as RuntimeEnv;

function readEnv(names: string[], required = true) {
  for (const name of names) {
    const value = runtimeEnv[name]?.trim();
    if (value) {
      return value;
    }
  }

  if (required) {
    throw new Error(`Missing environment variable: ${names.join(" or ")}`);
  }

  return null;
}

export const supabaseUrl = readEnv(["NEXT_PUBLIC_SUPABASE_URL"])!;
export const supabaseAnonKey = readEnv([
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
])!;

const firebaseApiKey = readEnv(["NEXT_PUBLIC_FIREBASE_API_KEY"], false);
const firebaseAuthDomain = readEnv(["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"], false);
const firebaseProjectId = readEnv(["NEXT_PUBLIC_FIREBASE_PROJECT_ID"], false);
const firebaseAppId = readEnv(["NEXT_PUBLIC_FIREBASE_APP_ID"], false);
const firebaseMessagingSenderId = readEnv(
  ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"],
  false,
);
const firebaseStorageBucket = readEnv(
  ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"],
  false,
);

let resolvedFirebaseConfig: FirebaseOptions | null = null;

if (firebaseApiKey && firebaseAuthDomain && firebaseProjectId && firebaseAppId) {
  const config: FirebaseOptions = {
    apiKey: firebaseApiKey,
    appId: firebaseAppId,
    authDomain: firebaseAuthDomain,
    projectId: firebaseProjectId,
  };

  if (firebaseMessagingSenderId) {
    config.messagingSenderId = firebaseMessagingSenderId;
  }

  if (firebaseStorageBucket) {
    config.storageBucket = firebaseStorageBucket;
  }

  resolvedFirebaseConfig = config;
}

export const firebaseWebConfig = resolvedFirebaseConfig;
