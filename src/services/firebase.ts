import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInAnonymously,
  signInWithCredential,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import {
  getDatabase,
  ref as rtdbRef,
  set as rtdbSet,
  get as rtdbGet,
  onValue as rtdbOnValue,
  Database,
} from 'firebase/database';
import localFirebaseConfig from '../../firebase-applet-config.json';

// Universal Environment Resolution:
// Supports:
// 1. Vite build variables (import.meta.env.VITE_FIREBASE_*)
// 2. Non-prefixed variables (process.env.FIREBASE_*) configured in Netlify / Vite define
// 3. AI Studio fallback (firebase-applet-config.json)
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as any);
const proc = typeof process !== 'undefined' && process.env ? process.env : ({} as any);
const fileConfig = (localFirebaseConfig || {}) as any;

const envApiKey = env.VITE_FIREBASE_API_KEY || proc.FIREBASE_API_KEY || env.FIREBASE_API_KEY || '';
const envProjectId = env.VITE_FIREBASE_PROJECT_ID || proc.FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || '';
const envAuthDomain = env.VITE_FIREBASE_AUTH_DOMAIN || proc.FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || '';
const envStorageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || proc.FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || '';
const envMessagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || proc.FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || '';
const envAppId = env.VITE_FIREBASE_APP_ID || proc.FIREBASE_APP_ID || env.FIREBASE_APP_ID || '';
const envDatabaseId = env.VITE_FIREBASE_DATABASE_ID || proc.FIREBASE_DATABASE_ID || env.FIREBASE_DATABASE_ID || '';
const rawDbUrl = env.VITE_FIREBASE_DATABASE_URL || proc.FIREBASE_DATABASE_URL || env.FIREBASE_DATABASE_URL || fileConfig.databaseURL || '';

// Helper to strictly validate Firebase Realtime Database URLs
export function isValidDatabaseURL(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('https://') && (url.includes('.firebaseio.com') || url.includes('.firebasedatabase.app'));
}

const validDatabaseUrl = isValidDatabaseURL(rawDbUrl) ? rawDbUrl : undefined;

// Detect if custom project is configured (e.g. from Netlify site settings)
export const isCustomProject = Boolean(envProjectId && envProjectId !== fileConfig.projectId);

export const resolvedFirebaseConfig: Record<string, any> = {
  apiKey: envApiKey || fileConfig.apiKey || '',
  authDomain: envAuthDomain || (isCustomProject ? `${envProjectId}.firebaseapp.com` : fileConfig.authDomain || ''),
  projectId: envProjectId || fileConfig.projectId || '',
  storageBucket: envStorageBucket || (isCustomProject ? `${envProjectId}.firebasestorage.app` : fileConfig.storageBucket || ''),
  messagingSenderId: envMessagingSenderId || fileConfig.messagingSenderId || '',
  appId: envAppId || fileConfig.appId || '',
  oAuthClientId: env.VITE_FIREBASE_OAUTH_CLIENT_ID || proc.FIREBASE_OAUTH_CLIENT_ID || fileConfig.oAuthClientId || '',
  // CRITICAL FIX FOR NETLIFY:
  // In user-created standard Firebase projects, Firestore database is always '(default)'.
  // Only use AI Studio's named database if still pointing to AI Studio's projectId.
  firestoreDatabaseId: envDatabaseId || (isCustomProject ? '(default)' : fileConfig.firestoreDatabaseId || '(default)'),
  ...(validDatabaseUrl ? { databaseURL: validDatabaseUrl } : {}),
};

export const configSourceInfo = {
  isCustomProject,
  projectId: resolvedFirebaseConfig.projectId,
  hasApiKey: Boolean(resolvedFirebaseConfig.apiKey),
  isFromEnv: Boolean(envApiKey || envProjectId),
  firestoreDatabaseId: resolvedFirebaseConfig.firestoreDatabaseId,
  databaseURL: validDatabaseUrl || 'Not specified',
};

