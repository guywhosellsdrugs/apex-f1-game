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
  Timestamp,
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
import {
  MetroCitySaveSlot,
  loadMetroCitySlots,
  saveMetroCitySlots,
  getActiveMetroCitySlotId,
  setActiveMetroCitySlotId,
  normalizeMetroCitySave,
  mergeMetroCitySlotLists,
} from '../game/cityTrafficBuilder';

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
  seasonStateJson?: string;
  activeCareerSlotId?: string;
  activeMetroCitySlotId?: string;
  careerSlotsJson?: string;
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

export async function saveCareerToCloud(
  data: Partial<CloudCareerData> & { fullSeason?: any; careerSlots?: any[] }
): Promise<CloudSaveResult> {
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
  const serializedSeason = data.seasonStateJson || (data.fullSeason ? JSON.stringify(data.fullSeason) : undefined);

  let serializedSlots = data.careerSlotsJson;
  if (!serializedSlots && Array.isArray(data.careerSlots)) {
    try {
      serializedSlots = JSON.stringify(data.careerSlots);
    } catch {}
  }
  if (!serializedSlots && typeof window !== 'undefined') {
    try {
      const storedSlots = localStorage.getItem('apex26_career_slots_v1');
      if (storedSlots) serializedSlots = storedSlots;
    } catch {}
  }

  const activeSlotId =
    data.activeCareerSlotId ||
    (typeof window !== 'undefined' ? localStorage.getItem('apex26_active_career_slot_v1') || undefined : undefined);

  const payload: Record<string, any> = {
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

  if (serializedSeason) {
    payload.seasonStateJson = serializedSeason;
  }
  if (serializedSlots) {
    payload.careerSlotsJson = serializedSlots;
  }
  if (activeSlotId) {
    payload.activeCareerSlotId = activeSlotId;
  }
  delete payload.fullSeason;
  delete payload.careerSlots;

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

// Global Public Developer Notes Sync (Visible to everyone who plays the game)
export interface DeveloperNoteSection {
  id: string;
  tag: string;
  title: string;
  date: string;
  body: string;
}

export interface DeveloperNotesDocument {
  headline: string;
  versionBadge: string;
  leadAuthor: string;
  announcementBanner: string;
  mainNoteTag?: string;
  mainNoteTitle?: string;
  mainNoteBody?: string;
  sections: DeveloperNoteSection[];
  updatedAt: number;
}

const DEV_NOTES_DOC_ID = 'GLOBAL_DEVELOPER_NOTES_V1';
const DEV_NOTES_LOCAL_KEY = 'apex26_developer_notes_v1';

export async function loadGlobalDeveloperNotes(): Promise<DeveloperNotesDocument | null> {
  let latest: DeveloperNotesDocument | null = null;

  // 1. Check localStorage cache first
  try {
    const raw = localStorage.getItem(DEV_NOTES_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sections)) {
        latest = parsed;
      }
    }
  } catch {}

  // 2. Check Express Server endpoint (/api/developer-notes)
  try {
    const res = await fetch('/api/developer-notes');
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json?.success && json.notes && Array.isArray(json.notes.sections)) {
        if (!latest || (json.notes.updatedAt || 0) >= (latest.updatedAt || 0)) {
          latest = json.notes;
        }
      }
    }
  } catch {}

  // 3. Check Cloud Firestore (rooms/GLOBAL_DEVELOPER_NOTES_V1 has public read/write in firestore.rules)
  try {
    const snap = await getDoc(doc(db, 'rooms', DEV_NOTES_DOC_ID));
    if (snap.exists()) {
      const data = snap.data() as DeveloperNotesDocument;
      if (data && Array.isArray(data.sections)) {
        if (!latest || (data.updatedAt || 0) >= (latest.updatedAt || 0)) {
          latest = data;
        }
      }
    }
  } catch {}

  if (latest) {
    try {
      localStorage.setItem(DEV_NOTES_LOCAL_KEY, JSON.stringify(latest));
    } catch {}
  }

  return latest;
}

