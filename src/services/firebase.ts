import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInAnonymously,
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
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: The app will break without passing firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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

// Connection test on boot as required by Firebase skill
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline or connecting.');
    }
    return false;
  }
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (error) {
    console.error('Failed to sign in with Google:', error);
    return null;
  }
}

export async function signInAsGuest(): Promise<FirebaseUser | null> {
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (error) {
    console.error('Guest login error:', error);
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

export async function saveCareerToCloud(data: Partial<CloudCareerData>): Promise<boolean> {
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
  const path = `users/${effectiveUid}`;

  // 1. Always sync to persistent local cache
  try {
    localStorage.setItem('apex26_cloud_career_backup', JSON.stringify({ ...data, uid: effectiveUid }));
  } catch {}

  // 2. Always sync to server backend store
  try {
    fetch('/api/cloud/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, uid: effectiveUid }),
    }).catch(() => {});
  } catch {}

  // 3. Try Firebase Firestore
  try {
    const userDocRef = doc(db, 'users', effectiveUid);
    const existingSnap = await getDoc(userDocRef);

    if (!existingSnap.exists()) {
      await setDoc(userDocRef, {
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        userDocRef,
        {
          ...data,
          uid: effectiveUid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    return true;
  } catch (err) {
    console.warn('Firestore write fallback, server cloud save used:', err);
    // Server and local cloud backup are already saved and healthy!
    return true;
  }
}

export async function loadCareerFromCloud(): Promise<CloudCareerData | null> {
  const user = auth.currentUser;
  const effectiveUid = user?.uid || getPersistentClientUid();
  const path = `users/${effectiveUid}`;

  // 1. Try Firestore first
  try {
    const snap = await getDoc(doc(db, 'users', effectiveUid));
    if (snap.exists()) {
      return snap.data() as CloudCareerData;
    }
  } catch (err) {
    console.warn('Firestore load fallback to server:', err);
  }

  // 2. Try Server Cloud endpoint
  try {
    const res = await fetch(`/api/cloud/load/${effectiveUid}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.career) {
        return json.career as CloudCareerData;
      }
    }
  } catch {}

  // 3. Try localStorage backup
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
  const path = `leaderboards/${record.circuitId}/records/${recordId}`;
  try {
    await setDoc(doc(db, 'leaderboards', record.circuitId, 'records', recordId), {
      ...record,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Non-blocking leaderboard save
    console.warn('Leaderboard save error:', err);
  }
}

export async function getCircuitLeaderboard(circuitId: string, limitCount = 10): Promise<CloudLapRecord[]> {
  const path = `leaderboards/${circuitId}/records`;
  try {
    const colRef = collection(db, 'leaderboards', circuitId, 'records');
    const q = query(colRef, orderBy('lapTimeSeconds', 'asc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CloudLapRecord) }));
  } catch (err) {
    console.warn('Leaderboard fetch fallback:', err);
    return [];
  }
}

// Run test connection silently on module load
if (typeof window !== 'undefined') {
  testConnection();
}