// Check if credentials exist
export function isFirebaseConfigured(): boolean {
  return Boolean(resolvedFirebaseConfig.apiKey && resolvedFirebaseConfig.projectId);
}

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(resolvedFirebaseConfig) : getApp();

// Cloud Firestore initialization
export const db: Firestore =
  resolvedFirebaseConfig.firestoreDatabaseId && resolvedFirebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Realtime Database initialization: only initialize when a valid URL is provided to prevent fatal parser errors
export let rtdb: Database | null = null;
if (validDatabaseUrl) {
  try {
    rtdb = getDatabase(app, validDatabaseUrl);
  } catch (e) {
    console.warn('[Firebase] Realtime Database init deferred:', e);
    rtdb = null;
  }
}

export const auth = getAuth(app);

// Error handling types required by Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    return false;
  }
}

// Full diagnostic check for user visibility on Netlify & local dev
export interface FirebaseDiagnosticReport {
  projectId: string;
  configSource: 'Netlify Environment Variables' | 'AI Studio Blueprint Config';
  hasApiKey: boolean;
  databaseId: string;
  databaseURL: string;
  authStatus: 'signed_in' | 'anonymous' | 'unauthenticated';
  authUid?: string;
  firestoreStatus: 'connected' | 'permission_denied' | 'not_found' | 'error';
  firestoreDetails?: string;
  rtdbStatus: 'connected' | 'permission_denied' | 'not_configured' | 'error';
  rtdbDetails?: string;
}

export async function checkFirebaseDiagnostics(): Promise<FirebaseDiagnosticReport> {
  const user = auth.currentUser;
  const report: FirebaseDiagnosticReport = {
    projectId: resolvedFirebaseConfig.projectId || 'Not Configured',
    configSource: configSourceInfo.isFromEnv ? 'Netlify Environment Variables' : 'AI Studio Blueprint Config',
    hasApiKey: Boolean(resolvedFirebaseConfig.apiKey),
    databaseId: resolvedFirebaseConfig.firestoreDatabaseId || '(default)',
    databaseURL: resolvedFirebaseConfig.databaseURL || 'Not specified',
    authStatus: user ? (user.isAnonymous ? 'anonymous' : 'signed_in') : 'unauthenticated',
    authUid: user?.uid,
    firestoreStatus: 'error',
    rtdbStatus: 'not_configured',
  };

  // 1. Test Firestore
  try {
    const testDoc = doc(db, 'users', user?.uid || 'diagnostic_check');
    await getDoc(testDoc);
    report.firestoreStatus = 'connected';
    report.firestoreDetails = 'Cloud Firestore is reachable and rules permit reads.';
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED')) {
      report.firestoreStatus = 'permission_denied';
      report.firestoreDetails = 'Firestore permission-denied. Check firestore.rules.';
    } else if (msg.includes('not found') || msg.includes('NOT_FOUND') || msg.includes('database does not exist')) {
      report.firestoreStatus = 'not_found';
      report.firestoreDetails = `Database ${resolvedFirebaseConfig.firestoreDatabaseId} not found in project ${resolvedFirebaseConfig.projectId}.`;
    } else {
      report.firestoreStatus = 'error';
      report.firestoreDetails = msg;
    }
  }

  // 2. Test Realtime Database
  if (rtdb) {
    try {
      const snap = await rtdbGet(rtdbRef(rtdb, 'diagnostic/ping'));
      report.rtdbStatus = 'connected';
      report.rtdbDetails = 'Realtime Database connected & responsive.';
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('permission_denied') || msg.includes('Permission denied')) {
        report.rtdbStatus = 'permission_denied';
        report.rtdbDetails = 'Realtime Database permission denied. Rules need test mode.';
      } else {
        report.rtdbStatus = 'error';
        report.rtdbDetails = msg;
      }
    }
  }

  return report;
}

// Google Auth Provider with recommended OAuth scopes
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
googleProvider.addScope('email');
googleProvider.addScope('profile');

