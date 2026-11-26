# Security Specification — Sagitarius Parcel PWA (Fase 1 Hardened)

## Klasifikasi Data
- **Public Data**: `/packages/{packageId}`, `/agents/{agentId}` (tanpa field internal seperti `komisi_persen` atau `korwil_id`), dan `/product_substitutions/{subId}`.
- **Private User Data**: `/users/{userId}`, `/subscriptions/{subscriptionId}`, `/deposits/{depositId}`, `/door_prize_draws/{drawId}`, `/login_aliases/{aliasId}` (`get` tunggal untuk lookup login, `list` ditolak total).
- **Privileged Data**: `/admins/{adminId}`, `/app_settings/{settingId}`, `/agent_settlements/{settlementId}`, `/warehouse_inventory/{itemId}`, `/audit_logs/{logId}`, `/contact_messages/{messageId}` (`create` publik untuk form kontak, `read/update/delete` khusus Admin).

## Data Invariants
1. **User Role & Region Integrity**: Hanya `akun310786@gmail.com` (`email_verified == true`) atau Admin terdaftar yang dapat menetapkan role `agen`, `korwil`, atau `admin`. Pendaftaran baru hanya boleh `role: "member"`. Agen dan Korwil tidak dapat mengubah `role`, `wilayah`, atau `kode_agen` miliknya sendiri melalui update profil.
2. **Login Alias Isolation**: `/login_aliases/{aliasId}` hanya mengizinkan `get` pada ID valid (`wa_62...` atau `u_...`) dan menolak `list` total untuk mencegah scraping data login.
3. **Contract Ownership & Initial State**: Kontrak `subscriptions` hanya dapat dibuat dengan `total_terkumpul == 0` dan `status == "aktif"`. Member A tidak dapat membaca atau menulis kontrak Member B. Member tidak dapat mengubah `total_terkumpul`, `target_nominal`, `status`, `agen_id`, `agen_kode`, `agen_nama`, atau `wilayah`, maupun menghapus (`delete`) kontrak secara sepihak melalui browser (hanya Admin Pusat yang berwenang memindahkan agen atau menghapus kontrak saldo Rp 0).
4. **Agent & Korwil Scope Enforcement**:
   - **Agen**: Hanya dapat mengakses/memverifikasi kontrak, member, setoran, dan settlement dengan `agen_id == request.auth.uid` dan `wilayah` yang sesuai wilayah tugasnya. Agen A tidak bisa mengakses atau mengubah transaksi Agen B.
   - **Korwil**: Hanya dapat mengakses/memverifikasi user, kontrak, setoran, dan settlement pada `wilayah` yang ditugaskan kepadanya. Akses lintas wilayah ditolak.
5. **Immutable Financial Transactions**: Dokumen pada `/deposits` dan `/agent_settlements` tidak boleh dihapus oleh siapa pun (`allow delete: if false`), termasuk Admin. Setelah transaksi berstatus `verified` atau `rejected`, nominal, metode, identitas pemilik, dan statusnya terkunci permanen.
6. **Parent Contract Binding on Deposits**: Setiap pengajuan setoran/penarikan pada `/deposits` wajib memverifikasi eksistensi kontrak induk pada `/subscriptions/$(subscription_id)` serta konsistensi `member_id`, `agen_id`, dan `wilayah`, sekaligus menolak penarikan melebihi saldo `total_terkumpul`.
7. **Public Data Hygiene**: Koleksi `/agents` yang dapat dibaca publik tidak boleh menyimpan informasi internal perusahaan seperti persentase komisi (`komisi_persen`) atau routing internal (`korwil_id`).
8. **Admin Role Access**: Admin memperoleh akses ke seluruh data operasional, inventaris gudang, pesan kontak, pengaturan rekening/info (`app_settings`), dan audit log append-only.

## Skenario Uji Keamanan (Wajib PERMISSION_DENIED)
1. Pengguna tanpa login mencoba membaca `/users/{uid}`, `/subscriptions/{subId}`, `/deposits/{depId}`, `/app_settings/public`, atau `/door_prize_draws`.
2. Member A mencoba membaca (`get` / `list`) kontrak atau riwayat transaksi milik Member B.
3. Member mencoba mengubah saldo `total_terkumpul` atau `status` pada kontraknya sendiri melalui browser.
4. Member mencoba membuat `deposits` berstatus `verified` atau atas `subscription_id` milik Member B, atau mengajukan penarikan melebihi saldo.
5. Member mencoba self-escalation `role` menjadi `agen` / `admin`, atau menambahkan shadow field `isVerified: true`.
6. Agen A mencoba membaca, memverifikasi, atau menolak `deposits` maupun mengubah kontrak yang menjadi kewenangan Agen B.
7. Korwil `Ciamis` mencoba membaca atau mengubah data user, kontrak, `deposits`, atau `agent_settlements` di wilayah `Tasikmalaya`.
8. Korwil `Ciamis` mencoba mengubah `wilayah` di dokumen `/users/{uid}` miliknya sendiri menjadi `Tasikmalaya`.
9. Pengguna mana pun (Member, Agen, Korwil, maupun Admin) mencoba menghapus (`delete`) transaksi keuangan di `/deposits` atau `/agent_settlements`.
10. Pengguna atau Staff mencoba mengubah nominal/status `deposits` yang sudah berstatus `verified` atau `rejected`.
11. Pendaftar atau visitor mencoba melakukan `list` pada `/login_aliases` atau `/warehouse_inventory` atau `/contact_messages`.
12. Penyerang mengirimkan ID dokumen >128 karakter / karakter terlarang (`Resource Poisoning`) atau timestamp palsu (`createdAt != request.time`).