export function subscribeGlobalDeveloperNotes(
  onUpdate: (notes: DeveloperNotesDocument) => void
): () => void {
  try {
    const docRef = doc(db, 'rooms', DEV_NOTES_DOC_ID);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as DeveloperNotesDocument;
          if (data && Array.isArray(data.sections)) {
            try {
              localStorage.setItem(DEV_NOTES_LOCAL_KEY, JSON.stringify(data));
            } catch {}
            onUpdate(data);
          }
        }
      },
      () => {
        // Ignore snapshot errors on offline/custom setups
      }
    );
    return unsub;
  } catch {
    return () => {};
  }
}

export async function saveGlobalDeveloperNotes(
  notes: DeveloperNotesDocument,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  const payload: DeveloperNotesDocument = {
    ...notes,
    updatedAt: Date.now(),
  };

  // 1. Save to localStorage immediately
  try {
    localStorage.setItem(DEV_NOTES_LOCAL_KEY, JSON.stringify(payload));
  } catch {}

  // 2. Save to Express Server (/api/developer-notes/save)
  try {
    const res = await fetch('/api/developer-notes/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, notes: payload }),
    });
    if (res.status === 401) {
      return { success: false, error: 'Invalid Developer PIN.' };
    }
  } catch {}

  // 3. Save to Cloud Firestore so every player sees it live
  try {
    await setDoc(doc(db, 'rooms', DEV_NOTES_DOC_ID), payload, { merge: true });
  } catch {}

  // 4. Save to RTDB if configured
  if (rtdb) {
    try {
      await rtdbSet(rtdbRef(rtdb, `developerNotes/${DEV_NOTES_DOC_ID}`), payload);
    } catch {}
  }

  return { success: true };
}

// Global Bug Reports & Improvement Recommendations Sync (Anyone can submit; viewing & managing requires PIN 20127164354287)
export interface BugReportEntry {
  id: string;
  type?: 'bug' | 'improvement';
  title: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reporterName: string;
  status: 'open' | 'investigating' | 'fixed';
  developerNote?: string;
  createdAt: number;
  updatedAt: number;
}

const BUG_REPORTS_DOC_ID = 'GLOBAL_BUG_REPORTS_V1';
const BUG_REPORTS_LOCAL_KEY = 'apex26_bug_reports_v1';
const REQUIRED_DEV_PIN = '20127164354287';

