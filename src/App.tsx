import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Globe,
  Heart,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Search,
  Shield,
  ShoppingBag,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { AgentKorwilAdminDashboard } from './components/AgentKorwilAdminDashboard';
import {
  AuthModal,
  AuthModalMode,
  RegisterAgentInput,
  RegisterMemberInput,
} from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FloatingNotificationWidget } from './components/FloatingNotificationWidget';
import { LandingCatalog, MainCatalogCategory } from './components/LandingCatalog';
import { MemberDashboard } from './components/MemberDashboard';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  COMPANY_INFO,
  DEFAULT_AGENTS,
  DEFAULT_PACKAGES,
  LOGO_SAGITARIUS,
  formatRupiah,
  formatWhatsAppUrl,
  resolvePackagePhoto,
} from './data/catalogData';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import {
  AgentApplication,
  AgentDirectoryItem,
  AgentSettlement,
  AppPublicSettings,
  AuditLogEntry,
  ContactMessage,
  Deposit,
  DoorPrizeDraw,
  ParcelPackage,
  ProductSubstitution,
  PublicPage,
  RealtimeNotification,
  SimulationLock,
  Subscription,
  UserProfile,
  WarehouseInventoryItem,
  WILAYAH_LIST,
  WilayahPriangan,
} from './types';

type ActiveView = 'landing' | 'member' | 'operasional';

