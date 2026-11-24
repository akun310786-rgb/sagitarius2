import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const MEMBER_A = 'member_a_uid';
const MEMBER_B = 'member_b_uid';
const AGEN_A = 'agen_a_uid';
const AGEN_B = 'agen_b_uid';
const KORWIL_CIAMIS = 'korwil_ciamis_uid';
const KORWIL_TASIK = 'korwil_tasik_uid';
const ADMIN_UID = 'admin_staff_uid';
const BOOTSTRAP_UID = 'bootstrap_admin_uid';

async function seedDatabase() {
  const now = Timestamp.now();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await setDoc(doc(db, 'admins', ADMIN_UID), {
      uid: ADMIN_UID,
      role: 'admin',
      createdAt: now,
    });

    await setDoc(doc(db, 'users', MEMBER_A), {
      uid: MEMBER_A,
      nama: 'Member A',
      username: 'membera',
      no_wa: '081111111111',
      role: 'member',
      wilayah: 'Ciamis',
      agen_id: AGEN_A,
      kode_agen: 'SP-CMS-01',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'users', MEMBER_B), {
      uid: MEMBER_B,
      nama: 'Member B',
      username: 'memberb',
      no_wa: '082222222222',
      role: 'member',
      wilayah: 'Tasikmalaya',
      agen_id: AGEN_B,
      kode_agen: 'SP-TSM-01',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'users', AGEN_A), {
      uid: AGEN_A,
      nama: 'Agen Ciamis',
      no_wa: '083333333333',
      role: 'agen',
      kode_agen: 'SP-CMS-01',
      wilayah: 'Ciamis',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'users', AGEN_B), {
      uid: AGEN_B,
      nama: 'Agen Tasik',
      no_wa: '084444444444',
      role: 'agen',
      kode_agen: 'SP-TSM-01',
      wilayah: 'Tasikmalaya',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'users', KORWIL_CIAMIS), {
      uid: KORWIL_CIAMIS,
      nama: 'Korwil Ciamis',
      no_wa: '085555555555',
      role: 'korwil',
      wilayah: 'Ciamis',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'users', KORWIL_TASIK), {
      uid: KORWIL_TASIK,
      nama: 'Korwil Tasik',
      no_wa: '086666666666',
      role: 'korwil',
      wilayah: 'Tasikmalaya',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'users', ADMIN_UID), {
      uid: ADMIN_UID,
      nama: 'Admin Utama',
      no_wa: '087777777777',
      role: 'admin',
      wilayah: 'Ciamis',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'packages', 'pkg_1'), {
      nama_paket: 'Paket Hemat',
      kategori: 'bunda',
      harga_total: 500000,
      setoran_harian: 2000,
      setoran_mingguan: 14000,
      durasi_hari: 250,
      daftar_isi: ['Minyak Goreng 2L', 'Beras 5kg'],
      bonus_thr: 25000,
      foto_url: 'https://www.sagitariusparcel.web.id/paket.jpg',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'agents', 'agent_pub_1'), {
      kode_agen: 'SP-CMS-01',
      nama: 'Agen Ciamis',
      wilayah: 'Ciamis',
      no_wa: '083333333333',
      jumlah_member: 12,
      aktif: true,
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'app_settings', 'public'), {
      bank_nama: 'BRI',
      bank_rekening: '1234567890',
      bank_atas_nama: 'Sagitarius Parcel',
      qris_catatan: 'Scan QRIS resmi',
      pengumuman_judul: 'Info Operasional',
      pengumuman_isi: 'Jadwal setoran berjalan normal.',
      pengumuman_aktif: true,
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'subscriptions', 'sub_a'), {
      member_id: MEMBER_A,
      member_nama: 'Member A',
      agen_id: AGEN_A,
      wilayah: 'Ciamis',
      package_id: 'pkg_1',
      package_nama: 'Paket Hemat',
      target_nominal: 500000,
      total_terkumpul: 100000,
      status: 'aktif',
      qr_code_token: 'SP-QR-MEMBERA-001',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'subscriptions', 'sub_a_empty'), {
      member_id: MEMBER_A,
      member_nama: 'Member A',
      agen_id: AGEN_A,
      wilayah: 'Ciamis',
      package_id: 'pkg_1',
      package_nama: 'Paket Hemat',
      target_nominal: 500000,
      total_terkumpul: 0,
      status: 'aktif',
      qr_code_token: 'SP-QR-MEMBERA-002',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'subscriptions', 'sub_b'), {
      member_id: MEMBER_B,
      member_nama: 'Member B',
      agen_id: AGEN_B,
      wilayah: 'Tasikmalaya',
      package_id: 'pkg_1',
      package_nama: 'Paket Hemat',
      target_nominal: 500000,
      total_terkumpul: 150000,
      status: 'aktif',
      qr_code_token: 'SP-QR-MEMBERB-001',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'deposits', 'dep_a_pending'), {
      subscription_id: 'sub_a',
      member_id: MEMBER_A,
      member_nama: 'Member A',
      agen_id: AGEN_A,
      wilayah: 'Ciamis',
      jenis_transaksi: 'setoran',
      nominal: 50000,
      metode: 'transfer',
      status_verifikasi: 'pending',
      tanggal: '2026-11-23',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'deposits', 'dep_a_verified'), {
      subscription_id: 'sub_a',
      member_id: MEMBER_A,
      member_nama: 'Member A',
      agen_id: AGEN_A,
      wilayah: 'Ciamis',
      jenis_transaksi: 'setoran',
      nominal: 100000,
      metode: 'tunai_agen',
      status_verifikasi: 'verified',
      validated_by: 'Agen Ciamis',
      tanggal: '2026-11-22',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'deposits', 'dep_b_pending'), {
      subscription_id: 'sub_b',
      member_id: MEMBER_B,
      member_nama: 'Member B',
      agen_id: AGEN_B,
      wilayah: 'Tasikmalaya',
      jenis_transaksi: 'setoran',
      nominal: 75000,
      metode: 'transfer',
      status_verifikasi: 'pending',
      tanggal: '2026-11-23',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'agent_settlements', 'settle_a'), {
      agen_id: AGEN_A,
      agen_nama: 'Agen Ciamis',
      wilayah: 'Ciamis',
      jenis: 'setor_tunai_pusat',
      nominal: 100000,
      status: 'pending',
      tanggal: '2026-11-23',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'agent_settlements', 'settle_b'), {
      agen_id: AGEN_B,
      agen_nama: 'Agen Tasik',
      wilayah: 'Tasikmalaya',
      jenis: 'setor_tunai_pusat',
      nominal: 120000,
      status: 'pending',
      tanggal: '2026-11-23',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'door_prize_draws', 'draw_a'), {
      hadiah: 'Magic Com',
      kupon_kode: 'DP-CMS-001',
      subscription_id: 'sub_a',
      member_id: MEMBER_A,
      member_nama: 'Member A',
      wilayah: 'Ciamis',
      tanggal_undi: '2026-11-20',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'door_prize_draws', 'draw_b'), {
      hadiah: 'Blender',
      kupon_kode: 'DP-TSM-001',
      subscription_id: 'sub_b',
      member_id: MEMBER_B,
      member_nama: 'Member B',
      wilayah: 'Tasikmalaya',
      tanggal_undi: '2026-11-20',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'warehouse_inventory', 'inv_1'), {
      item_nama: 'Minyak Goreng 2L',
      stok_tersedia: 50,
      harga_beli_satuan: 32000,
      satuan: 'pcs',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'contact_messages', 'msg_1'), {
      nama: 'Calon Pelanggan',
      no_wa: '089999999999',
      pesan: 'Ingin menanyakan paket parcel.',
      status: 'baru',
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function runTests() {
  const hostEnv = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [host, portStr] = hostEnv.split(':');
  const port = Number(portStr || 8080);

  testEnv = await initializeTestEnvironment({
    projectId: 'sagitarius-parcel-test',
    firestore: {
      host,
      port,
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  let passed = 0;
  async function check(name: string, fn: () => Promise<void>) {
    await testEnv.clearFirestore();
    await seedDatabase();
    await fn();
    passed += 1;
    console.log(`PASS [${passed}]: ${name}`);
  }

  try {
    await check('1. Pengguna tanpa login tidak dapat membaca data pribadi/internal, tetapi dapat membaca katalog publik', async () => {
      const anon = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(anon, 'packages', 'pkg_1')));
      await assertSucceeds(getDocs(collection(anon, 'packages')));
      await assertSucceeds(getDocs(collection(anon, 'agents')));

      await assertFails(getDoc(doc(anon, 'users', MEMBER_A)));
      await assertFails(getDoc(doc(anon, 'subscriptions', 'sub_a')));
      await assertFails(getDoc(doc(anon, 'deposits', 'dep_a_pending')));
      await assertFails(getDoc(doc(anon, 'app_settings', 'public')));
      await assertFails(getDoc(doc(anon, 'door_prize_draws', 'draw_a')));
      await assertFails(getDocs(collection(anon, 'warehouse_inventory')));
      await assertFails(getDocs(collection(anon, 'contact_messages')));
      await assertFails(getDocs(collection(anon, 'login_aliases')));
    });

    await check('2. Member A tidak dapat membaca atau mengubah profil/kontrak/setoran milik Member B', async () => {
      const memberA = testEnv.authenticatedContext(MEMBER_A).firestore();
      await assertSucceeds(getDoc(doc(memberA, 'subscriptions', 'sub_a')));
      await assertSucceeds(getDocs(query(collection(memberA, 'subscriptions'), where('member_id', '==', MEMBER_A))));

      await assertFails(getDoc(doc(memberA, 'users', MEMBER_B)));
      await assertFails(getDoc(doc(memberA, 'subscriptions', 'sub_b')));
      await assertFails(getDoc(doc(memberA, 'deposits', 'dep_b_pending')));
      await assertFails(getDocs(collection(memberA, 'subscriptions')));
      await assertFails(getDocs(query(collection(memberA, 'subscriptions'), where('member_id', '==', MEMBER_B))));
      await assertFails(getDocs(query(collection(memberA, 'deposits'), where('member_id', '==', MEMBER_B))));
    });

    await check('3. Member tidak dapat mengubah saldo total_terkumpul, status, atau privilege escalation lewat browser', async () => {
      const memberA = testEnv.authenticatedContext(MEMBER_A).firestore();
      await assertFails(updateDoc(doc(memberA, 'subscriptions', 'sub_a'), {
        total_terkumpul: 9999999,
        updatedAt: serverTimestamp(),
      }));
      await assertFails(updateDoc(doc(memberA, 'subscriptions', 'sub_a'), {
        status: 'lunas',
        updatedAt: serverTimestamp(),
      }));
      await assertFails(updateDoc(doc(memberA, 'users', MEMBER_A), {
        role: 'admin',
        updatedAt: serverTimestamp(),
      }));
      await assertFails(updateDoc(doc(memberA, 'users', MEMBER_A), {
        isVerified: true,
        updatedAt: serverTimestamp(),
      }));
      await assertFails(setDoc(doc(memberA, 'subscriptions', 'sub_fake_init'), {
        member_id: MEMBER_A,
        member_nama: 'Member A',
        agen_id: AGEN_A,
        wilayah: 'Ciamis',
        package_id: 'pkg_1',
        package_nama: 'Paket Hemat',
        target_nominal: 500000,
        total_terkumpul: 500000,
        status: 'lunas',
        qr_code_token: 'SP-QR-FAKE-001',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    });

    await check('4. Member hanya boleh membuat setoran pending pada kontrak miliknya & ditolak jika overdraft/spoofing/verified', async () => {
      const memberA = testEnv.authenticatedContext(MEMBER_A).firestore();
      await assertSucceeds(setDoc(doc(memberA, 'deposits', 'dep_a_new'), {
        subscription_id: 'sub_a',
        member_id: MEMBER_A,
        member_nama: 'Member A',
        agen_id: AGEN_A,
        wilayah: 'Ciamis',
        jenis_transaksi: 'setoran',
        nominal: 25000,
        metode: 'transfer',
        status_verifikasi: 'pending',
        tanggal: '2026-11-23',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      // Tolak self-approve verified
      await assertFails(setDoc(doc(memberA, 'deposits', 'dep_a_spoof_verified'), {
        subscription_id: 'sub_a',
        member_id: MEMBER_A,
        agen_id: AGEN_A,
        wilayah: 'Ciamis',
        jenis_transaksi: 'setoran',
        nominal: 25000,
        metode: 'transfer',
        status_verifikasi: 'verified',
        tanggal: '2026-11-23',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      // Tolak setoran ke kontrak milik Member B
      await assertFails(setDoc(doc(memberA, 'deposits', 'dep_cross_sub'), {
        subscription_id: 'sub_b',
        member_id: MEMBER_A,
        agen_id: AGEN_B,
        wilayah: 'Tasikmalaya',
        jenis_transaksi: 'setoran',
        nominal: 25000,
        metode: 'transfer',
        status_verifikasi: 'pending',
        tanggal: '2026-11-23',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      // Tolak penarikan melebihi total_terkumpul (saldo 100.000, tarik 200.000)
      await assertFails(setDoc(doc(memberA, 'deposits', 'dep_overdraft'), {
        subscription_id: 'sub_a',
        member_id: MEMBER_A,
        agen_id: AGEN_A,
        wilayah: 'Ciamis',
        jenis_transaksi: 'penarikan',
        nominal: 200000,
        metode: 'transfer_keluar',
        status_verifikasi: 'pending',
        tanggal: '2026-11-23',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    });

    await check('5. Agen A dapat memverifikasi transaksi Member A, namun TIDAK dapat membaca atau mengubah data/transaksi Agen B', async () => {
      const agenA = testEnv.authenticatedContext(AGEN_A).firestore();
      await assertSucceeds(getDoc(doc(agenA, 'deposits', 'dep_a_pending')));
      await assertSucceeds(updateDoc(doc(agenA, 'deposits', 'dep_a_pending'), {
        status_verifikasi: 'verified',
        validated_by: 'Agen Ciamis',
        updatedAt: serverTimestamp(),
      }));

      await assertFails(getDoc(doc(agenA, 'deposits', 'dep_b_pending')));
      await assertFails(getDoc(doc(agenA, 'subscriptions', 'sub_b')));
      await assertFails(updateDoc(doc(agenA, 'deposits', 'dep_b_pending'), {
        status_verifikasi: 'verified',
        validated_by: 'Agen Ciamis',
        updatedAt: serverTimestamp(),
      }));
      await assertFails(updateDoc(doc(agenA, 'subscriptions', 'sub_b'), {
        total_terkumpul: 225000,
        updatedAt: serverTimestamp(),
      }));
      // Agen tidak boleh mengubah wilayah profilnya sendiri
      await assertFails(updateDoc(doc(agenA, 'users', AGEN_A), {
        wilayah: 'Tasikmalaya',
        updatedAt: serverTimestamp(),
      }));
    });

    await check('6. Korwil Ciamis dapat mengakses wilayah Ciamis, TIDAK dapat mengakses/mengubah wilayah Tasikmalaya atau mengubah wilayahnya sendiri', async () => {
      const korwilCiamis = testEnv.authenticatedContext(KORWIL_CIAMIS).firestore();
      await assertSucceeds(getDocs(query(collection(korwilCiamis, 'subscriptions'), where('wilayah', '==', 'Ciamis'))));
      await assertSucceeds(getDocs(query(collection(korwilCiamis, 'deposits'), where('wilayah', '==', 'Ciamis'))));
      await assertSucceeds(updateDoc(doc(korwilCiamis, 'deposits', 'dep_a_pending'), {
        status_verifikasi: 'verified',
        validated_by: 'Korwil Ciamis',
        updatedAt: serverTimestamp(),
      }));

      await assertFails(getDoc(doc(korwilCiamis, 'subscriptions', 'sub_b')));
      await assertFails(getDoc(doc(korwilCiamis, 'deposits', 'dep_b_pending')));
      await assertFails(getDoc(doc(korwilCiamis, 'agent_settlements', 'settle_b')));
      await assertFails(getDoc(doc(korwilCiamis, 'door_prize_draws', 'draw_b')));
      await assertFails(getDocs(query(collection(korwilCiamis, 'subscriptions'), where('wilayah', '==', 'Tasikmalaya'))));
      await assertFails(updateDoc(doc(korwilCiamis, 'deposits', 'dep_b_pending'), {
        status_verifikasi: 'verified',
        validated_by: 'Korwil Ciamis',
        updatedAt: serverTimestamp(),
      }));
      await assertFails(updateDoc(doc(korwilCiamis, 'users', KORWIL_CIAMIS), {
        wilayah: 'Tasikmalaya',
        updatedAt: serverTimestamp(),
      }));
    });

    await check('7. Semua role (termasuk Admin) dilarang menghapus transaksi keuangan; kontrak bersaldo > 0 dilarang dihapus; transaksi verified terkunci', async () => {
      const memberA = testEnv.authenticatedContext(MEMBER_A).firestore();
      const agenA = testEnv.authenticatedContext(AGEN_A).firestore();
      const korwilCiamis = testEnv.authenticatedContext(KORWIL_CIAMIS).firestore();
      const admin = testEnv.authenticatedContext(ADMIN_UID).firestore();

      await assertFails(deleteDoc(doc(memberA, 'deposits', 'dep_a_pending')));
      await assertFails(deleteDoc(doc(agenA, 'deposits', 'dep_a_pending')));
      await assertFails(deleteDoc(doc(korwilCiamis, 'deposits', 'dep_a_pending')));
      await assertFails(deleteDoc(doc(admin, 'deposits', 'dep_a_pending')));
      await assertFails(deleteDoc(doc(admin, 'deposits', 'dep_a_verified')));
      await assertFails(deleteDoc(doc(admin, 'agent_settlements', 'settle_a')));

      // Transaksi verified terkunci permanen
      await assertFails(updateDoc(doc(admin, 'deposits', 'dep_a_verified'), {
        nominal: 500000,
        updatedAt: serverTimestamp(),
      }));
      await assertFails(updateDoc(doc(admin, 'deposits', 'dep_a_verified'), {
        status_verifikasi: 'rejected',
        updatedAt: serverTimestamp(),
      }));

      // Kontrak dengan total_terkumpul > 0 ditolak saat delete, kontrak kosong (0) diizinkan
      await assertFails(deleteDoc(doc(admin, 'subscriptions', 'sub_a')));
      await assertSucceeds(deleteDoc(doc(admin, 'subscriptions', 'sub_a_empty')));
    });

    await check('8. Data publik /agents menolak field internal (komisi_persen / korwil_id); bootstrapped admin wajib email_verified == true', async () => {
      const admin = testEnv.authenticatedContext(ADMIN_UID).firestore();
      await assertFails(setDoc(doc(admin, 'agents', 'agent_leak'), {
        kode_agen: 'SP-LEAK-01',
        nama: 'Agen Leak',
        wilayah: 'Ciamis',
        no_wa: '081234567890',
        jumlah_member: 1,
        komisi_persen: 10,
        aktif: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      const unverifiedBootstrap = testEnv.authenticatedContext(BOOTSTRAP_UID, {
        email: 'akun310786@gmail.com',
        email_verified: false,
      }).firestore();
      await assertFails(getDocs(collection(unverifiedBootstrap, 'warehouse_inventory')));

      const verifiedBootstrap = testEnv.authenticatedContext(BOOTSTRAP_UID, {
        email: 'akun310786@gmail.com',
        email_verified: true,
      }).firestore();
      await assertSucceeds(getDocs(collection(verifiedBootstrap, 'warehouse_inventory')));
      await assertSucceeds(setDoc(doc(admin, 'audit_logs', 'log_1'), {
        aksi: 'TEST_SECURITY',
        target_label: 'Sistem',
        detail: 'Pengujian audit log append-only',
        actor_uid: ADMIN_UID,
        actor_nama: 'Admin Utama',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
      await assertFails(updateDoc(doc(admin, 'audit_logs', 'log_1'), {
        detail: 'Diubah',
        updatedAt: serverTimestamp(),
      }));
      await assertFails(deleteDoc(doc(admin, 'audit_logs', 'log_1')));
    });

    await check('9. Pendaftaran agen baru (agent_applications) & notifikasi realtime (notifications) terisolasi sesuai peran dan kewenangan', async () => {
      const anon = testEnv.unauthenticatedContext().firestore();
      const memberA = testEnv.authenticatedContext(MEMBER_A).firestore();
      const memberB = testEnv.authenticatedContext(MEMBER_B).firestore();
      const admin = testEnv.authenticatedContext(ADMIN_UID).firestore();

      // Unauthenticated ditolak membaca/menulis agent_applications & notifications
      await assertFails(getDocs(collection(anon, 'agent_applications')));
      await assertFails(getDocs(collection(anon, 'notifications')));

      // Member A bisa mengirim pengajuan agen pending atas UID miliknya
      await assertSucceeds(setDoc(doc(memberA, 'agent_applications', MEMBER_A), {
        applicant_uid: MEMBER_A,
        nama: 'Member A',
        username: 'membera',
        no_wa: '081111111111',
        wilayah: 'Ciamis',
        kecamatan: 'Ciamis Kota',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      // Member A dilarang menyetujui pengajuannya sendiri atau mendaftarkan milik Member B
      await assertFails(updateDoc(doc(memberA, 'agent_applications', MEMBER_A), {
        status: 'approved',
        assigned_kode_agen: 'AGT-FAKE-01',
        updatedAt: serverTimestamp(),
      }));
      await assertFails(setDoc(doc(memberA, 'agent_applications', MEMBER_B), {
        applicant_uid: MEMBER_B,
        nama: 'Spoof',
        no_wa: '081111111111',
        wilayah: 'Ciamis',
        kecamatan: 'Ciamis Kota',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      // Member A bisa mengirim notifikasi pendaftaran_agen ke staff_admin & diri sendiri, tidak bisa broadcast
      await assertSucceeds(setDoc(doc(memberA, 'notifications', 'notif_admin_app'), {
        recipient_type: 'admin',
        recipient_uid: 'staff_admin',
        wilayah: 'Ciamis',
        kategori: 'pendaftaran_agen',
        judul: 'Pendaftaran Agen Baru',
        pesan: 'Member A mendaftar sebagai agen Ciamis.',
        sender_uid: MEMBER_A,
        sender_nama: 'Member A',
        is_read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
      await assertFails(setDoc(doc(memberA, 'notifications', 'notif_fake_broadcast'), {
        recipient_type: 'broadcast',
        recipient_uid: 'all_signed_in',
        kategori: 'pengumuman',
        judul: 'Broadcast Palsu',
        pesan: 'Member tidak boleh kirim broadcast.',
        sender_uid: MEMBER_A,
        is_read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

      // Member B tidak boleh membaca pengajuan agen atau notifikasi admin milik Member A
      await assertFails(getDoc(doc(memberB, 'agent_applications', MEMBER_A)));
      await assertFails(getDoc(doc(memberB, 'notifications', 'notif_admin_app')));

      // Admin dapat menyetujui agent_application, mengirim notifikasi ke Member A, dan Member A dapat menandai dibaca
      await assertSucceeds(updateDoc(doc(admin, 'agent_applications', MEMBER_A), {
        status: 'approved',
        assigned_kode_agen: 'AGT-CMS-99',
        reviewed_by: 'Admin Utama',
        updatedAt: serverTimestamp(),
      }));
      await assertSucceeds(setDoc(doc(admin, 'notifications', 'notif_to_member_a'), {
        recipient_type: 'user',
        recipient_uid: MEMBER_A,
        wilayah: 'Ciamis',
        kategori: 'pendaftaran_agen',
        judul: 'Akun Agen Disetujui',
        pesan: 'Selamat! Kode agen AGT-CMS-99 aktif.',
        sender_uid: ADMIN_UID,
        sender_nama: 'Admin Utama',
        is_read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
      await assertSucceeds(updateDoc(doc(memberA, 'notifications', 'notif_to_member_a'), {
        is_read: true,
        updatedAt: serverTimestamp(),
      }));
      // Member B tidak boleh menandai dibaca notifikasi milik Member A
      await assertFails(updateDoc(doc(memberB, 'notifications', 'notif_to_member_a'), {
        is_read: true,
        updatedAt: serverTimestamp(),
      }));
    });

    console.log(`\nALL ${passed} SECURITY TEST SUITES PASSED!`);
    assert.equal(passed, 9);
  } finally {
    await testEnv.cleanup();
  }
}

runTests().catch((err) => {
  console.error('Security rules test suite failed:', err);
  process.exit(1);
});