function mergeBugReportLists(...lists: (BugReportEntry[] | undefined | null)[]): BugReportEntry[] {
  const byId = new Map<string, BugReportEntry>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || !item.id) continue;
      const normalizedItem: BugReportEntry = {
        ...item,
        type: item.type === 'improvement' ? 'improvement' : 'bug',
      };
      const existing = byId.get(item.id);
      if (!existing || (normalizedItem.updatedAt || 0) >= (existing.updatedAt || 0)) {
        byId.set(item.id, normalizedItem);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function submitGlobalBugReport(input: {
  type?: 'bug' | 'improvement';
  title: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reporterName: string;
}): Promise<{ success: boolean; error?: string }> {
  const entryType: 'bug' | 'improvement' = input.type === 'improvement' ? 'improvement' : 'bug';
  const title = String(input.title || '').trim().slice(0, 180);
  const description = String(input.description || '').trim().slice(0, 3000);
  if (!title || !description) {
    return {
      success: false,
      error:
        entryType === 'improvement'
          ? 'Please provide both an improvement title and a detailed explanation.'
          : 'Please provide both a bug title and a detailed description.',
    };
  }

  const now = Date.now();
  const newReport: BugReportEntry = {
    id: (entryType === 'improvement' ? 'imp_' : 'bug_') + now + '_' + Math.random().toString(36).substring(2, 7),
    type: entryType,
    title,
    description,
    category: String(input.category || (entryType === 'improvement' ? 'New Game Feature' : 'Gameplay & Physics')).trim().slice(0, 80),
    severity: input.severity || 'medium',
    reporterName: String(input.reporterName || 'Anonymous Driver').trim().slice(0, 80) || 'Anonymous Driver',
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };

  let existingLocal: BugReportEntry[] = [];
  try {
    const raw = localStorage.getItem(BUG_REPORTS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) existingLocal = parsed;
    }
  } catch {}

  let existingFirestore: BugReportEntry[] = [];
  try {
    const snap = await getDoc(doc(db, 'rooms', BUG_REPORTS_DOC_ID));
    if (snap.exists()) {
      const data = snap.data();
      if (data && Array.isArray(data.reports)) {
        existingFirestore = data.reports as BugReportEntry[];
      }
    }
  } catch {}

  const merged = mergeBugReportLists([newReport], existingFirestore, existingLocal).slice(0, 300);

  // 1. Save to localStorage
  try {
    localStorage.setItem(BUG_REPORTS_LOCAL_KEY, JSON.stringify(merged));
  } catch {}

  // 2. Submit to Express server (/api/bug-reports/submit)
  try {
    await fetch('/api/bug-reports/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: newReport }),
    });
  } catch {}

  // 3. Save to Cloud Firestore so the developer can view reports from any device
  try {
    await setDoc(
      doc(db, 'rooms', BUG_REPORTS_DOC_ID),
      { reports: merged, updatedAt: now },
      { merge: true }
    );
  } catch {}

  // 4. Save to RTDB if available
  if (rtdb) {
    try {
      await rtdbSet(rtdbRef(rtdb, `bugReports/${BUG_REPORTS_DOC_ID}`), {
        reports: merged,
        updatedAt: now,
      });
    } catch {}
  }

  return { success: true };
}

export async function loadGlobalBugReportsWithPin(pin: string): Promise<{
  success: boolean;
  reports: BugReportEntry[];
  error?: string;
}> {
  if (String(pin || '').trim() !== REQUIRED_DEV_PIN) {
    return {
      success: false,
      reports: [],
      error: 'Invalid Developer PIN. You must enter the valid PIN to view reported bugs.',
    };
  }

  let localReports: BugReportEntry[] = [];
  let serverReports: BugReportEntry[] = [];
  let firestoreReports: BugReportEntry[] = [];

  // 1. Check localStorage
  try {
    const raw = localStorage.getItem(BUG_REPORTS_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localReports = parsed;
    }
  } catch {}

  // 2. Check Express Server (/api/bug-reports/list) with PIN
  try {
    const res = await fetch('/api/bug-reports/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json?.success && Array.isArray(json.reports)) {
        serverReports = json.reports;
      }
    }
  } catch {}

  // 3. Check Cloud Firestore
  try {
    const snap = await getDoc(doc(db, 'rooms', BUG_REPORTS_DOC_ID));
    if (snap.exists()) {
      const data = snap.data();
      if (data && Array.isArray(data.reports)) {
        firestoreReports = data.reports as BugReportEntry[];
      }
    }
  } catch {}

  const merged = mergeBugReportLists(firestoreReports, serverReports, localReports);
  try {
    localStorage.setItem(BUG_REPORTS_LOCAL_KEY, JSON.stringify(merged));
  } catch {}

  return {
    success: true,
    reports: merged,
  };
}

export function subscribeGlobalBugReportsWithPin(
  pin: string,
  onUpdate: (reports: BugReportEntry[]) => void
): () => void {
  if (String(pin || '').trim() !== REQUIRED_DEV_PIN) {
    return () => {};
  }
  try {
    const docRef = doc(db, 'rooms', BUG_REPORTS_DOC_ID);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.reports)) {
            const sorted = mergeBugReportLists(data.reports as BugReportEntry[]);
            try {
              localStorage.setItem(BUG_REPORTS_LOCAL_KEY, JSON.stringify(sorted));
            } catch {}
            onUpdate(sorted);
          }
        }
      },
      () => {}
    );
    return unsub;
  } catch {
    return () => {};
  }
}