const DEFAULT_APP_SETTINGS: AppPublicSettings = {
  bank_nama: 'BRI / BCA Resmi Pusat',
  bank_rekening: '0100-01-002345-30-8',
  bank_atas_nama: 'PT. SAGITARIUS TRINUNGGAL KARYA',
  qris_catatan:
    'Cantumkan Nama Member & Wilayah pada berita transfer, atau titipkan tunai ke Agen Resmi terdekat.',
  pengumuman_judul: 'Info Layanan & Katalog 2026–2027',
  pengumuman_isi:
    'Setoran harian/mingguan berjalan selama 325 hari. Paket barang dibagikan selambatnya 15 Ramadhan & daging/telur pada H-2 Idul Fitri.',
  pengumuman_aktif: true,
};

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('landing');
  const [publicPage, setPublicPage] = useState<PublicPage>('beranda');
  const [catalogCategory, setCatalogCategory] =
    useState<MainCatalogCategory>('paket_lebaran');
  const [detailPackageId, setDetailPackageId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [focusSearchTrigger, setFocusSearchTrigger] = useState(0);

  // Wishlist / Paket Pilihan State (persisted in localStorage)
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem('sagitarius_wishlist');
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [showWishlistDrawer, setShowWishlistDrawer] = useState(false);

  // Auth & Profile State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const [dashboardTargetTab, setDashboardTargetTab] = useState<{
    tab: string;
    nonce: number;
  } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editNama, setEditNama] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editWa, setEditWa] = useState('');
  const [editWilayah, setEditWilayah] = useState<WilayahPriangan>('Tasikmalaya');
  const isRegisteringRef = useRef(false);

  // Public Catalog & Agents (live merged with Firestore)
  const [packages, setPackages] = useState<ParcelPackage[]>(DEFAULT_PACKAGES);
  const [agents, setAgents] = useState<AgentDirectoryItem[]>(DEFAULT_AGENTS);
  const [appSettings, setAppSettings] = useState<AppPublicSettings>(DEFAULT_APP_SETTINGS);
  const [doorPrizeDraws, setDoorPrizeDraws] = useState<DoorPrizeDraw[]>([]);
  const [productSubstitutions, setProductSubstitutions] = useState<ProductSubstitution[]>([]);

  // Live Firestore User Data
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [agentSettlements, setAgentSettlements] = useState<AgentSettlement[]>([]);
  const [warehouseInventory, setWarehouseInventory] = useState<WarehouseInventoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [agentApplications, setAgentApplications] = useState<AgentApplication[]>([]);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);

  // Simulation Lock & Agent Selection + URL Referral (?agen= / ?ref=)
  const [lockedSimulation, setLockedSimulation] = useState<SimulationLock | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(DEFAULT_AGENTS[0].id);
  const [referralCodeParam] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const rawRef = (params.get('agen') || params.get('ref') || '').trim();
    return /^[a-zA-Z0-9_-]{1,32}$/.test(rawRef) ? rawRef : '';
  });

  const referralAgent = useMemo(() => {
    if (!referralCodeParam) return null;
    const target = referralCodeParam.toLowerCase();
    return (
      agents.find((a) => a.aktif && a.kode_agen.toLowerCase() === target) ||
      agents.find((a) => a.kode_agen.toLowerCase() === target) ||
      null
    );
  }, [agents, referralCodeParam]);

  useEffect(() => {
    if (referralAgent) {
      setSelectedAgentId(referralAgent.id);
    }
  }, [referralAgent]);

  const canAccessOperational = Boolean(
    userProfile &&
      (userProfile.role === 'agen' ||
        userProfile.role === 'korwil' ||
        userProfile.role === 'admin')
  );
  const showDashboardNav = !userProfile || canAccessOperational;

  // Enforce strict role guard on operational view
  useEffect(() => {
    if (authReady && activeView === 'operasional' && userProfile && !canAccessOperational) {
      setActiveView('member');
      setAuthError('Akses Dashboard Operasional khusus untuk Agen, Korwil, dan Admin Pusat.');
    }
  }, [authReady, activeView, userProfile, canAccessOperational]);

  // Listen to public Firestore packages & agents (fallback gracefully to defaults)
  useEffect(() => {
    const unsubPkg = onSnapshot(
      collection(db, 'packages'),
      (snap) => {
        if (!snap.empty) {
          const fsPkgs = snap.docs.map((d) =>
            resolvePackagePhoto({
              id: d.id,
              ...(d.data() as Omit<ParcelPackage, 'id'>),
            })
          );
          if (fsPkgs.length >= 10) {
            setPackages(fsPkgs);
          } else {
            const mergedMap = new Map<string, ParcelPackage>();
            DEFAULT_PACKAGES.forEach((p) => mergedMap.set(p.id, p));
            fsPkgs.forEach((p) => mergedMap.set(p.id, p));
            setPackages(Array.from(mergedMap.values()));
          }
        }
      },
      () => {
        // Retain default catalog if offline or uninitialized
      }
    );

    const unsubAgents = onSnapshot(
      collection(db, 'agents'),
      (snap) => {
        if (!snap.empty) {
          const fsAgents = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AgentDirectoryItem, 'id'>),
          }));
          if (fsAgents.length >= 5) {
            setAgents(fsAgents);
          } else {
            const mergedMap = new Map<string, AgentDirectoryItem>();
            DEFAULT_AGENTS.forEach((a) => mergedMap.set(a.id, a));
            fsAgents.forEach((a) => mergedMap.set(a.id, a));
            setAgents(Array.from(mergedMap.values()));
          }
        }
      },
      () => {
        // Retain default directory if offline or uninitialized
      }
    );

    const unsubSubstitutions = onSnapshot(
      query(collection(db, 'product_substitutions'), orderBy('createdAt', 'desc')),
      (snap) => {
        setProductSubstitutions(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ProductSubstitution, 'id'>),
          }))
        );
      },
      () => {
        // Retain empty list if offline or uninitialized
      }
    );

    return () => {
      unsubPkg();
      unsubAgents();
      unsubSubstitutions();
    };
  }, []);

  // Auth Listener & Automatic User Profile Provisioning
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserProfile(null);
        setSubscriptions([]);
        setDeposits([]);
        setAllUsers([]);
        setContactMessages([]);
        setAgentSettlements([]);
        setWarehouseInventory([]);
        setAuditLogs([]);
        setAgentApplications([]);
        setNotifications([]);
        setDoorPrizeDraws([]);
        setAppSettings(DEFAULT_APP_SETTINGS);
        setAuthReady(true);
        return;
      }

      if (isRegisteringRef.current) {
        setAuthReady(true);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setUserProfile(data);
        } else {
          const isBootAdmin =
            user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;
          const newProfile: UserProfile = {
            uid: user.uid,
            nama: user.displayName || 'Member Sagitarius',
            no_wa: '081324383479',
            email: user.email || '',
            role: isBootAdmin ? 'admin' : 'member',
            wilayah: 'Tasikmalaya',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // Keep userProfile synced in real-time + subscribe to subscriptions & deposits safely
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile) return;

    const unsubProfile = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`)
    );

    const isBootAdmin =
      firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;
    const hasAdminAccess = isBootAdmin || userProfile.role === 'admin';

    const unsubSettings = onSnapshot(
      doc(db, 'app_settings', 'public'),
      (snap) => {
        if (snap.exists()) {
          setAppSettings({
            ...DEFAULT_APP_SETTINGS,
            ...(snap.data() as Partial<AppPublicSettings>),
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'app_settings/public')
    );

    const doorPrizeQuery = hasAdminAccess
      ? query(collection(db, 'door_prize_draws'), orderBy('createdAt', 'desc'))
      : userProfile.role === 'korwil'
        ? query(collection(db, 'door_prize_draws'), where('wilayah', '==', userProfile.wilayah))
        : query(collection(db, 'door_prize_draws'), where('member_id', '==', firebaseUser.uid));

    const unsubDoorPrize = onSnapshot(
      doorPrizeQuery,
      (snap) => {
        setDoorPrizeDraws(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<DoorPrizeDraw, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'door_prize_draws')
    );

    const subsQuery = hasAdminAccess
      ? query(collection(db, 'subscriptions'))
      : userProfile.role === 'agen'
        ? query(collection(db, 'subscriptions'), where('agen_id', '==', firebaseUser.uid))
        : userProfile.role === 'korwil'
          ? query(collection(db, 'subscriptions'), where('wilayah', '==', userProfile.wilayah))
          : query(collection(db, 'subscriptions'), where('member_id', '==', firebaseUser.uid));

    const unsubSubs = onSnapshot(
      subsQuery,
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Subscription, 'id'>),
        }));
        setSubscriptions(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions')
    );

    const depsQuery = hasAdminAccess
      ? query(collection(db, 'deposits'))
      : userProfile.role === 'agen'
        ? query(collection(db, 'deposits'), where('agen_id', '==', firebaseUser.uid))
        : userProfile.role === 'korwil'
          ? query(collection(db, 'deposits'), where('wilayah', '==', userProfile.wilayah))
          : query(collection(db, 'deposits'), where('member_id', '==', firebaseUser.uid));

    const unsubDeps = onSnapshot(
      depsQuery,
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deposit, 'id'>),
        }));
        setDeposits(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'deposits')
    );

    let unsubUsers: (() => void) | undefined;
    if (hasAdminAccess) {
      unsubUsers = onSnapshot(
        collection(db, 'users'),
        (snap) => {
          setAllUsers(snap.docs.map((d) => d.data() as UserProfile));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'users')
      );
    } else if (userProfile.role === 'korwil') {
      unsubUsers = onSnapshot(
        query(collection(db, 'users'), where('wilayah', '==', userProfile.wilayah)),
        (snap) => {
          setAllUsers(snap.docs.map((d) => d.data() as UserProfile));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'users')
      );
    } else if (userProfile.role === 'agen') {
      unsubUsers = onSnapshot(
        query(collection(db, 'users'), where('agen_id', '==', firebaseUser.uid)),
        (snap) => {
          setAllUsers(snap.docs.map((d) => d.data() as UserProfile));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'users')
      );
    } else {
      setAllUsers([]);
    }

    let unsubMessages: (() => void) | undefined;
    let unsubInventory: (() => void) | undefined;
    let unsubAuditLogs: (() => void) | undefined;
    if (hasAdminAccess) {
      unsubMessages = onSnapshot(
        query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc')),
        (snap) => {
          setContactMessages(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ContactMessage, 'id'>),
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'contact_messages')
      );
      unsubInventory = onSnapshot(
        collection(db, 'warehouse_inventory'),
        (snap) => {
          setWarehouseInventory(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<WarehouseInventoryItem, 'id'>),
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'warehouse_inventory')
      );
      unsubAuditLogs = onSnapshot(
        query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc')),
        (snap) => {
          setAuditLogs(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AuditLogEntry, 'id'>),
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
      );
    } else {
      setContactMessages([]);
      setWarehouseInventory([]);
      setAuditLogs([]);
    }

    let unsubSettlements: (() => void) | undefined;
    if (hasAdminAccess || userProfile.role === 'agen' || userProfile.role === 'korwil') {
      const settlementsQuery = hasAdminAccess
        ? query(collection(db, 'agent_settlements'))
        : userProfile.role === 'korwil'
          ? query(collection(db, 'agent_settlements'), where('wilayah', '==', userProfile.wilayah))
          : query(
              collection(db, 'agent_settlements'),
              where('agen_id', '==', firebaseUser.uid)
            );
      unsubSettlements = onSnapshot(
        settlementsQuery,
        (snap) => {
          setAgentSettlements(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AgentSettlement, 'id'>),
            }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'agent_settlements')
      );
    } else {
      setAgentSettlements([]);
    }

    const appsQuery = hasAdminAccess
      ? query(collection(db, 'agent_applications'))
      : userProfile.role === 'korwil'
        ? query(collection(db, 'agent_applications'), where('wilayah', '==', userProfile.wilayah))
        : query(
            collection(db, 'agent_applications'),
            where('applicant_uid', '==', firebaseUser.uid)
          );

    const unsubApps = onSnapshot(
      appsQuery,
      (snap) => {
        setAgentApplications(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AgentApplication, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'agent_applications')
    );

    // Real-time Notifications: merge personal/direct, broadcast, and role-scoped streams
    const notifMap = new Map<string, RealtimeNotification>();
    const syncNotificationsState = () => {
      const getMs = (ts: unknown): number => {
        if (!ts) return Date.now();
        if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
          return (ts as { toMillis: () => number }).toMillis();
        }
        if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
          return Number((ts as { seconds?: unknown }).seconds || 0) * 1000;
        }
        return 0;
      };
      const merged = Array.from(notifMap.values()).sort(
        (a, b) => getMs(b.createdAt) - getMs(a.createdAt)
      );
      setNotifications(merged.slice(0, 60));
    };

    const unsubNotifsDirect = onSnapshot(
      query(collection(db, 'notifications'), where('recipient_uid', '==', firebaseUser.uid)),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'removed') notifMap.delete(change.doc.id);
          else
            notifMap.set(change.doc.id, {
              id: change.doc.id,
              ...(change.doc.data() as Omit<RealtimeNotification, 'id'>),
            });
        });
        syncNotificationsState();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    const unsubNotifsBroadcast = onSnapshot(
      query(collection(db, 'notifications'), where('recipient_type', '==', 'broadcast')),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'removed') notifMap.delete(change.doc.id);
          else
            notifMap.set(change.doc.id, {
              id: change.doc.id,
              ...(change.doc.data() as Omit<RealtimeNotification, 'id'>),
            });
        });
        syncNotificationsState();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    let unsubNotifsRole: (() => void) | undefined;
    if (hasAdminAccess) {
      unsubNotifsRole = onSnapshot(
        query(collection(db, 'notifications'), where('recipient_type', '==', 'admin')),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'removed') notifMap.delete(change.doc.id);
            else
              notifMap.set(change.doc.id, {
                id: change.doc.id,
                ...(change.doc.data() as Omit<RealtimeNotification, 'id'>),
              });
          });
          syncNotificationsState();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      );
    } else if (userProfile.role === 'korwil') {
      unsubNotifsRole = onSnapshot(
        query(
          collection(db, 'notifications'),
          where('recipient_type', '==', 'korwil'),
          where('wilayah', '==', userProfile.wilayah)
        ),
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'removed') notifMap.delete(change.doc.id);
            else
              notifMap.set(change.doc.id, {
                id: change.doc.id,
                ...(change.doc.data() as Omit<RealtimeNotification, 'id'>),
              });
          });
          syncNotificationsState();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      );
    }

    return () => {
      unsubProfile();
      unsubSettings();
      unsubDoorPrize();
      unsubSubs();
      unsubDeps();
      unsubApps();
      unsubNotifsDirect();
      unsubNotifsBroadcast();
      if (unsubNotifsRole) unsubNotifsRole();
      if (unsubUsers) unsubUsers();
      if (unsubMessages) unsubMessages();
      if (unsubInventory) unsubInventory();
      if (unsubAuditLogs) unsubAuditLogs();
      if (unsubSettlements) unsubSettlements();
    };
  }, [authReady, firebaseUser, userProfile?.role, userProfile?.wilayah]);

  const normalizeWaDigits = (input: string): string => {
    const digits = input.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('62')) return digits;
    return `62${digits}`;
  };

  const mapFirebaseAuthError = (err: unknown): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';

    if (
      code === 'auth/operation-not-allowed' ||
      code === 'auth/admin-restricted-operation'
    ) {
      return 'Login Email/Password belum diaktifkan di Firebase Console (project: sagitarius-parcel). Sementara gunakan tombol "Masuk dengan Google" di bawah atau aktifkan provider Email/Password di Firebase Console.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'Kata sandi salah atau akun ini terdaftar via Google. Periksa sandi Anda atau gunakan tombol "Masuk dengan Google" di bawah.';
    }
    if (code === 'auth/user-not-found') {
      return 'Akun tidak ditemukan. Silakan pilih tab Daftar Member Baru.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Gmail atau Nomor WhatsApp ini sudah terdaftar. Silakan masuk di tab Masuk Akun.';
    }
    if (code === 'auth/weak-password') {
      return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Terlalu banyak percobaan login. Silakan tunggu beberapa saat lalu coba lagi.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Jendela login Google ditutup sebelum selesai.';
    }
    return err instanceof Error ? err.message : 'Gagal memproses autentikasi akun.';
  };

  const openAuthModal = (initialMode: AuthModalMode = 'login') => {
    setAuthError('');
    setAuthModalMode(initialMode);
    setShowAuthModal(true);
  };

  const handleLoginWithGoogle = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const handleLoginWithIdentifier = async (identifier: string, password: string) => {
    const trimmed = identifier.trim();
    let authEmail = '';

    if (trimmed.includes('@')) {
      authEmail = trimmed.toLowerCase();
    } else if (/^[+\d\s\-()]{8,20}$/.test(trimmed)) {
      const normWa = normalizeWaDigits(trimmed);
      if (normWa.length < 9) {
        throw new Error('Format nomor WhatsApp tidak valid.');
      }
      const aliasSnap = await getDoc(doc(db, 'login_aliases', `wa_${normWa}`));
      if (!aliasSnap.exists()) {
        throw new Error(
          'Nomor WhatsApp belum terdaftar di akun login. Silakan daftar baru terlebih dahulu atau masuk dengan Google.'
        );
      }
      authEmail = String(aliasSnap.data().auth_email || '');
    } else {
      const cleanUser = trimmed.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleanUser.length < 3) {
        throw new Error('Masukkan Username, Nomor WhatsApp, atau alamat Gmail yang valid.');
      }
      const aliasSnap = await getDoc(doc(db, 'login_aliases', `u_${cleanUser}`));
      if (!aliasSnap.exists()) {
        throw new Error(
          'Username belum terdaftar. Periksa kembali penulisan atau silakan daftar member baru.'
        );
      }
      authEmail = String(aliasSnap.data().auth_email || '');
    }

    if (!authEmail) {
      throw new Error('Data login tidak ditemukan. Silakan daftar ulang atau masuk dengan Google.');
    }

    try {
      await signInWithEmailAndPassword(auth, authEmail, password);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const handleRegisterMember = async (input: RegisterMemberInput) => {
    const normWa = normalizeWaDigits(input.no_wa);
    const cleanUsername = input.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (normWa.length < 9) {
      throw new Error('Nomor WhatsApp tidak valid.');
    }
    if (cleanUsername.length < 3) {
      throw new Error('Username minimal 3 karakter huruf/angka.');
    }

    const waAliasRef = doc(db, 'login_aliases', `wa_${normWa}`);
    const userAliasRef = doc(db, 'login_aliases', `u_${cleanUsername}`);

    const [waSnap, userSnap] = await Promise.all([getDoc(waAliasRef), getDoc(userAliasRef)]);
    if (waSnap.exists()) {
      throw new Error('Nomor WhatsApp sudah terdaftar. Silakan masuk di tab Masuk Akun.');
    }
    if (userSnap.exists()) {
      throw new Error('Username sudah dipakai member lain. Pilih username lain.');
    }

    const authEmail = input.email
      ? input.email.trim().toLowerCase()
      : `wa.${normWa}@member.sagitariusparcel.com`;

    isRegisteringRef.current = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, input.password);
      await updateProfile(cred.user, { displayName: input.nama });

      const newProfile: UserProfile = {
        uid: cred.user.uid,
        nama: input.nama,
        username: cleanUsername,
        no_wa: input.no_wa.trim(),
        email: input.email ? input.email.trim().toLowerCase() : '',
        role: 'member',
        wilayah: input.wilayah,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', cred.user.uid), newProfile);
      batch.set(waAliasRef, {
        uid: cred.user.uid,
        auth_email: authEmail,
        alias_type: 'wa',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(userAliasRef, {
        uid: cred.user.uid,
        auth_email: authEmail,
        alias_type: 'username',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setUserProfile(newProfile);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    } finally {
      isRegisteringRef.current = false;
    }
  };

  const handleRegisterAgent = async (input: RegisterAgentInput) => {
    const normWa = normalizeWaDigits(input.no_wa);
    const cleanUsername = input.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (normWa.length < 9) {
      throw new Error('Nomor WhatsApp tidak valid.');
    }
    if (cleanUsername.length < 3) {
      throw new Error('Username minimal 3 karakter huruf/angka.');
    }
    if (input.kecamatan.trim().length < 2) {
      throw new Error('Kecamatan / area pemasaran calon agen wajib diisi.');
    }

    const waAliasRef = doc(db, 'login_aliases', `wa_${normWa}`);
    const userAliasRef = doc(db, 'login_aliases', `u_${cleanUsername}`);

    const [waSnap, userSnap] = await Promise.all([getDoc(waAliasRef), getDoc(userAliasRef)]);
    if (waSnap.exists()) {
      throw new Error('Nomor WhatsApp sudah terdaftar. Silakan masuk di tab Masuk Akun.');
    }
    if (userSnap.exists()) {
      throw new Error('Username sudah dipakai pengguna lain. Pilih username lain.');
    }

    const authEmail = input.email
      ? input.email.trim().toLowerCase()
      : `wa.${normWa}@member.sagitariusparcel.com`;

    isRegisteringRef.current = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, input.password);
      await updateProfile(cred.user, { displayName: input.nama });

      const newProfile: UserProfile = {
        uid: cred.user.uid,
        nama: input.nama,
        username: cleanUsername,
        no_wa: input.no_wa.trim(),
        email: input.email ? input.email.trim().toLowerCase() : '',
        role: 'member',
        wilayah: input.wilayah,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', cred.user.uid), newProfile);
      batch.set(waAliasRef, {
        uid: cred.user.uid,
        auth_email: authEmail,
        alias_type: 'wa',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(userAliasRef, {
        uid: cred.user.uid,
        auth_email: authEmail,
        alias_type: 'username',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'agent_applications', cred.user.uid), {
        applicant_uid: cred.user.uid,
        nama: input.nama,
        username: cleanUsername,
        no_wa: input.no_wa.trim(),
        ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
        wilayah: input.wilayah,
        kecamatan: input.kecamatan.trim().slice(0, 80),
        ...(input.catatan ? { catatan: input.catatan.trim().slice(0, 300) } : {}),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(collection(db, 'notifications')), {
        recipient_type: 'admin',
        recipient_uid: 'staff_admin',
        wilayah: input.wilayah,
        kategori: 'pendaftaran_agen',
        judul: 'Pendaftaran Agen Baru Masuk',
        pesan: `${input.nama} (${input.no_wa.trim()}) mendaftar sebagai calon Agen wilayah ${input.wilayah} — ${input.kecamatan.trim()}.`,
        tautan_view: 'operasional',
        tautan_tab: 'users',
        sender_uid: cred.user.uid,
        sender_nama: input.nama,
        is_read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(collection(db, 'notifications')), {
        recipient_type: 'user',
        recipient_uid: cred.user.uid,
        wilayah: input.wilayah,
        kategori: 'pendaftaran_agen',
        judul: 'Pendaftaran Agen Baru Terkirim',
        pesan: `Pengajuan agen wilayah ${input.wilayah} (${input.kecamatan.trim()}) sedang ditinjau Admin Pusat. Anda akan menerima notifikasi realtime setelah disetujui.`,
        tautan_view: 'member',
        sender_uid: cred.user.uid,
        sender_nama: input.nama,
        is_read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      setUserProfile(newProfile);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    } finally {
      isRegisteringRef.current = false;
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const handleLogout = async () => {
    // Clear profile first so scoped onSnapshot listeners tear down cleanly before auth token revocation
    setUserProfile(null);
    setSubscriptions([]);
    setDeposits([]);
    setAllUsers([]);
    setContactMessages([]);
    setAgentSettlements([]);
    setWarehouseInventory([]);
    setAuditLogs([]);
    setAgentApplications([]);
    setNotifications([]);
    setDoorPrizeDraws([]);
    setAppSettings(DEFAULT_APP_SETTINGS);
    setLockedSimulation(null);
    setShowProfileModal(false);
    setAuthError('');
    setActiveView('landing');
    await signOut(auth);
  };

  const handleLockSimulation = (lock: SimulationLock) => {
    setLockedSimulation(lock);
    setActiveView('member');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openProfileEdit = () => {
    if (!userProfile) return;
    setEditNama(userProfile.nama);
    setEditUsername(userProfile.username || '');
    setEditWa(userProfile.no_wa);
    setEditWilayah(userProfile.wilayah);
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const cleanNama = editNama.trim().slice(0, 100);
    const cleanUser = editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40);
    const cleanWa = editWa.trim().slice(0, 20);
    if (cleanNama.length < 2 || cleanWa.length < 8) {
      setAuthError('Nama lengkap minimal 2 karakter dan nomor WhatsApp minimal 8 digit.');
      return;
    }

    const canChangeOwnWilayah =
      userProfile.role === 'member' || userProfile.role === 'admin';
    const updatePayload: Record<string, unknown> = {
      nama: cleanNama,
      username: cleanUser,
      no_wa: cleanWa,
      updatedAt: serverTimestamp(),
    };
    if (canChangeOwnWilayah) {
      updatePayload.wilayah = editWilayah;
    }

    try {
      await updateDoc(doc(db, 'users', userProfile.uid), updatePayload);
      setShowProfileModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
    }
  };

  const navigatePublicPage = (page: PublicPage, category?: MainCatalogCategory) => {
    setActiveView('landing');
    setPublicPage(page);
    if (category) {
      setCatalogCategory(category);
    }
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDetail = (pkg: ParcelPackage) => {
    setDetailPackageId(pkg.id);
    setActiveView('landing');
    setPublicPage('detail_paket');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleWishlist = (pkgId: string) => {
    setWishlistIds((prev) => {
      const next = prev.includes(pkgId)
        ? prev.filter((id) => id !== pkgId)
        : [...prev, pkgId];
      try {
        window.localStorage.setItem('sagitarius_wishlist', JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  const handleHeaderSearchClick = () => {
    setActiveView('landing');
    setPublicPage('katalog');
    setMobileMenuOpen(false);
    setFocusSearchTrigger((c) => c + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const wishlistPackages = packages.filter((p) => wishlistIds.includes(p.id));

  const navLinkClass = (isActive: boolean) =>
    `relative py-1 text-xs lg:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
      isActive
        ? 'font-semibold text-[#E8CA82] underline decoration-[#C8A053] decoration-2 underline-offset-8'
        : 'text-stone-200 hover:text-[#E8CA82]'
    }`;

  return (
    <ErrorBoundary>
      <div className="bg-arabesque-ivory min-h-screen flex flex-col overflow-x-hidden text-stone-900">
        {/* TOP BAR matching Royal Purple + Gold Border Mockups */}
        <header className="bg-arabesque-purple sticky top-0 z-40 border-b-2 border-[#C8A053]/60 text-white shadow-sm no-print">
          <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
            {/* Zone 1: Brand Crest */}
            <button
              type="button"
              onClick={() => navigatePublicPage('beranda')}
              className="flex items-center gap-2 text-left whitespace-nowrap shrink-0 cursor-pointer"
            >
              <img
                src={LOGO_SAGITARIUS}
                alt="Logo Sagitarius Parcel"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-[#C8A053]/70 bg-black object-cover"
              />
              <div>
                <p className="font-display text-sm sm:text-base font-bold tracking-tight text-[#E8CA82] leading-tight">
                  Sagitarius Parcel
                </p>
                <p className="hidden sm:block text-[10px] font-medium text-stone-300 leading-tight">
                  Our Eid, Our Happiness
                </p>
              </div>
            </button>

            {/* Zone 2: Clean Desktop & Laptop single-line navigation links */}
            <nav className="hidden lg:flex items-center gap-5">
              <button
                type="button"
                onClick={() => navigatePublicPage('beranda')}
                className={navLinkClass(activeView === 'landing' && publicPage === 'beranda')}
              >
                Beranda
              </button>
              <button
                type="button"
                onClick={() => navigatePublicPage('katalog', 'paket_lebaran')}
                className={navLinkClass(
                  activeView === 'landing' &&
                    (publicPage === 'katalog' || publicPage === 'detail_paket')
                )}
              >
                Paket Lebaran
              </button>
              <button
                type="button"
                onClick={() => navigatePublicPage('tentang')}
                className={navLinkClass(activeView === 'landing' && publicPage === 'tentang')}
              >
                Tentang Kami
              </button>
              <button
                type="button"
                onClick={() => navigatePublicPage('kontak')}
                className={navLinkClass(activeView === 'landing' && publicPage === 'kontak')}
              >
                Kontak
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveView('member');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={navLinkClass(activeView === 'member')}
              >
                Member
              </button>
              {showDashboardNav && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('operasional');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={navLinkClass(activeView === 'operasional')}
                >
                  Dashboard
                </button>
              )}
            </nav>

            {/* Zone 3: Search, Wishlist Bag, Account & Hubungi Kami */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={handleHeaderSearchClick}
                aria-label="Cari Paket Lebaran"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-stone-200 transition hover:bg-white/10 hover:text-[#E8CA82] cursor-pointer"
              >
                <Search className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowWishlistDrawer(true)}
                aria-label="Daftar Paket Pilihan"
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-stone-200 transition hover:bg-white/10 hover:text-[#E8CA82] cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C8A053] px-1 font-mono-nums text-[10px] font-bold text-[#1D122B]">
                  {wishlistIds.length}
                </span>
              </button>

              {userProfile ? (
                <button
                  type="button"
                  onClick={openProfileEdit}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D5B263] to-[#B98E3A] px-3.5 py-2 text-xs font-bold text-[#1D122B] transition hover:brightness-105 whitespace-nowrap cursor-pointer"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  <span>{userProfile.nama.split(' ')[0]}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D5B263] to-[#B98E3A] px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-[#1D122B] transition hover:brightness-105 whitespace-nowrap cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Masuk</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => navigatePublicPage('kontak')}
                className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-[#C8A053]/80 bg-white/10 px-3.5 py-2 text-xs font-semibold text-[#E8CA82] transition hover:bg-white/20 whitespace-nowrap cursor-pointer"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Hubungi Kami</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 text-white lg:hidden cursor-pointer"
                aria-label="Menu Navigasi"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Mobile & Tablet Drawer */}
          {mobileMenuOpen && (
            <div className="border-t border-[#C8A053]/30 bg-[#241142] px-4 py-4 text-white lg:hidden">
              <div className="grid grid-cols-2 gap-2 text-xs font-medium sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => navigatePublicPage('beranda')}
                  className="min-h-[44px] rounded-xl border border-white/10 px-3 py-2.5 text-left hover:bg-white/10"
                >
                  Beranda
                </button>
                <button
                  type="button"
                  onClick={() => navigatePublicPage('katalog', 'paket_lebaran')}
                  className="min-h-[44px] rounded-xl border border-white/10 px-3 py-2.5 text-left hover:bg-white/10"
                >
                  Paket Lebaran
                </button>
                <button
                  type="button"
                  onClick={() => navigatePublicPage('katalog', 'tabungan_uang')}
                  className="min-h-[44px] rounded-xl border border-white/10 px-3 py-2.5 text-left hover:bg-white/10"
                >
                  Tabungan Uang
                </button>
                <button
                  type="button"
                  onClick={() => navigatePublicPage('tentang')}
                  className="min-h-[44px] rounded-xl border border-white/10 px-3 py-2.5 text-left hover:bg-white/10"
                >
                  Tentang &amp; Agen
                </button>
                <button
                  type="button"
                  onClick={() => navigatePublicPage('kontak')}
                  className="min-h-[44px] rounded-xl border border-white/10 px-3 py-2.5 text-left hover:bg-white/10"
                >
                  Kontak Resmi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('member');
                    setMobileMenuOpen(false);
                  }}
                  className="min-h-[44px] rounded-xl border border-[#C8A053]/40 bg-[#0C3328] px-3 py-2.5 text-left font-bold text-[#E8CA82]"
                >
                  Member
                </button>
                {showDashboardNav && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('operasional');
                      setMobileMenuOpen(false);
                    }}
                    className="min-h-[44px] rounded-xl border border-[#C8A053]/40 bg-white/10 px-3 py-2.5 text-left font-bold text-white"
                  >
                    Dashboard
                  </button>
                )}
              </div>

              {!userProfile && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthModal('register_member');
                    }}
                    className="min-h-[44px] rounded-xl bg-[#0C3328] px-3 py-2 text-xs font-bold text-[#E8CA82]"
                  >
                    Gabung Member
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthModal('register_agent');
                    }}
                    className="min-h-[44px] rounded-xl bg-gradient-to-r from-[#D5B263] to-[#B98E3A] px-3 py-2 text-xs font-bold text-[#1D122B]"
                  >
                    Gabung Agen
                  </button>
                </div>
              )}

              {userProfile && (
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openProfileEdit();
                    }}
                    className="text-xs font-semibold text-[#E8CA82]"
                  >
                    Profil ({userProfile.nama} · {userProfile.role.toUpperCase()})
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-300"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Keluar
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Sub-toolbar for PWA Install & Official Contact Context */}
        <div className="border-b border-[#E4DCCB] bg-white/90 backdrop-blur-xs no-print">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
              <span className="font-semibold text-[#381E5A]">{COMPANY_INFO.legalName}</span>
              <span aria-hidden="true">·</span>
              <a
                href={formatWhatsAppUrl(
                  COMPANY_INFO.csWhatsappDigits,
                  'Halo CS Sagitarius Parcel, saya ingin bertanya tentang katalog paket Lebaran.'
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#15803D] hover:underline"
              >
                CS WA: {COMPANY_INFO.csWhatsappDisplay}
              </a>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#0C3328]">
                {userProfile
                  ? `Masuk sebagai ${userProfile.nama} (${userProfile.role.toUpperCase()})`
                  : 'Pengunjung Publik'}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <PWAInstallButton />
              {userProfile && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E4DCCB] px-3 py-1 text-xs font-medium text-stone-600 hover:bg-[#FAF7F2] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {authError && (
          <div className="mx-auto mt-4 max-w-4xl px-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
              {authError}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1">
          {activeView === 'landing' && (
            <LandingCatalog
              activePage={publicPage}
              onNavigate={navigatePublicPage}
              catalogCategory={catalogCategory}
              onSelectCatalogCategory={setCatalogCategory}
              packages={packages}
              agents={agents}
              onLockSimulation={handleLockSimulation}
              selectedAgentId={selectedAgentId}
              onSelectAgent={setSelectedAgentId}
              detailPackageId={detailPackageId}
              onOpenDetail={handleOpenDetail}
              wishlistIds={wishlistIds}
              onToggleWishlist={handleToggleWishlist}
              focusSearchTrigger={focusSearchTrigger}
              referralAgent={referralAgent}
              onOpenAuth={openAuthModal}
            />
          )}

          {activeView === 'member' && (
            <MemberDashboard
              userProfile={userProfile}
              packages={packages}
              agents={agents}
              subscriptions={subscriptions}
              deposits={deposits}
              appSettings={appSettings}
              doorPrizeDraws={doorPrizeDraws}
              productSubstitutions={productSubstitutions}
              agentApplications={agentApplications}
              referralAgent={referralAgent}
              lockedSimulation={lockedSimulation}
              onClearLockedSimulation={() => setLockedSimulation(null)}
              onNeedLogin={() => openAuthModal('login')}
              onOpenAgentRegister={() => openAuthModal('register_agent')}
            />
          )}

          {activeView === 'operasional' && (
            <AgentKorwilAdminDashboard
              userProfile={userProfile}
              allUsers={allUsers}
              packages={packages}
              agents={agents}
              subscriptions={subscriptions}
              deposits={deposits}
              contactMessages={contactMessages}
              appSettings={appSettings}
              doorPrizeDraws={doorPrizeDraws}
              agentSettlements={agentSettlements}
              warehouseInventory={warehouseInventory}
              productSubstitutions={productSubstitutions}
              auditLogs={auditLogs}
              agentApplications={agentApplications}
              externalTabRequest={dashboardTargetTab}
              onNeedLogin={() => openAuthModal('login')}
              onOpenAgentRegister={() => openAuthModal('register_agent')}
            />
          )}
        </main>

        {/* Official Dark Emerald Footer */}
        <footer className="bg-arabesque-emerald border-t-2 border-[#C8A053]/60 py-10 text-stone-200 no-print">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 text-xs sm:grid-cols-2 lg:grid-cols-5 sm:px-6 lg:px-8">
            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center gap-3">
                <img
                  src={LOGO_SAGITARIUS}
                  alt="Logo Sagitarius Parcel"
                  className="h-12 w-12 rounded-xl border border-[#C8A053]/60 bg-black object-cover"
                />
                <div>
                  <p className="font-display text-base font-bold text-[#E8CA82]">
                    {COMPANY_INFO.brandName}
                  </p>
                  <p className="text-[11px] text-stone-300">{COMPANY_INFO.legalName}</p>
                </div>
              </div>
              <p className="leading-relaxed text-stone-300">
                Sagitarius Parcel hadir membantu Anda berbagi kebahagiaan di hari yang fitri dengan bingkisan bermakna —{' '}
                <em>{COMPANY_INFO.tagline}</em>.
              </p>
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-stone-300">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E8CA82]" />
                <span>{COMPANY_INFO.address}</span>
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-[#E8CA82]">Katalog Pilihan</p>
              <div className="flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => navigatePublicPage('katalog', 'paket_lebaran')}
                  className="hover:text-[#E8CA82] cursor-pointer"
                >
                  Paket Lebaran
                </button>
                <button
                  type="button"
                  onClick={() => navigatePublicPage('katalog', 'tabungan_uang')}
                  className="hover:text-[#E8CA82] cursor-pointer"
                >
                  Tabungan Uang
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sultan = packages.find((p) => p.kategori === 'pilihan');
                    if (sultan) handleOpenDetail(sultan);
                    else navigatePublicPage('katalog', 'paket_lebaran');
                  }}
                  className="hover:text-[#E8CA82] cursor-pointer"
                >
                  Paket Pilihan &amp; THR
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-[#E8CA82]">Kemitraan &amp; Akun</p>
              <div className="flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => openAuthModal('register_member')}
                  className="hover:text-[#E8CA82] cursor-pointer"
                >
                  Gabung Member
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('register_agent')}
                  className="hover:text-[#E8CA82] cursor-pointer"
                >
                  Gabung Agen / Reseller
                </button>
                <button
                  type="button"
                  onClick={() => navigatePublicPage('tentang')}
                  className="hover:text-[#E8CA82] cursor-pointer"
                >
                  Tentang &amp; Direktori Agen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('member');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-[#E8CA82] cursor-pointer"
                >
                  Dashboard Member
                </button>
                {showDashboardNav && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('operasional');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#E8CA82] cursor-pointer"
                  >
                    Dashboard
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-[#E8CA82]">Bantuan &amp; Kontak</p>
              <div className="flex flex-col items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => navigatePublicPage('kontak')}
                  className="hover:text-[#E8CA82] cursor-pointer"
                >
                  Hubungi Admin / Kirim Pesan
                </button>
                <a
                  href={formatWhatsAppUrl(
                    COMPANY_INFO.csWhatsappDigits,
                    'Halo CS Sagitarius Parcel, saya ingin bertanya tentang paket Lebaran.'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#E8CA82] hover:underline"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>WA {COMPANY_INFO.csWhatsappDisplay}</span>
                </a>
                <span className="inline-flex items-center gap-1 text-[11px] text-stone-300">
                  <Globe className="h-3 w-3 text-[#C8A053]" />
                  {COMPANY_INFO.website}
                </span>
              </div>
            </div>
          </div>
        </footer>

        {/* Wishlist / Daftar Paket Pilihan Drawer */}
        {showWishlistDrawer && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex h-full w-full max-w-md flex-col border-l border-[#E4DCCB] bg-[#FAF7F2] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E4DCCB] bg-[#381E5A] px-5 py-4 text-white">
                <div className="flex items-center gap-2.5">
                  <Heart className="h-5 w-5 fill-[#E8CA82] text-[#E8CA82]" />
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#E8CA82]">
                      Daftar Paket Pilihan ({wishlistPackages.length})
                    </h3>
                    <p className="text-[11px] text-stone-300">
                      Simpan &amp; bandingkan paket favorit sebelum mendaftar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWishlistDrawer(false)}
                  className="rounded-lg p-1.5 text-stone-300 hover:bg-white/10 cursor-pointer"
                  aria-label="Tutup daftar paket pilihan"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {wishlistPackages.length === 0 ? (
                  <div className="rounded-2xl border border-[#E4DCCB] bg-white p-8 text-center">
                    <ShoppingBag className="mx-auto h-10 w-10 text-[#C8A053]" />
                    <p className="mt-3 text-sm font-bold text-[#381E5A]">
                      Belum ada paket yang disimpan
                    </p>
                    <p className="mt-1 text-xs text-stone-600">
                      Klik ikon hati pada kartu paket di Katalog untuk menyimpan pilihan Anda.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowWishlistDrawer(false);
                        navigatePublicPage('katalog');
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0C3328] px-4 py-2 text-xs font-bold text-[#E8CA82] cursor-pointer"
                    >
                      <span>Jelajahi Katalog</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  wishlistPackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="flex gap-3 rounded-2xl border border-[#E4DCCB] bg-white p-3"
                    >
                      <img
                        src={pkg.foto_url}
                        alt={pkg.nama_paket}
                        className="h-20 w-24 shrink-0 rounded-xl bg-[#FAF5FC] object-contain p-1"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex flex-1 flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-[#381E5A]">{pkg.nama_paket}</h4>
                            <p className="font-mono-nums text-xs font-semibold text-[#0C3328]">
                              {formatRupiah(pkg.harga_total)} ({formatRupiah(pkg.setoran_harian)}/hr)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleWishlist(pkg.id)}
                            aria-label={`Hapus ${pkg.nama_paket} dari pilihan`}
                            className="rounded p-1 text-stone-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowWishlistDrawer(false);
                              handleOpenDetail(pkg);
                            }}
                            className="flex-1 rounded-lg border border-[#E4DCCB] py-1.5 text-[11px] font-semibold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
                          >
                            Lihat Detail
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowWishlistDrawer(false);
                              handleLockSimulation({
                                packageItem: pkg,
                                durasiMinggu: Math.max(12, Math.round(pkg.durasi_hari / 7)),
                                frekuensi: 'harian',
                                estimasiSetoran: pkg.setoran_harian,
                                selectedAgentId,
                              });
                            }}
                            className="flex-1 rounded-lg bg-[#0C3328] py-1.5 text-[11px] font-semibold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
                          >
                            Pesan Paket
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Profile Modal */}
        {showProfileModal && userProfile && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={handleSaveProfile}
              className="w-full max-w-md rounded-2xl border border-[#E4DCCB] bg-white p-6 shadow-xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="inline-flex items-center gap-1 text-xs font-semibold text-[#381E5A]">
                    <Shield className="h-3.5 w-3.5 text-[#C8A053]" />
                    Peran Akun: {userProfile.role.toUpperCase()}
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold text-stone-900">
                    Lengkapi Profil &amp; Nomor WhatsApp
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="rounded-lg p-1 text-stone-500 hover:bg-stone-100 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Username</label>
                  <input
                    type="text"
                    maxLength={32}
                    value={editUsername}
                    onChange={(e) =>
                      setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder="Contoh: siti_tasik"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Nomor WhatsApp Aktif
                  </label>
                  <input
                    type="tel"
                    required
                    minLength={8}
                    value={editWa}
                    onChange={(e) => setEditWa(e.target.value)}
                    placeholder="0813xxxxxxxx"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Wilayah Priangan Timur
                  </label>
                  <select
                    value={editWilayah}
                    disabled={userProfile.role === 'agen' || userProfile.role === 'korwil'}
                    onChange={(e) => setEditWilayah(e.target.value as WilayahPriangan)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 disabled:bg-stone-100 disabled:text-stone-600"
                  >
                    {WILAYAH_LIST.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                  {(userProfile.role === 'agen' || userProfile.role === 'korwil') && (
                    <p className="mt-1 text-[11px] text-stone-500">
                      Wilayah tugas Agen/Korwil hanya dapat diubah oleh Admin Pusat.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 rounded-lg border border-stone-300 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-[#0C3328] py-2 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
                >
                  Simpan Profil
                </button>
              </div>
            </form>
          </div>
        )}

        <AuthModal
          isOpen={showAuthModal}
          initialMode={authModalMode}
          onClose={() => setShowAuthModal(false)}
          onLoginIdentifier={handleLoginWithIdentifier}
          onRegisterMember={handleRegisterMember}
          onRegisterAgent={handleRegisterAgent}
          onLoginGoogle={handleLoginWithGoogle}
          onSendPasswordReset={handleSendPasswordReset}
        />

        <FloatingNotificationWidget
          userProfile={userProfile}
          notifications={notifications}
          deposits={deposits}
          agentApplications={agentApplications}
          contactMessages={contactMessages}
          appSettings={appSettings}
          allUsers={allUsers}
          onNavigateTarget={(view, tab) => {
            if (view === 'operasional' && !canAccessOperational) {
              setActiveView('member');
              return;
            }
            setActiveView(view);
            if (view === 'operasional' && tab) {
              setDashboardTargetTab({ tab, nonce: Date.now() });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenAuth={(mode) => openAuthModal(mode || 'login')}
        />

        <OfflineIndicator />
      </div>
    </ErrorBoundary>
  );
}
