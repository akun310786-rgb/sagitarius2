import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Bell,
  Briefcase,
  CheckCheck,
  ChevronRight,
  Megaphone,
  MessageSquare,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AgentApplication,
  AppPublicSettings,
  ContactMessage,
  Deposit,
  NotificationCategory,
  NotificationRecipientType,
  RealtimeNotification,
  UserProfile,
  WILAYAH_LIST,
  WilayahPriangan,
} from '../types';

interface FloatingNotificationWidgetProps {
  userProfile: UserProfile | null;
  notifications: RealtimeNotification[];
  deposits: Deposit[];
  agentApplications: AgentApplication[];
  contactMessages: ContactMessage[];
  appSettings: AppPublicSettings;
  allUsers: UserProfile[];
  onNavigateTarget: (view: 'member' | 'operasional', tab?: string) => void;
  onOpenAuth: (mode?: 'login' | 'register_member' | 'register_agent') => void;
}

type AudienceChannel = 'pengunjung' | 'member' | 'agen';

interface DerivedLiveAlert {
  id: string;
  channel: AudienceChannel;
  audienceLabel: string;
  judul: string;
  pesan: string;
  kategori: NotificationCategory;
  tautan_view: 'member' | 'operasional';
  tautan_tab?: string;
}

function getTimestampMs(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toMillis' in ts &&
    typeof (ts as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return Number((ts as { seconds?: unknown }).seconds || 0) * 1000;
  }
  return 0;
}

function formatRelativeTime(ts: unknown): string {
  const ms = getTimestampMs(ts);
  if (!ms) return 'Baru saja';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  return new Date(ms).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  });
}

function getNotificationChannel(n: RealtimeNotification): AudienceChannel {
  if (
    n.recipient_type === 'agen' ||
    n.recipient_type === 'korwil' ||
    n.recipient_type === 'admin'
  ) {
    return 'agen';
  }
  if (n.recipient_type === 'broadcast') {
    return n.recipient_uid === 'all_members' ? 'member' : 'pengunjung';
  }
  if (
    n.kategori === 'setoran' ||
    n.kategori === 'penarikan' ||
    n.kategori === 'kontrak'
  ) {
    return 'member';
  }
  return 'pengunjung';
}

function getAudienceBadge(n: RealtimeNotification): { label: string; tone: string } {
  if (n.recipient_type === 'agen') {
    return {
      label: 'Agen / Reseller',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    };
  }
  if (n.recipient_type === 'korwil') {
    return {
      label: n.wilayah ? `Korwil ${n.wilayah}` : 'Korwil Wilayah',
      tone: 'border-teal-200 bg-teal-50 text-teal-900',
    };
  }
  if (n.recipient_type === 'admin') {
    return {
      label: 'Admin Pusat',
      tone: 'border-amber-300 bg-amber-50 text-amber-900',
    };
  }
  if (
    getNotificationChannel(n) === 'member'
  ) {
    return {
      label: 'Member',
      tone: 'border-purple-200 bg-purple-50 text-[#381E5A]',
    };
  }
  return {
    label: 'Pengunjung Login',
    tone: 'border-stone-200 bg-stone-100 text-stone-700',
  };
}