export async function saveGlobalBugReportsWithPin(
  reports: BugReportEntry[],
  pin: string
): Promise<{ success: boolean; error?: string }> {
  if (String(pin || '').trim() !== REQUIRED_DEV_PIN) {
    return { success: false, error: 'Invalid Developer PIN.' };
  }

  const now = Date.now();
  const cleaned = reports.slice(0, 300);

  // 1. Save to localStorage
  try {
    localStorage.setItem(BUG_REPORTS_LOCAL_KEY, JSON.stringify(cleaned));
  } catch {}

  // 2. Save to Express Server (/api/bug-reports/update)
  try {
    await fetch('/api/bug-reports/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, reports: cleaned }),
    });
  } catch {}

  // 3. Save to Cloud Firestore
  try {
    await setDoc(doc(db, 'rooms', BUG_REPORTS_DOC_ID), {
      reports: cleaned,
      updatedAt: now,
    });
  } catch {}

  // 4. Save to RTDB
  if (rtdb) {
    try {
      await rtdbSet(rtdbRef(rtdb, `bugReports/${BUG_REPORTS_DOC_ID}`), {
        reports: cleaned,
        updatedAt: now,
      });
    } catch {}
  }

  return { success: true };
}

// =========================================================================
// METRO CITY MULTI-SLOT CLOUD PERSISTENCE (/users/{uid}/metroCitySaves/{slotId})
// Stores native Firestore Maps & Lists (no JSON.stringify) with strict rules
// =========================================================================

function toMillis(ts: any, fallback: number): number {
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  return fallback;
}

function buildNativeMetroCitySlotPayload(slot: MetroCitySaveSlot, uid: string) {
  const s = normalizeMetroCitySave(slot.state);
  const ownedCarIds = (Array.isArray(s.ownedCarIds) ? s.ownedCarIds : ['honda_civic'])
    .map((id) => String(id).slice(0, 64))
    .slice(0, 64);
  if (ownedCarIds.length === 0) ownedCarIds.push('honda_civic');

  const completedMissionIds = (Array.isArray(s.completedMissionIds) ? s.completedMissionIds : [])
    .map((id) => String(id).slice(0, 64))
    .slice(0, 100);

  const ownedHouseIds = (Array.isArray(s.ownedHouseIds) ? s.ownedHouseIds : [])
    .map((id) => String(id).slice(0, 64))
    .slice(0, 64);

  const customPaintByCar: Record<string, string> = {};
  for (const [k, v] of Object.entries(s.customPaintByCar || {}).slice(0, 64)) {
    if (typeof k === 'string' && typeof v === 'string') {
      customPaintByCar[k.slice(0, 64)] = v.slice(0, 32);
    }
  }

  const unlockedTrimsByCar: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(s.unlockedTrimsByCar || {}).slice(0, 64)) {
    if (typeof k === 'string' && Array.isArray(v)) {
      unlockedTrimsByCar[k.slice(0, 64)] = v.map((t) => String(t).slice(0, 64)).slice(0, 16);
    }
  }

  const activeTrimByCar: Record<string, string> = {};
  for (const [k, v] of Object.entries(s.activeTrimByCar || {}).slice(0, 64)) {
    if (typeof k === 'string' && typeof v === 'string') {
      activeTrimByCar[k.slice(0, 64)] = v.slice(0, 64);
    }
  }

  const houseFurnishings: Record<string, string[]> = {};
  for (const [houseId, items] of Object.entries(s.houseFurnishings || {}).slice(0, 64)) {
    if (typeof houseId === 'string' && houseId && Array.isArray(items)) {
      const cleanedItems = items.map((t) => String(t).slice(0, 64)).filter(Boolean).slice(0, 24);
      if (cleanedItems.length > 0) {
        houseFurnishings[houseId.slice(0, 64)] = cleanedItems;
      }
    }
  }

  return {
    slotId: String(slot.slotId).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64) || 'mc_slot_1',
    ownerUid: uid,
    slotName: (String(slot.slotName || 'Metro City Save').trim() || 'Metro City Save').slice(0, 64),
    streetCash: Number.isFinite(s.streetCash) ? Math.max(-100000000, Math.min(1000000000, s.streetCash)) : 5000,
    ownedCarIds,
    selectedCarId: String(s.selectedCarId || 'honda_civic').slice(0, 64),
    customPaintByCar,
    unlockedTrimsByCar,
    activeTrimByCar,
    completedMissions: Math.max(0, Math.min(500, Math.round(s.completedMissions || completedMissionIds.length))),
    completedMissionIds,
    totalEarnedCash: Number.isFinite(s.totalEarnedCash) ? Math.max(0, Math.min(1000000000, s.totalEarnedCash)) : 5000,
    streetRepLevel: Math.max(1, Math.min(1000, Math.round(s.streetRepLevel || 1))),
    pendingMissionId: typeof s.pendingMissionId === 'string' && s.pendingMissionId ? s.pendingMissionId.slice(0, 64) : null,
    ownedHouseIds,
    activeHomeId: typeof s.activeHomeId === 'string' && s.activeHomeId ? s.activeHomeId.slice(0, 64) : null,
    houseFurnishings,
    unpaidCrashTicketsTab: Number.isFinite(s.unpaidCrashTicketsTab) ? Math.max(0, Math.min(100000000, s.unpaidCrashTicketsTab)) : 0,
    totalJobsCompleted: Math.max(0, Math.min(100000, Math.round(s.totalJobsCompleted || 0))),
    totalHeistsCompleted: Math.max(0, Math.min(100000, Math.round(s.totalHeistsCompleted || 0))),
    bankRobberyBustCount: Math.max(0, Math.min(100000, Math.round(s.bankRobberyBustCount || 0))),
  };
}

