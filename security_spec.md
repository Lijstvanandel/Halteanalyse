# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Global Default-Deny**: Every path not explicitly matched is denied (`allow read, write: if false;`).
2. **Verified Identity**: Only authenticated users with `request.auth != null && request.auth.token.email_verified == true` can read or write `/punctualityLogs/{logId}`.
3. **Ownership & Isolation**: A `PunctualityLogEntry` document's `ownerId` must equal `request.auth.uid` on creation, cannot be mutated during updates (`incoming().ownerId == existing().ownerId`), and `get`/`list`/`delete` operations are restricted to documents where `resource.data.ownerId == request.auth.uid`.
4. **Path & Key Hardening**: Document ID `{logId}` must match `^[a-zA-Z0-9_\-]+$` (1..128 chars) and equal `incoming().id`. No shadow fields are permitted (`hasAll` + `hasOnly`).
5. **Temporal Integrity**: `createdAt` must equal `request.time` on creation and remain immutable on update (`incoming().createdAt == existing().createdAt`). `updatedAt` must equal `request.time` on both creation and update.
6. **Bounded Values**: `status` must be in `['ontime', 'delayed', 'early', 'cancelled']`, `delayMinutes` in `[-120, 600]`, `isoWeek` in `[1, 53]`, and all strings strictly bounded by their blueprint `maxLength`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: Creating `/punctualityLogs/log_1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: Creating `/punctualityLogs/log_1` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: Setting `ownerId: "victim_uid"` while authenticated as `"attacker_uid"` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create**: Including an extra field `isAdmin: true` -> `PERMISSION_DENIED`.
5. **ID Poisoning**: Creating `/punctualityLogs/bad$id!` or mismatched `data.id != logId` -> `PERMISSION_DENIED`.
6. **Denial-of-Wallet String Overflow**: Sending a 5,000-character `stopName` (exceeds maxLength 120) -> `PERMISSION_DENIED`.
7. **Invalid Enum State**: Setting `status: "hacked"` -> `PERMISSION_DENIED`.
8. **Client-Forged Timestamp on Create**: Setting `createdAt` to a past timestamp instead of `request.time` -> `PERMISSION_DENIED`.
9. **Ownership Hijack on Update**: Modifying `ownerId` or `createdAt` during an update -> `PERMISSION_DENIED`.
10. **Unauthorized Field Mutation on Update**: Attempting to mutate immutable `stopId` or `line` during an update -> `PERMISSION_DENIED`.
11. **Cross-Tenant Read (`get`)**: Authenticated user reading a log where `resource.data.ownerId != request.auth.uid` -> `PERMISSION_DENIED`.
12. **Unscoped List Scraping (`list`)**: Listing `/punctualityLogs` without filtering `where('ownerId', '==', request.auth.uid)` -> `PERMISSION_DENIED`.
