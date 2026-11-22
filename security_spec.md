# Security Specification — Sagitarius Parcel PWA

## Data Invariants
1. **User Role Integrity**: Only `akun310786@gmail.com` (verified via Google Auth `email_verified == true`) or existing admins may assign `agen`, `korwil`, or `admin` roles. New user registrations (via Google Auth or WhatsApp/Username/Email+Password) may only create `role: "member"`.
2. **Login Alias Isolation**: `/login_aliases/{aliasId}` maps normalized WhatsApp numbers (`wa_62...`) or usernames (`u_...`) strictly for single-document `get` lookup prior to `signInWithEmailAndPassword`. Collection `list` queries on `login_aliases` are strictly denied (`allow list: if false`) to prevent enumeration/scraping.
3. **Contract Ownership & Initial State**: A `subscription` can only be created with `total_terkumpul == 0` and `status == "aktif"`, either by the authenticated `member_id`, by the assigned Agen/Korwil (for offline-assisted walk-in members), or by Admin. A member may only cancel/delete their own contract when `total_terkumpul == 0` and `status == "aktif"`.
4. **Deposit & Withdrawal Binding**: A transaction in `deposits` (`jenis_transaksi` in `setoran`, `penarikan`) must reference an existing `subscription_id`. Members may only submit `status_verifikasi: "pending"` (either `metode: "transfer"` for `setoran` or `metode in ["pencairan_tunai", "transfer_keluar"]` for `penarikan`). Only the assigned Agen, Korwil, or Admin may verify/validate (`validated_by`) transactions or record direct `verified` cash deposits/withdrawals.
5. **Terminal State Lock**: Once a subscription reaches `status == "diambil"`, non-admins cannot mutate its balance or status.
6. **PII Isolation**: User profiles (`users/{userId}`) containing personal WhatsApp/email are readable only by the owner, assigned Agen, Korwil, or Admin. Public agent listings live in `agents/{agentId}`.
7. **Contact Message Privacy**: Public visitors may create `/contact_messages/{messageId}` strictly with `status == "baru"` and server timestamps; reading, marking as `"dibalas"`, or deleting messages is strictly restricted to Admin.
8. **Official Settings Integrity**: `/app_settings/public` stores official company bank transfer info and broadcast announcements, readable publicly (`get` on `public` doc ID) and writable strictly by Admin.
9. **Door Prize Transparency & Control**: `/door_prize_draws/{drawId}` may only be created, updated, or deleted by Admin referencing an existing `subscription_id`.
10. **Agent Settlements & Commission Claims**: `/agent_settlements/{settlementId}` may only be created by the authenticated `agen_id` (or Korwil/Admin) in `status == "pending"`, and only Admin may validate (`verified` / `rejected`).
11. **Warehouse Inventory & HPP Isolation**: `/warehouse_inventory/{itemId}` holds internal unit purchase costs and warehouse stock counts, readable and writable strictly by Admin.
12. **Official Product Substitutions**: `/product_substitutions/{subId}` publishes brochure-compliant equivalent-value item replacements (`allow list: if true`), modifiable strictly by Admin.
13. **Immutable Audit Logs**: `/audit_logs/{logId}` is append-only (`create` strictly by Admin with `actor_uid == request.auth.uid`), with `update` and `delete` strictly denied.

## Dirty Dozen Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated `create` on `/users/attacker`
2. Self-escalation `create` on `/users/{uid}` with `role: "admin"` by non-admin user
3. Self-escalation `update` on `/users/{uid}` modifying `role` from `"member"` to `"agen"`
4. Shadow update on `/users/{uid}` adding ghost field `isVerified: true`
5. Spoofed `createdAt` timestamp not equal to `request.time`
6. Spoofed `akun310786@gmail.com` with `email_verified == false` attempting admin write
7. Enumeration `list` query on `/login_aliases` to scrape member phone/username aliases
8. Creating `/login_aliases/{aliasId}` with `uid` belonging to another user
9. Creating `/subscriptions/{subId}` with `total_terkumpul: 1000000` or `status: "lunas"`
10. Reading another user's `/subscriptions/{subId}` as an unrelated member
11. Member creating `/deposits/{depId}` with `metode: "tunai_agen"` and `status_verifikasi: "verified"`
12. Poisoned 1.5KB document ID on `/subscriptions/{1500_char_id}`