async function ensureUserDocForMetroCity(user: FirebaseUser, activeSlotId: string): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  const safeDisplayName = ((user.displayName || 'Metro City Driver').trim() || 'Metro City Driver').slice(0, 80);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: safeDisplayName,
      email: (user.email || '').slice(0, 150),
      cashBalance: 5000,
      activeMetroCitySlotId: activeSlotId.slice(0, 64),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const existing = snap.data() || {};
    await updateDoc(userRef, {
      uid: existing.uid || user.uid,
      displayName: (typeof existing.displayName === 'string' && existing.displayName.trim() ? existing.displayName : safeDisplayName).slice(0, 80),
      cashBalance: typeof existing.cashBalance === 'number' ? existing.cashBalance : 5000,
      activeMetroCitySlotId: activeSlotId.slice(0, 64),
      updatedAt: serverTimestamp(),
    });
  }
}

export interface MetroCityCloudSyncResult {
  success: boolean;
  syncedCount: number;
  uid?: string;
  error?: string;
}

export async function saveMetroCitySlotsToCloud(
  slotsOverride?: MetroCitySaveSlot[],
  activeSlotIdOverride?: string,
  allowGuestSignIn = false
): Promise<MetroCityCloudSyncResult> {
  let user = auth.currentUser;
  if (!user && allowGuestSignIn) {
    user = await signInAsGuest();
  }
  if (!user) {
    return {
      success: false,
      syncedCount: 0,
      error: 'Sign in with Google or Guest in Firebase Cloud to sync Metro City saves online.',
    };
  }

  const slots = slotsOverride && slotsOverride.length > 0 ? slotsOverride : loadMetroCitySlots();
  const activeSlotId = activeSlotIdOverride || getActiveMetroCitySlotId(slots);

  try {
    await ensureUserDocForMetroCity(user, activeSlotId);
  } catch (err) {
    return {
      success: false,
      syncedCount: 0,
      uid: user.uid,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let syncedCount = 0;
  for (const slot of slots) {
    const nativePayload = buildNativeMetroCitySlotPayload(slot, user.uid);
    const slotPath = `users/${user.uid}/metroCitySaves/${nativePayload.slotId}`;
    const slotRef = doc(db, 'users', user.uid, 'metroCitySaves', nativePayload.slotId);
    try {
      const existingSnap = await getDoc(slotRef);
      if (existingSnap.exists()) {
        await updateDoc(slotRef, {
          ...nativePayload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(slotRef, {
          ...nativePayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      syncedCount++;
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, slotPath);
      } catch (wrappedErr: any) {
        return {
          success: false,
          syncedCount,
          uid: user.uid,
          error: wrappedErr?.message || String(err),
        };
      }
    }
  }

  return { success: true, syncedCount, uid: user.uid };
}

export async function loadMetroCitySlotsFromCloud(): Promise<{
  slots: MetroCitySaveSlot[];
  activeSlotId?: string;
  uid?: string;
} | null> {
  const user = auth.currentUser;
  if (!user) return null;

  let cloudActiveSlotId: string | undefined;
  try {
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (typeof data?.activeMetroCitySlotId === 'string' && data.activeMetroCitySlotId) {
        cloudActiveSlotId = data.activeMetroCitySlotId;
      }
    }
  } catch {}

  try {
    const colRef = collection(db, 'users', user.uid, 'metroCitySaves');
    const q = query(colRef, where('ownerUid', '==', user.uid), limit(25));
    const snap = await getDocs(q);
    const now = Date.now();
    const loaded: MetroCitySaveSlot[] = snap.docs.map((d) => {
      const raw = d.data() || {};
      return {
        slotId: String(raw.slotId || d.id),
        slotName: typeof raw.slotName === 'string' && raw.slotName.trim() ? raw.slotName : 'Metro City Save',
        createdAt: toMillis(raw.createdAt, now),
        updatedAt: toMillis(raw.updatedAt, now),
        state: normalizeMetroCitySave(raw),
      };
    });
    return { slots: loaded, activeSlotId: cloudActiveSlotId, uid: user.uid };
  } catch (err) {
    console.warn('[Firebase] Metro City cloud slots load fallback:', err);
    return null;
  }
}

export async function syncAndMergeMetroCitySlotsWithCloud(
  pushMergedToCloud = true
): Promise<{ slots: MetroCitySaveSlot[]; activeSlotId: string; syncedCloud: boolean }> {
  const localSlots = loadMetroCitySlots();
  const localActiveId = getActiveMetroCitySlotId(localSlots);
  const cloudRes = await loadMetroCitySlotsFromCloud();
  if (!cloudRes) {
    return { slots: localSlots, activeSlotId: localActiveId, syncedCloud: false };
  }
  const merged = mergeMetroCitySlotLists(cloudRes.slots, localSlots);
  const chosenActiveId =
    (cloudRes.activeSlotId && merged.some((s) => s.slotId === cloudRes.activeSlotId)
      ? cloudRes.activeSlotId
      : undefined) ||
    (merged.some((s) => s.slotId === localActiveId) ? localActiveId : merged[0]?.slotId || 'mc_slot_1');

  setActiveMetroCitySlotId(chosenActiveId);
  saveMetroCitySlots(merged, true);

  let syncedCloud = cloudRes.slots.length > 0;
  if (pushMergedToCloud && merged.length > 0) {
    const pushRes = await saveMetroCitySlotsToCloud(merged, chosenActiveId, false);
    syncedCloud = pushRes.success;
  }
  return { slots: merged, activeSlotId: chosenActiveId, syncedCloud };
}

export async function deleteMetroCitySlotFromCloud(slotId: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const cleanId = String(slotId || '').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
  if (!cleanId) return false;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'metroCitySaves', cleanId));
    return true;
  } catch (err) {
    console.warn('[Firebase] Metro City cloud slot delete notice:', err);
    return false;
  }
}

// Run test connection silently on module load
if (typeof window !== 'undefined') {
  testConnection();
}
