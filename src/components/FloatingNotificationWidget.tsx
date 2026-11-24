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

interface DerivedLiveAlert {
  id: string;
  judul: string;
  pesan: string;
  kategori: NotificationCategory;
  tautan_view: 'member' | 'operasional';
  tautan_tab?: string;
}

function getTimestampMs(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
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
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [showComposer, setShowComposer] = useState(false);

  // Admin quick notification composer state
  const [targetMode, setTargetMode] = useState<'broadcast' | 'korwil' | 'user'>('broadcast');
  const [targetWilayah, setTargetWilayah] = useState<WilayahPriangan>('Tasikmalaya');
  const [targetUserId, setTargetUserId] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [composerFeedback, setComposerFeedback] = useState('');

  // Track locally read IDs for broadcast notifications (and dismissed live banners)
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
    const unique = Array.from(new Set(ids)).slice(-100);
    setLocalReadIds(unique);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(unique));
    } catch {
      // Ignore storage limits
    }
  };

  // Real-time pop-up toast when new notifications arrive after initial snapshot
  const [toastNotif, setToastNotif] = useState<{ judul: string; pesan: string } | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const isStaff =
    userProfile?.role === 'agen' ||
    userProfile?.role === 'korwil' ||
    userProfile?.role === 'admin';
  const isAdmin = userProfile?.role === 'admin';

  // Live operational alerts derived from existing real-time onSnapshot streams
  const liveAlerts = useMemo<DerivedLiveAlert[]>(() => {
    const alerts: DerivedLiveAlert[] = [];

    if (appSettings.pengumuman_aktif && appSettings.pengumuman_judul) {
      alerts.push({
        id: `live_pengumuman_${appSettings.pengumuman_judul.slice(0, 24)}`,
        judul: appSettings.pengumuman_judul,
        pesan: appSettings.pengumuman_isi,
        kategori: 'pengumuman',
        tautan_view: 'member',
      });
    }

    if (isStaff && userProfile) {
      const pendingDeps = deposits.filter((d) => {
        if (d.status_verifikasi !== 'pending') return false;
        if (userProfile.role === 'agen') return d.agen_id === userProfile.uid;
        if (userProfile.role === 'korwil') return d.wilayah === userProfile.wilayah;
        return true;
      });
      if (pendingDeps.length > 0) {
        alerts.push({
          id: `live_pending_deps_${pendingDeps.length}`,
          judul: `${pendingDeps.length} Transaksi Menunggu Validasi`,
          pesan: 'Ada pengajuan setoran/penarikan dari member yang perlu diverifikasi di Dashboard.',
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

  const isNotifRead = (n: RealtimeNotification): boolean => {
    if (n.recipient_type === 'broadcast') {
      return localReadIds.includes(n.id);
    }
    return Boolean(n.is_read) || localReadIds.includes(n.id);
  };

  const unreadFirestoreNotifs = useMemo(
    () => notifications.filter((n) => !isNotifRead(n)),
    [notifications, localReadIds]
  );

  const unreadLiveAlerts = useMemo(
    () => liveAlerts.filter((a) => !localReadIds.includes(a.id)),
    [liveAlerts, localReadIds]
  );

  const totalUnread = unreadFirestoreNotifs.length + unreadLiveAlerts.length;

  useEffect(() => {
    if (!initializedRef.current) {
      notifications.forEach((n) => seenIdsRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }

    const newlyArrived = notifications.find(
      (n) => !seenIdsRef.current.has(n.id) && !isNotifRead(n)
    );
    notifications.forEach((n) => seenIdsRef.current.add(n.id));

    if (newlyArrived) {
      setToastNotif({ judul: newlyArrived.judul, pesan: newlyArrived.pesan });
    }
  }, [notifications]);

  useEffect(() => {
    if (!toastNotif) return;
    const timer = window.setTimeout(() => setToastNotif(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toastNotif]);

  const handleMarkAsRead = async (n: RealtimeNotification) => {
    if (isNotifRead(n)) return;
    persistLocalRead([...localReadIds, n.id]);
    if (n.recipient_type !== 'broadcast') {
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

  const handleMarkAllRead = async () => {
    const allIds = [
      ...notifications.map((n) => n.id),
      ...liveAlerts.map((a) => a.id),
    ];
    persistLocalRead([...localReadIds, ...allIds]);

    const updatable = unreadFirestoreNotifs.filter((n) => n.recipient_type !== 'broadcast');
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

    if (targetMode === 'korwil') {
      recipientType = 'korwil';
      recipientUid = `korwil_${targetWilayah}`;
      wilayahVal = targetWilayah;
    } else if (targetMode === 'user') {
      const selected = allUsers.find((u) => u.uid === targetUserId) || allUsers[0];
      if (!selected) {
        setComposerFeedback('Pilih pengguna tujuan terlebih dahulu.');
        return;
      }
      recipientType = selected.role === 'agen' ? 'agen' : 'user';
      recipientUid = selected.uid;
      wilayahVal = selected.wilayah;
    }

    setSendingNotif(true);
    setComposerFeedback('');
    try {
      await addDoc(collection(db, 'notifications'), {
        recipient_type: recipientType,
        recipient_uid: recipientUid,
        ...(wilayahVal ? { wilayah: wilayahVal } : {}),
        kategori: recipientType === 'broadcast' ? 'pengumuman' : 'sistem',
        judul: cleanTitle,
        pesan: cleanBody,
        tautan_view: recipientType === 'user' ? 'member' : 'operasional',
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
    return <ShieldCheck className="h-4 w-4 text-[#0C3328]" />;
  };

  const visibleNotifications = useMemo(() => {
    if (filterTab === 'unread') return unreadFirestoreNotifs;
    return notifications;
  }, [filterTab, notifications, unreadFirestoreNotifs]);

  const visibleLiveAlerts = useMemo(() => {
    if (filterTab === 'unread') return unreadLiveAlerts;
    return liveAlerts;
  }, [filterTab, liveAlerts, unreadLiveAlerts]);

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6 no-print">
      {/* Real-time pop-up alert bubble when a new message arrives */}
      {toastNotif && !isOpen && (
        <div className="w-72 sm:w-80 rounded-2xl border border-[#C8A053] bg-white p-3.5 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setToastNotif(null);
                setIsOpen(true);
              }}
              className="flex-1 text-left cursor-pointer"
            >
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0C3328]">
                <Bell className="h-3.5 w-3.5 text-[#C8A053]" />
                Notifikasi Baru
              </p>
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
          className="flex max-h-[76vh] w-[calc(100vw-2rem)] sm:w-96 flex-col overflow-hidden rounded-2xl border border-[#C8A053]/60 bg-white shadow-2xl"
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
                  Pesan &amp; Notifikasi Realtime
                </h3>
                <p className="text-[10px] text-stone-300">
                  {userProfile
                    ? `${userProfile.nama} · ${userProfile.role.toUpperCase()}`
                    : 'Info & Pengumuman Resmi'}
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

          {/* Filter & Actions Bar */}
          <div className="flex items-center justify-between border-b border-[#E4DCCB] bg-[#FAF7F2] px-4 py-2 text-[11px]">
            <div className="inline-flex rounded-lg border border-[#E4DCCB] bg-white p-0.5 font-semibold">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`rounded-md px-2.5 py-1 cursor-pointer ${
                  filterTab === 'all' ? 'bg-[#381E5A] text-white' : 'text-stone-600'
                }`}
              >
                Semua ({notifications.length + liveAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unread')}
                className={`rounded-md px-2.5 py-1 cursor-pointer ${
                  filterTab === 'unread' ? 'bg-[#381E5A] text-white' : 'text-stone-600'
                }`}
              >
                Belum Dibaca ({totalUnread})
              </button>
            </div>

            <div className="flex items-center gap-2">
              {totalUnread > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="inline-flex items-center gap-1 font-semibold text-[#0C3328] hover:underline cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Baca Semua</span>
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
                    setTargetMode(e.target.value as 'broadcast' | 'korwil' | 'user')
                  }
                  className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[11px] font-semibold"
                >
                  <option value="broadcast">Semua Pengguna</option>
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
            {!userProfile && (
              <div className="bg-[#FAF7F2] p-4 text-xs">
                <p className="font-bold text-[#381E5A]">
                  Masuk untuk Notifikasi Tabungan &amp; Pendaftaran Agen Realtime
                </p>
                <p className="mt-1 text-[11px] text-stone-600">
                  Dapatkan pemberitahuan langsung saat setoran diverifikasi, status agen disetujui, atau ada pengumuman wilayah.
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenAuth('login');
                    }}
                    className="rounded-lg bg-[#381E5A] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#492974] cursor-pointer"
                  >
                    Masuk Akun
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenAuth('register_agent');
                    }}
                    className="rounded-lg border border-[#0C3328] px-3 py-1.5 text-[11px] font-semibold text-[#0C3328] hover:bg-emerald-50 cursor-pointer"
                  >
                    Daftar Agen Baru
                  </button>
                </div>
              </div>
            )}

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
                        <p className="text-xs font-bold text-[#381E5A]">{alert.judul}</p>
                        <span className="shrink-0 text-[10px] font-semibold text-amber-800">
                          Langsung
                        </span>
                      </div>
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
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-stone-900">
                          {!read && (
                            <span
                              className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-600 align-middle"
                              aria-label="Belum dibaca"
                            />
                          )}
                          {n.judul}
                        </p>
                        <span className="shrink-0 text-[10px] text-stone-400">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
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
                    ? 'Semua pesan & notifikasi sudah dibaca'
                    : 'Belum ada pesan notifikasi baru'}
                </p>
                <p className="mt-1 text-[11px] text-stone-500">
                  Pembaruan setoran, persetujuan agen, dan pengumuman akan muncul otomatis di sini secara realtime.
                </p>
              </div>
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
        aria-label={`Notifikasi Realtime (${totalUnread} belum dibaca)`}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#C8A053] bg-[#381E5A] text-[#E8CA82] shadow-xl transition hover:scale-105 hover:bg-[#492974] cursor-pointer"
      >
        {totalUnread > 0 && !isOpen && (
          <span className="absolute inset-0 rounded-full border-2 border-[#E8CA82] animate-ping opacity-35" />
        )}
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6 transition-transform group-hover:scale-105" />
        )}
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-rose-600 px-1.5 font-mono-nums text-[11px] font-bold text-white shadow-xs">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  );
};