export const FloatingNotificationWidget: React.FC<FloatingNotificationWidgetProps> = ({
  userProfile,
  notifications,
  deposits,
  agentApplications,
  contactMessages,
  appSettings,
  allUsers,
  onNavigateTarget,
  onOpenAuth,
}) => {
  const isStaff =
    userProfile?.role === 'agen' ||
    userProfile?.role === 'korwil' ||
    userProfile?.role === 'admin';
  const isAdmin = userProfile?.role === 'admin';

  const [isOpen, setIsOpen] = useState(false);
  const [audienceTab, setAudienceTab] = useState<AudienceChannel>('member');
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [showComposer, setShowComposer] = useState(false);

  // Sync default audience tab when account role changes
  useEffect(() => {
    if (!userProfile) {
      setAudienceTab('pengunjung');
      return;
    }
    if (
      userProfile.role === 'agen' ||
      userProfile.role === 'korwil' ||
      userProfile.role === 'admin'
    ) {
      setAudienceTab('agen');
    } else {
      setAudienceTab('member');
    }
  }, [userProfile?.uid, userProfile?.role]);

  // Admin quick notification composer state
  const [targetMode, setTargetMode] = useState<
    'broadcast_visitor' | 'broadcast_member' | 'all_agents' | 'korwil' | 'user'
  >('broadcast_visitor');
  const [targetWilayah, setTargetWilayah] = useState<WilayahPriangan>('Tasikmalaya');
  const [targetUserId, setTargetUserId] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [composerFeedback, setComposerFeedback] = useState('');

  // Track locally read IDs for shared broadcast notifications (and dismissed live banners)
  const storageKey = userProfile
    ? `sagitarius_read_notifs_${userProfile.uid}`
    : 'sagitarius_read_notifs_guest';

  const [localReadIds, setLocalReadIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setLocalReadIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setLocalReadIds([]);
    }
  }, [storageKey]);

  const persistLocalRead = (ids: string[]) => {
    const unique = Array.from(new Set(ids)).slice(-150);
    setLocalReadIds(unique);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(unique));
    } catch {
      // Ignore storage limits
    }
  };

  // Real-time pop-up toast when new notifications arrive after initial snapshot
  const [toastNotif, setToastNotif] = useState<{
    channelLabel: string;
    channel: AudienceChannel;
    judul: string;
    pesan: string;
  } | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    seenIdsRef.current = new Set();
    initializedRef.current = false;
  }, [userProfile?.uid]);

  // Strictly gate Firestore notifications based on user login & role
  const allowedNotifications = useMemo(() => {
    if (!userProfile) return [];
    return notifications.filter((n) => {
      const ch = getNotificationChannel(n);
      if (ch === 'agen' && !isStaff) return false;
      return true;
    });
  }, [notifications, userProfile, isStaff]);

  // Live operational & public announcement alerts separated by audience channel
  const liveAlerts = useMemo<DerivedLiveAlert[]>(() => {
    if (!userProfile) return [];
    const alerts: DerivedLiveAlert[] = [];

    if (appSettings.pengumuman_aktif && appSettings.pengumuman_judul) {
      alerts.push({
        id: `live_pengumuman_${appSettings.pengumuman_judul.slice(0, 24)}`,
        channel: 'pengunjung',
        audienceLabel: 'Pengunjung Login',
        judul: appSettings.pengumuman_judul,
        pesan: appSettings.pengumuman_isi,
        kategori: 'pengumuman',
        tautan_view: 'member',
      });
    }

    if (isStaff) {
      const pendingDeps = deposits.filter((d) => {
        if (d.status_verifikasi !== 'pending') return false;
        if (userProfile.role === 'agen') {
          return (
            d.agen_id === userProfile.uid ||
            (Boolean(userProfile.kode_agen) && d.agen_id === userProfile.kode_agen)
          );
        }
        if (userProfile.role === 'korwil') return d.wilayah === userProfile.wilayah;
        return true;
      });
      if (pendingDeps.length > 0) {
        alerts.push({
          id: `live_pending_deps_${pendingDeps.length}`,
          channel: 'agen',
          audienceLabel:
            userProfile.role === 'agen'
              ? 'Agen / Reseller'
              : userProfile.role === 'korwil'
                ? 'Korwil'
                : 'Admin Pusat',
          judul: `${pendingDeps.length} Transaksi Menunggu Validasi`,
          pesan:
            'Ada pengajuan setoran/penarikan dari member yang perlu diverifikasi di Dashboard.',
          kategori: 'setoran',
          tautan_view: 'operasional',
          tautan_tab: 'agen',
        });
      }
    }

    if (isAdmin) {
      const pendingApps = agentApplications.filter((a) => a.status === 'pending');
      if (pendingApps.length > 0) {
        alerts.push({
          id: `live_agent_apps_${pendingApps.length}`,
          channel: 'agen',
          audienceLabel: 'Admin Pusat',
          judul: `${pendingApps.length} Pendaftar Agen Baru Menunggu Persetujuan`,
          pesan: `Calon agen terbaru: ${pendingApps[0].nama} (${pendingApps[0].wilayah}). Buka Tab Pengguna & Agen untuk menyetujui.`,
          kategori: 'pendaftaran_agen',
          tautan_view: 'operasional',
          tautan_tab: 'users',
        });
      }
      const newMsgs = contactMessages.filter((m) => m.status === 'baru');
      if (newMsgs.length > 0) {
        alerts.push({
          id: `live_contact_msgs_${newMsgs.length}`,
          channel: 'agen',
          audienceLabel: 'Admin Pusat',
          judul: `${newMsgs.length} Pesan Kontak Pengunjung Belum Dibalas`,
          pesan: `Pesan terbaru dari ${newMsgs[0].nama}.`,
          kategori: 'pesan_kontak',
          tautan_view: 'operasional',
          tautan_tab: 'pesan',
        });
      }
    }

    return alerts;
  }, [appSettings, isStaff, isAdmin, userProfile, deposits, agentApplications, contactMessages]);

  const isSharedBroadcast = (n: RealtimeNotification): boolean =>
    n.recipient_type === 'broadcast' || n.recipient_uid === 'all_agents';

  const isNotifRead = (n: RealtimeNotification): boolean => {
    if (isSharedBroadcast(n)) {
      return localReadIds.includes(n.id);
    }
    return Boolean(n.is_read) || localReadIds.includes(n.id);
  };

  // Channel unread & total counts for clearly separated tabs
  const channelCounts = useMemo(() => {
    const countFor = (ch: AudienceChannel) => {
      const fsAll = allowedNotifications.filter((n) => getNotificationChannel(n) === ch);
      const fsUnread = fsAll.filter((n) => !isNotifRead(n));
      const lvAll = liveAlerts.filter((a) => a.channel === ch);
      const lvUnread = lvAll.filter((a) => !localReadIds.includes(a.id));
      return {
        total: fsAll.length + lvAll.length,
        unread: fsUnread.length + lvUnread.length,
      };
    };

    const pengunjung = countFor('pengunjung');
    const member = countFor('member');
    const agen = isStaff ? countFor('agen') : { total: 0, unread: 0 };

    return {
      pengunjung,
      member,
      agen,
      totalUnread: pengunjung.unread + member.unread + agen.unread,
    };
  }, [allowedNotifications, liveAlerts, localReadIds, isStaff]);

  useEffect(() => {
    if (!userProfile) return;
    if (!initializedRef.current) {
      allowedNotifications.forEach((n) => seenIdsRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }

    const newlyArrived = allowedNotifications.find(
      (n) => !seenIdsRef.current.has(n.id) && !isNotifRead(n)
    );
    allowedNotifications.forEach((n) => seenIdsRef.current.add(n.id));

    if (newlyArrived) {
      const badge = getAudienceBadge(newlyArrived);
      setToastNotif({
        channelLabel: badge.label,
        channel: getNotificationChannel(newlyArrived),
        judul: newlyArrived.judul,
        pesan: newlyArrived.pesan,
      });
    }
  }, [allowedNotifications, userProfile]);

  useEffect(() => {
    if (!toastNotif) return;
    const timer = window.setTimeout(() => setToastNotif(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toastNotif]);

  const handleMarkAsRead = async (n: RealtimeNotification) => {
    if (isNotifRead(n)) return;
    persistLocalRead([...localReadIds, n.id]);
    if (!isSharedBroadcast(n)) {
      try {
        await updateDoc(doc(db, 'notifications', n.id), {
          is_read: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `notifications/${n.id}`);
      }
    }
  };

  const handleMarkChannelRead = async () => {
    const channelNotifs = allowedNotifications.filter(
      (n) => getNotificationChannel(n) === audienceTab
    );
    const channelAlerts = liveAlerts.filter((a) => a.channel === audienceTab);
    const allIds = [...channelNotifs.map((n) => n.id), ...channelAlerts.map((a) => a.id)];
    persistLocalRead([...localReadIds, ...allIds]);

    const updatable = channelNotifs.filter(
      (n) => !isSharedBroadcast(n) && !isNotifRead(n)
    );
    await Promise.all(
      updatable.map(async (n) => {
        try {
          await updateDoc(doc(db, 'notifications', n.id), {
            is_read: true,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Ignore individual permission mismatch
        }
      })
    );
  };

  const handleSendAdminNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !isAdmin) return;
    const cleanTitle = notifTitle.trim().slice(0, 120);
    const cleanBody = notifBody.trim().slice(0, 500);
    if (cleanTitle.length < 2 || cleanBody.length < 2) {
      setComposerFeedback('Judul dan isi pesan minimal 2 karakter.');
      return;
    }

    let recipientType: NotificationRecipientType = 'broadcast';
    let recipientUid = 'all_signed_in';
    let wilayahVal: WilayahPriangan | undefined;
    let kategoriVal: NotificationCategory = 'pengumuman';
    let viewTarget: 'member' | 'operasional' = 'member';

    if (targetMode === 'broadcast_visitor') {
      recipientType = 'broadcast';
      recipientUid = 'all_signed_in';
      kategoriVal = 'pengumuman';
      viewTarget = 'member';
    } else if (targetMode === 'broadcast_member') {
      recipientType = 'broadcast';
      recipientUid = 'all_members';
      kategoriVal = 'pengumuman';
      viewTarget = 'member';
    } else if (targetMode === 'all_agents') {
      recipientType = 'agen';
      recipientUid = 'all_agents';
      kategoriVal = 'sistem';
      viewTarget = 'operasional';
    } else if (targetMode === 'korwil') {
      recipientType = 'korwil';
      recipientUid = `korwil_${targetWilayah}`;
      wilayahVal = targetWilayah;
      kategoriVal = 'sistem';
      viewTarget = 'operasional';
    } else if (targetMode === 'user') {
      const selected = allUsers.find((u) => u.uid === targetUserId) || allUsers[0];
      if (!selected) {
        setComposerFeedback('Pilih pengguna tujuan terlebih dahulu.');
        return;
      }
      recipientType = selected.role === 'agen' ? 'agen' : 'user';
      recipientUid = selected.uid;
      wilayahVal = selected.wilayah;
      kategoriVal = selected.role === 'agen' ? 'sistem' : 'kontrak';
      viewTarget = selected.role === 'agen' ? 'operasional' : 'member';
    }

    setSendingNotif(true);
    setComposerFeedback('');
    try {
      await addDoc(collection(db, 'notifications'), {
        recipient_type: recipientType,
        recipient_uid: recipientUid,
        ...(wilayahVal ? { wilayah: wilayahVal } : {}),
        kategori: kategoriVal,
        judul: cleanTitle,
        pesan: cleanBody,
        tautan_view: viewTarget,
        sender_uid: userProfile.uid,
        sender_nama: userProfile.nama,
        is_read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNotifTitle('');
      setNotifBody('');
      setShowComposer(false);
      setComposerFeedback('Notifikasi realtime berhasil dikirim.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
    } finally {
      setSendingNotif(false);
    }
  };

  const renderCategoryIcon = (kat: NotificationCategory) => {
    if (kat === 'pendaftaran_agen') {
      return <Briefcase className="h-4 w-4 text-emerald-700" />;
    }
    if (kat === 'setoran' || kat === 'penarikan') {
      return <Wallet className="h-4 w-4 text-[#381E5A]" />;
    }
    if (kat === 'pengumuman') {
      return <Megaphone className="h-4 w-4 text-amber-700" />;
    }
    if (kat === 'pesan_kontak') {
      return <MessageSquare className="h-4 w-4 text-sky-700" />;
    }
    if (kat === 'kontrak') {
      return <UserCheck className="h-4 w-4 text-[#0C3328]" />;
    }
    return <ShieldCheck className="h-4 w-4 text-[#0C3328]" />;
  };

  const visibleLiveAlerts = useMemo(() => {
    return liveAlerts.filter((a) => {
      if (a.channel !== audienceTab) return false;
      if (filterTab === 'unread') return !localReadIds.includes(a.id);
      return true;
    });
  }, [liveAlerts, audienceTab, filterTab, localReadIds]);

  const visibleNotifications = useMemo(() => {
    return allowedNotifications.filter((n) => {
      if (getNotificationChannel(n) !== audienceTab) return false;
      if (filterTab === 'unread') return !isNotifRead(n);
      return true;
    });
  }, [allowedNotifications, audienceTab, filterTab, localReadIds]);

  const activeChannelUnread = channelCounts[audienceTab].unread;
  const activeChannelTotal = channelCounts[audienceTab].total;

  const emptyChannelText =
    audienceTab === 'agen'
      ? 'Belum ada notifikasi transaksi agen, validasi setoran member, atau kas operasional.'
      : audienceTab === 'member'
        ? 'Belum ada notifikasi setoran, penarikan, atau kontrak tabungan member Anda.'
        : 'Belum ada info umum, pengumuman, atau status akun untuk pengunjung login.';

  return (
    <div className="fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6 no-print">
      {/* Real-time pop-up alert bubble when a new message arrives */}
      {toastNotif && !isOpen && userProfile && (
        <div className="w-[calc(100vw-1.5rem)] max-w-80 rounded-2xl border border-[#C8A053] bg-white p-3.5 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setAudienceTab(toastNotif.channel);
                setToastNotif(null);
                setIsOpen(true);
              }}
              className="flex-1 text-left cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-[#C8A053]" />
                <span className="text-[10px] font-bold text-[#0C3328]">
                  Notifikasi {toastNotif.channelLabel}
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-[#381E5A]">{toastNotif.judul}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-stone-600">
                {toastNotif.pesan}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setToastNotif(null)}
              className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
              aria-label="Tutup notifikasi cepat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Notification Drawer / Panel */}
      {isOpen && (
        <div
          className="flex max-h-[75dvh] w-[calc(100vw-1.5rem)] sm:w-[410px] flex-col overflow-hidden rounded-2xl border border-[#C8A053]/60 bg-white shadow-2xl"
          role="dialog"
          aria-label="Pusat Pesan & Notifikasi Realtime"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#C8A053]/40 bg-[#381E5A] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C8A053]/60 bg-[#0C3328] text-[#E8CA82]">
                <MessageSquare className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-sm font-bold text-[#E8CA82]">
                  Notifikasi Realtime
                </h3>
                <p className="text-[10px] text-stone-300">
                  {userProfile
                    ? `${userProfile.nama} · ${
                        userProfile.role === 'agen'
                          ? 'Agen / Reseller'
                          : userProfile.role === 'korwil'
                            ? 'Korwil'
                            : userProfile.role === 'admin'
                              ? 'Admin Pusat'
                              : 'Pengunjung & Member Login'
                      }`
                    : 'Pengunjung Belum Login'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-stone-300 hover:bg-white/10 hover:text-white cursor-pointer"
              aria-label="Tutup panel notifikasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Separated Audience Channel Tabs (Signed-in Users Only) */}
          {userProfile && (
            <div className="border-b border-[#E4DCCB] bg-white px-3 pt-2.5 pb-2">
              <div className={`grid gap-1.5 ${isStaff ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  onClick={() => setAudienceTab('pengunjung')}
                  className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition cursor-pointer ${
                    audienceTab === 'pengunjung'
                      ? 'border-[#381E5A] bg-[#381E5A] text-white shadow-xs'
                      : 'border-[#E4DCCB] bg-[#FAF7F2] text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Pengunjung</span>
                  {channelCounts.pengunjung.unread > 0 && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.5 font-mono-nums text-[9px] font-bold ${
                        audienceTab === 'pengunjung'
                          ? 'bg-[#C8A053] text-[#1E1032]'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {channelCounts.pengunjung.unread}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAudienceTab('member')}
                  className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition cursor-pointer ${
                    audienceTab === 'member'
                      ? 'border-[#381E5A] bg-[#381E5A] text-white shadow-xs'
                      : 'border-[#E4DCCB] bg-[#FAF7F2] text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Wallet className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Member</span>
                  {channelCounts.member.unread > 0 && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.5 font-mono-nums text-[9px] font-bold ${
                        audienceTab === 'member'
                          ? 'bg-[#C8A053] text-[#1E1032]'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {channelCounts.member.unread}
                    </span>
                  )}
                </button>

                {isStaff && (
                  <button
                    type="button"
                    onClick={() => setAudienceTab('agen')}
                    className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition cursor-pointer ${
                      audienceTab === 'agen'
                        ? 'border-[#0C3328] bg-[#0C3328] text-[#E8CA82] shadow-xs'
                        : 'border-[#E4DCCB] bg-[#FAF7F2] text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <Briefcase className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Agen / Reseller</span>
                    {channelCounts.agen.unread > 0 && (
                      <span
                        className={`ml-0.5 rounded-full px-1.5 py-0.5 font-mono-nums text-[9px] font-bold ${
                          audienceTab === 'agen'
                            ? 'bg-[#C8A053] text-[#1E1032]'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {channelCounts.agen.unread}
                      </span>
                    )}
                  </button>
                )}
              </div>

              <p className="mt-1.5 text-[10px] text-stone-500">
                {audienceTab === 'pengunjung'
                  ? 'Info umum, pengumuman resmi & status akun pengunjung yang sudah login.'
                  : audienceTab === 'member'
                    ? 'Aktivitas transaksi pembayaran, setoran, penarikan & kontrak tabungan Member.'
                    : 'Setoran masuk member, validasi pembayaran, kontrak baru & settlement Agen/Reseller.'}
              </p>
            </div>
          )}

          {/* Filter & Actions Bar (Signed-in Users Only) */}
          {userProfile && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4DCCB] bg-[#FAF7F2] px-3 sm:px-4 py-2 text-[11px]">
              <div className="inline-flex rounded-lg border border-[#E4DCCB] bg-white p-0.5 font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`rounded-md px-2.5 py-1 cursor-pointer ${
                    filterTab === 'all' ? 'bg-[#381E5A] text-white' : 'text-stone-600'
                  }`}
                >
                  Semua ({activeChannelTotal})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('unread')}
                  className={`rounded-md px-2.5 py-1 cursor-pointer ${
                    filterTab === 'unread' ? 'bg-[#381E5A] text-white' : 'text-stone-600'
                  }`}
                >
                  Belum Dibaca ({activeChannelUnread})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {activeChannelUnread > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleMarkChannelRead()}
                    className="inline-flex items-center gap-1 font-semibold text-[#0C3328] hover:underline cursor-pointer"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Baca Tab Ini</span>
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowComposer((v) => !v)}
                    className="rounded-md bg-[#0C3328] px-2 py-1 font-semibold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
                  >
                    {showComposer ? 'Tutup' : '+ Kirim'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Admin Quick Realtime Broadcast / Direct Message Composer */}
          {isAdmin && showComposer && (
            <form
              onSubmit={handleSendAdminNotification}
              className="space-y-2 border-b border-[#E4DCCB] bg-emerald-50/60 p-3 text-xs"
            >
              <p className="font-bold text-[#0C3328]">Kirim Notifikasi Realtime</p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={targetMode}
                  onChange={(e) =>
                    setTargetMode(
                      e.target.value as
                        | 'broadcast_visitor'
                        | 'broadcast_member'
                        | 'all_agents'
                        | 'korwil'
                        | 'user'
                    )
                  }
                  className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[11px] font-semibold"
                >
                  <option value="broadcast_visitor">Pengunjung Login (Umum)</option>
                  <option value="broadcast_member">Semua Member</option>
                  <option value="all_agents">Semua Agen / Reseller</option>
                  <option value="korwil">Korwil Wilayah</option>
                  <option value="user">Member / Agen Spesifik</option>
                </select>
                {targetMode === 'korwil' && (
                  <select
                    value={targetWilayah}
                    onChange={(e) => setTargetWilayah(e.target.value as WilayahPriangan)}
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[11px]"
                  >
                    {WILAYAH_LIST.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                )}
                {targetMode === 'user' && (
                  <select
                    value={targetUserId || allUsers[0]?.uid || ''}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[11px]"
                  >
                    {allUsers.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.nama} ({u.role})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <input
                type="text"
                required
                maxLength={120}
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Judul pesan / notifikasi..."
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
              />
              <textarea
                required
                rows={2}
                maxLength={500}
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                placeholder="Isi pesan pengingat setoran, jadwal, atau info penting..."
                className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={sendingNotif}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0C3328] py-1.5 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] disabled:opacity-60 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{sendingNotif ? 'Mengirim...' : 'Kirim Sekarang'}</span>
              </button>
            </form>
          )}

          {composerFeedback && (
            <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-semibold text-emerald-900">
              {composerFeedback}
            </div>
          )}

          {/* Scrollable Notification Feed */}
          <div className="flex-1 divide-y divide-stone-100 overflow-y-auto">
            {!userProfile ? (
              <div className="space-y-3 bg-[#FAF7F2] p-5 text-xs">
                <div className="rounded-xl border border-[#E4DCCB] bg-white p-3.5">
                  <p className="font-bold text-[#381E5A]">
                    Silakan Masuk untuk Mengaktifkan Notifikasi Realtime
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-stone-600">
                    Notifikasi dipisahkan otomatis sesuai akun Anda: info umum pengunjung yang sudah login, transaksi setoran/penarikan Member, serta validasi pembayaran khusus Agen &amp; Reseller.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenAuth('login');
                      }}
                      className="rounded-lg bg-[#381E5A] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#492974] cursor-pointer"
                    >
                      Masuk Akun
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenAuth('register_member');
                      }}
                      className="rounded-lg border border-[#C8A053] bg-white px-3 py-2 text-[11px] font-semibold text-[#381E5A] hover:bg-stone-50 cursor-pointer"
                    >
                      Gabung Member
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onOpenAuth('register_agent');
                      }}
                      className="rounded-lg border border-[#0C3328] px-3 py-2 text-[11px] font-semibold text-[#0C3328] hover:bg-emerald-50 cursor-pointer"
                    >
                      Daftar Agen Baru
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {visibleLiveAlerts.map((alert) => {
                  const read = localReadIds.includes(alert.id);
                  return (
                    <div
                      key={alert.id}
                      className={`p-3.5 transition ${read ? 'bg-white' : 'bg-amber-50/60'}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E4DCCB] bg-[#FAF7F2]">
                          {renderCategoryIcon(alert.kategori)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                              {alert.audienceLabel}
                            </span>
                            <span className="shrink-0 text-[10px] font-semibold text-amber-800">
                              Langsung
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-bold text-[#381E5A]">{alert.judul}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                            {alert.pesan}
                          </p>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                persistLocalRead([...localReadIds, alert.id]);
                                setIsOpen(false);
                                onNavigateTarget(alert.tautan_view, alert.tautan_tab);
                              }}
                              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#0C3328] hover:underline cursor-pointer"
                            >
                              <span>Buka Menu</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                            {!read && (
                              <button
                                type="button"
                                onClick={() => persistLocalRead([...localReadIds, alert.id])}
                                className="text-[11px] text-stone-500 hover:text-stone-800 cursor-pointer"
                              >
                                Tandai dibaca
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {visibleNotifications.map((n) => {
                  const read = isNotifRead(n);
                  const badge = getAudienceBadge(n);
                  return (
                    <div
                      key={n.id}
                      className={`p-3.5 transition ${read ? 'bg-white' : 'bg-emerald-50/45'}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E4DCCB] bg-[#FAF7F2]">
                          {renderCategoryIcon(n.kategori)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${badge.tone}`}
                            >
                              {badge.label}
                            </span>
                            <span className="shrink-0 text-[10px] text-stone-400">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-bold text-stone-900">
                            {!read && (
                              <span
                                className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-600 align-middle"
                                aria-label="Belum dibaca"
                              />
                            )}
                            {n.judul}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                            {n.pesan}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            {n.sender_nama && (
                              <span className="text-[10px] font-medium text-stone-400">
                                Dari: {n.sender_nama}
                              </span>
                            )}
                            {n.tautan_view && (
                              <button
                                type="button"
                                onClick={() => {
                                  void handleMarkAsRead(n);
                                  setIsOpen(false);
                                  onNavigateTarget(n.tautan_view!, n.tautan_tab);
                                }}
                                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#381E5A] hover:underline cursor-pointer"
                              >
                                <span>Lihat Detail</span>
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                            {!read && (
                              <button
                                type="button"
                                onClick={() => void handleMarkAsRead(n)}
                                className="text-[11px] font-medium text-stone-500 hover:text-stone-800 cursor-pointer"
                              >
                                Tandai dibaca
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {visibleLiveAlerts.length === 0 && visibleNotifications.length === 0 && (
                  <div className="p-8 text-center">
                    <MessageSquare className="mx-auto h-8 w-8 text-[#C8A053]" />
                    <p className="mt-2 text-xs font-bold text-[#381E5A]">
                      {filterTab === 'unread'
                        ? 'Semua notifikasi di tab ini sudah dibaca'
                        : 'Belum ada notifikasi di tab ini'}
                    </p>
                    <p className="mt-1 text-[11px] text-stone-500">{emptyChannelText}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Message Icon Button */}
      <button
        type="button"
        onClick={() => {
          setToastNotif(null);
          setIsOpen((prev) => !prev);
        }}
        aria-label={`Notifikasi Realtime (${channelCounts.totalUnread} belum dibaca)`}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#C8A053] bg-[#381E5A] text-[#E8CA82] shadow-xl transition hover:scale-105 hover:bg-[#492974] cursor-pointer"
      >
        {userProfile && channelCounts.totalUnread > 0 && !isOpen && (
          <span className="absolute inset-0 rounded-full border-2 border-[#E8CA82] animate-ping opacity-35" />
        )}
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6 transition-transform group-hover:scale-105" />
        )}
        {userProfile && channelCounts.totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-rose-600 px-1.5 font-mono-nums text-[11px] font-bold text-white shadow-xs">
            {channelCounts.totalUnread > 99 ? '99+' : channelCounts.totalUnread}
          </span>
        )}
      </button>
    </div>
  );
};
