import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as signOutFirebase,
  type User,
} from "firebase/auth";

import { firebaseWebConfig, supabaseAnonKey, supabaseUrl } from "./env";
import { getSupabaseBrowserClient } from "./supabase-browser";

export type PanelSessionSnapshot = {
  user: {
    email?: string | null;
    id: string;
  } | null;
};

type BridgeCredentials = {
  email: string;
  password: string;
};

function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

function getFirebaseAuthInstance() {
  if (!firebaseWebConfig) {
    throw new Error("O login do painel ainda não foi configurado neste deploy.");
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseWebConfig);
  return getAuth(app);
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return fallbackMessage;
}

function getFirebaseErrorCode(error: unknown) {
  return typeof error === "object" && error != null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

function formatFirebaseError(error: unknown) {
  const code = getFirebaseErrorCode(error);

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "E-mail ou senha inválidos.";
    case "auth/too-many-requests":
      return "Muitas tentativas seguidas. Aguarde um pouco e tente novamente.";
    case "auth/unauthorized-domain":
      return "O domínio do painel ainda não foi autorizado no Firebase.";
    case "auth/popup-blocked":
      return "O navegador bloqueou o pop-up do Google. Libere o pop-up e tente novamente.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "O login com Google foi cancelado.";
    default:
      return getErrorMessage(error, "Não foi possível autenticar sua conta agora.");
  }
}

function formatBridgeError(errorCode: string | null, detail?: string | null) {
  switch (errorCode) {
    case "missing_server_secrets":
      return "A bridge de autenticação do painel não foi configurada.";
    case "origin_not_allowed":
      return "Esta origem ainda não foi autorizada na bridge do painel.";
    case "invalid_firebase_session":
    case "firebase_lookup_failed":
      return "O Firebase autenticou a conta, mas o painel não conseguiu sincronizar a sessão.";
    case "email_not_verified":
      return "Confirme o e-mail antes de entrar no painel.";
    default:
      return detail?.trim() || "Não foi possível sincronizar o login com o Supabase.";
  }
}

async function requestSupabaseBridgeCredentials(
  firebaseUser: User,
  forceRefresh: boolean,
) {
  const firebaseIdToken = await firebaseUser.getIdToken(forceRefresh);
  const response = await fetch(`${supabaseUrl}/functions/v1/firebase-auth-bridge`, {
    body: JSON.stringify({
      firebase_api_key: firebaseWebConfig?.apiKey,
      firebase_id_token: firebaseIdToken,
    }),
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      formatBridgeError(
        typeof payload["error"] === "string" ? payload["error"].toLowerCase() : null,
        typeof payload["detail"] === "string" ? payload["detail"] : null,
      ),
    );
  }

  const email =
    typeof payload["email"] === "string"
      ? payload["email"].trim()
      : firebaseUser.email?.trim() ?? "";
  const password =
    typeof payload["supabase_password"] === "string"
      ? payload["supabase_password"].trim()
      : "";

  if (!email || !password) {
    throw new Error("A bridge respondeu sem credenciais válidas do Supabase.");
  }

  return {
    email,
    password,
  } satisfies BridgeCredentials;
}

async function ensureVerifiedFirebaseUser(firebaseUser: User) {
  if (firebaseUser.emailVerified) {
    return firebaseUser;
  }

  await firebaseUser.reload();
  const auth = getFirebaseAuthInstance();
  const nextUser = auth.currentUser ?? firebaseUser;

  if (!nextUser.emailVerified) {
    throw new Error("Confirme o e-mail antes de entrar no painel.");
  }

  return nextUser;
}

async function signInToSupabaseWithFirebaseIdentity(firebaseUser: User) {
  const bridgeCredentials = await requestSupabaseBridgeCredentials(firebaseUser, false).catch(
    async (error) => {
      if (
        error instanceof Error &&
        error.message === "Confirme o e-mail antes de entrar no painel." &&
        firebaseUser.emailVerified
      ) {
        return await requestSupabaseBridgeCredentials(firebaseUser, true);
      }

      throw error;
    },
  );
  const supabase = getSupabaseBrowserClient();
  const currentSession = await supabase.auth.getSession().catch(() => ({
    data: { session: null },
  }));
  const currentUserEmail = currentSession.data.session?.user.email?.trim().toLowerCase();

  if (currentSession.data.session?.user && currentUserEmail !== normalizeEmailAddress(bridgeCredentials.email)) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmailAddress(bridgeCredentials.email),
    password: bridgeCredentials.password,
  });

  if (error || !data.user || !data.session) {
    throw new Error(
      error?.message?.trim() || "O Supabase não retornou uma sessão válida para o painel.",
    );
  }

  return {
    user: {
      email: data.user.email ?? null,
      id: data.user.id,
    },
  } satisfies PanelSessionSnapshot;
}

export async function getCurrentPanelSession() {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session;
}

export async function signInWithPanelEmailPassword(input: {
  email: string;
  password: string;
}) {
  try {
    const auth = getFirebaseAuthInstance();
    const credentials = await signInWithEmailAndPassword(
      auth,
      normalizeEmailAddress(input.email),
      input.password,
    );
    const verifiedUser = await ensureVerifiedFirebaseUser(credentials.user);
    return await signInToSupabaseWithFirebaseIdentity(verifiedUser);
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function signInWithPanelGoogle() {
  try {
    const auth = getFirebaseAuthInstance();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      const credentials = await signInWithPopup(auth, provider);
      if (!credentials.user) {
        return null;
      }

      return await signInToSupabaseWithFirebaseIdentity(credentials.user);
    } catch (error) {
      const code = getFirebaseErrorCode(error);
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, provider);
        return null;
      }

      throw error;
    }
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function finishPanelGoogleRedirect() {
  if (!firebaseWebConfig) {
    return null;
  }

  try {
    const auth = getFirebaseAuthInstance();
    const credentials = await getRedirectResult(auth);

    if (!credentials?.user) {
      return null;
    }

    return await signInToSupabaseWithFirebaseIdentity(credentials.user);
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function restorePanelSessionFromFirebase() {
  if (!firebaseWebConfig) {
    return null;
  }

  const auth = getFirebaseAuthInstance();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  const verifiedUser = await ensureVerifiedFirebaseUser(currentUser);
  return await signInToSupabaseWithFirebaseIdentity(verifiedUser);
}

export async function sendPanelPasswordReset(email: string) {
  try {
    const auth = getFirebaseAuthInstance();
    await sendPasswordResetEmail(auth, normalizeEmailAddress(email));
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function signOutPanelSession() {
  await getSupabaseBrowserClient().auth.signOut({ scope: "local" }).catch(() => undefined);

  if (firebaseWebConfig) {
    await signOutFirebase(getFirebaseAuthInstance()).catch(() => undefined);
  }
}