export interface GoogleSignInResult {
  user: FirebaseUser | null;
  error?: string;
  code?: string;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return { user: cred.user };
  } catch (error: any) {
    const code = error?.code || '';
    let message = error?.message || 'Google sign-in failed.';

    // Non-fatal user actions (closing window, cancel) should not be logged as console.error
    if (code === 'auth/popup-closed-by-user') {
      message = 'Sign-in window was closed. You can retry or continue as Guest.';
      console.info('[Firebase Auth] User closed the sign-in popup.');
    } else if (code === 'auth/cancelled-popup-request') {
      message = 'A sign-in request is already open. Please complete or close it first.';
      console.info('[Firebase Auth] Sign-in popup request deduplicated.');
    } else {
      console.warn('[Firebase Auth] Google sign-in notice:', code, message);
    }

    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      message = `Domain "${host}" is not in Firebase Authorized Domains. Add "${host}" in Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
    } else if (code === 'auth/popup-blocked') {
      message = 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    } else if (code === 'auth/operation-not-allowed') {
      message = 'Google Sign-In is not enabled. Turn on Google provider in Firebase Console -> Authentication -> Sign-in method.';
    }

    return { user: null, error: message, code };
  }
}

export async function signInAsGuest(): Promise<FirebaseUser | null> {
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (error) {
    console.warn('Guest login fallback notice:', error);
    return null;
  }
}

export async function logOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// Cloud Career Save & Load
export interface CloudCareerData {
  uid: string;
  displayName: string;
  driverName?: string;
  email?: string;
  cashBalance: number;
  selectedTeamId?: string;
  selectedDriverId?: string;
  difficulty?: 'rookie' | 'pro' | 'legend';
  racesEntered?: number;
  wins?: number;
  podiums?: number;
  championshipPoints?: number;
  customTeamName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export function getPersistentClientUid(): string {
  if (typeof window === 'undefined') return 'driver_guest';
  let uid = localStorage.getItem('apex26_driver_uid');
  if (!uid) {
    uid = 'driver_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('apex26_driver_uid', uid);
  }
  return uid;
}

export interface CloudSaveResult {
  success: boolean;
  savedToFirestore: boolean;
  savedToRtdb: boolean;
  savedToLocal: boolean;
  savedToServer: boolean;
  error?: string;
}

export async function saveCareerToCloud(data: Partial<CloudCareerData>): Promise<CloudSaveResult> {
  let user = auth.currentUser;
  let uid = user?.uid;

  if (!user) {
    try {
      const cred = await signInAnonymously(auth);
      user = cred.user;
      uid = user.uid;
    } catch {
      uid = getPersistentClientUid();
    }
  }

  const effectiveUid = uid || getPersistentClientUid();
  const payload = {
    ...data,
    uid: effectiveUid,
    displayName: data.displayName || user?.displayName || 'Formula Driver',
    driverName: data.driverName || 'Driver',
    email: user?.email || '',
    cashBalance: data.cashBalance ?? 15000000,
    selectedTeamId: data.selectedTeamId || 'redbull',
    selectedDriverId: data.selectedDriverId || 'max_verstappen',
    difficulty: data.difficulty || 'pro',
    racesEntered: data.racesEntered || 0,
    wins: data.wins || 0,
    podiums: data.podiums || 0,
    championshipPoints: data.championshipPoints || 0,
    customTeamName: data.customTeamName || '',
    updatedAt: new Date().toISOString(),
  };

  const result: CloudSaveResult = {
    success: false,
    savedToFirestore: false,
    savedToRtdb: false,
    savedToLocal: false,
    savedToServer: false,
  };

  // 1. Always save to local backup
  try {
    localStorage.setItem('apex26_cloud_career_backup', JSON.stringify(payload));
    result.savedToLocal = true;
  } catch {}

  // 2. Try Server backend (if running in dev/preview)
  try {
    const res = await fetch('/api/cloud/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        result.savedToServer = true;
      }
    }
  } catch {}

  let firestoreErr: string | undefined;
  let rtdbErr: string | undefined;

  // 3. Save to Cloud Firestore
  try {
    const userDocRef = doc(db, 'users', effectiveUid);
    await setDoc(userDocRef, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    result.savedToFirestore = true;
    result.success = true;
  } catch (err: any) {
    firestoreErr = err?.message || String(err);
    console.warn('[Firebase] Firestore write failed:', firestoreErr);
  }

  // 4. Save to Realtime Database (for users who enabled Realtime Database in test mode)
  if (rtdb) {
    try {
      await rtdbSet(rtdbRef(rtdb, `users/${effectiveUid}`), payload);
      result.savedToRtdb = true;
      result.success = true;
    } catch (err: any) {
      rtdbErr = err?.message || String(err);
      console.warn('[Firebase] Realtime Database write failed:', rtdbErr);
    }
  }

  // If neither Firebase target succeeded, provide a descriptive error message
  if (!result.savedToFirestore && !result.savedToRtdb) {
    result.error = firestoreErr || rtdbErr || 'Could not reach Firebase database.';
  }

  return result;
}

export async function loadCareerFromCloud(): Promise<CloudCareerData | null> {
  const user = auth.currentUser;
  const effectiveUid = user?.uid || getPersistentClientUid();

  // 1. Try Cloud Firestore first
  try {
    const snap = await getDoc(doc(db, 'users', effectiveUid));
    if (snap.exists()) {
      return snap.data() as CloudCareerData;
    }
  } catch (err) {
    console.warn('[Firebase] Firestore load fallback:', err);
  }

  // 2. Try Realtime Database next
  if (rtdb) {
    try {
      const snap = await rtdbGet(rtdbRef(rtdb, `users/${effectiveUid}`));
      if (snap.exists()) {
        return snap.val() as CloudCareerData;
      }
    } catch (err) {
      console.warn('[Firebase] RTDB load fallback:', err);
    }
  }

  // 3. Try Server Cloud endpoint (dev/preview server)
  try {
    const res = await fetch(`/api/cloud/load/${effectiveUid}`);
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success && json.career) {
        return json.career as CloudCareerData;
      }
    }
  } catch {}

  // 4. Try localStorage backup
  try {
    const cached = localStorage.getItem('apex26_cloud_career_backup');
    if (cached) {
      return JSON.parse(cached) as CloudCareerData;
    }
  } catch {}

  return null;
}

// Global Hot Lap Leaderboards
export interface CloudLapRecord {
  id?: string;
  circuitId: string;
  userId: string;
  driverName: string;
  teamId?: string;
  lapTimeSeconds: number;
  lapTimeFormatted: string;
  carNumber?: number;
  createdAt?: any;
}

export async function recordCircuitLapTime(record: Omit<CloudLapRecord, 'userId' | 'createdAt'>): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const recordId = `${user.uid}_${Date.now()}`;
  try {
    await setDoc(doc(db, 'leaderboards', record.circuitId, 'records', recordId), {
      ...record,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Also save to RTDB if available
    if (rtdb) {
      try {
        await rtdbSet(rtdbRef(rtdb, `leaderboards/${record.circuitId}/${recordId}`), {
          ...record,
          userId: user.uid,
          createdAt: Date.now(),
        });
      } catch {}
    }
  }
}

export async function getCircuitLeaderboard(circuitId: string, limitCount = 10): Promise<CloudLapRecord[]> {
  try {
    const colRef = collection(db, 'leaderboards', circuitId, 'records');
    const q = query(colRef, orderBy('lapTimeSeconds', 'asc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CloudLapRecord) }));
  } catch (err) {
    // Try RTDB fallback
    if (rtdb) {
      try {
        const snap = await rtdbGet(rtdbRef(rtdb, `leaderboards/${circuitId}`));
        if (snap.exists()) {
          const val = snap.val();
          return Object.values(val) as CloudLapRecord[];
        }
      } catch {}
    }
    return [];
  }
}

// Run test connection silently on module load
if (typeof window !== 'undefined') {
  testConnection();
}
