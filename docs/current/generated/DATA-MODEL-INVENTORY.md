# Generated data-model inventory

<!-- GENERATED FILE. Run `pnpm docs:generate`; do not hand-edit. -->

Source: `apps/web/prisma/schema.prisma`  
Input SHA-256: `0700185af99adfad8995c9fd148a4b7e31bd6d6164024aadf7c34419e4a0c632`

PostgreSQL namespace: `split`  
Models: 22  
Split modes: `EQUAL`, `EXACT`, `PERCENTAGE`, `SHARES`

## Room

| Field                         | Prisma type          | Attributes                           |
| ----------------------------- | -------------------- | ------------------------------------ |
| `id`                          | `String`             | @id @default(uuid())                 |
| `slug`                        | `String`             | @unique                              |
| `name`                        | `String`             | —                                    |
| `emoji`                       | `String?`            | —                                    |
| `currency`                    | `String`             | // display/settle currency, ISO 4217 |
| `kind`                        | `String`             | @default("tribu")                    |
| `coverUrl`                    | `String?`            | —                                    |
| `theme`                       | `String?`            | —                                    |
| `locale`                      | `String?`            | —                                    |
| `firstSharedBalanceExpenseId` | `String?`            | —                                    |
| `createdAt`                   | `DateTime`           | @default(now())                      |
| `members`                     | `Member[]`           | —                                    |
| `expenses`                    | `Expense[]`          | —                                    |
| `recurringExpenses`           | `RecurringExpense[]` | —                                    |
| `pots`                        | `Pot[]`              | —                                    |
| `reminders`                   | `Reminder[]`         | —                                    |
| `budgets`                     | `Budget[]`           | —                                    |
| `settlements`                 | `Settlement[]`       | —                                    |
| `auditEvents`                 | `RoomAuditEvent[]`   | —                                    |
| `ledgerEntries`               | `LedgerEntry[]`      | —                                    |
| `importBatches`               | `ImportBatch[]`      | —                                    |
| `feedbackReports`             | `FeedbackReport[]`   | —                                    |
| `installHandoffs`             | `InstallHandoff[]`   | —                                    |
| `pushSubscriptions`           | `PushSubscription[]` | —                                    |
| `notificationSends`           | `NotificationSend[]` | —                                    |

## Budget

| Field         | Prisma type | Attributes                                                       |
| ------------- | ----------- | ---------------------------------------------------------------- |
| `id`          | `String`    | @id @default(uuid())                                             |
| `roomId`      | `String`    | —                                                                |
| `category`    | `String`    | —                                                                |
| `amountMinor` | `BigInt`    | // per calendar month, room currency                             |
| `createdAt`   | `DateTime`  | @default(now())                                                  |
| `updatedAt`   | `DateTime`  | @updatedAt                                                       |
| `room`        | `Room`      | @relation(fields: [roomId], references: [id], onDelete: Cascade) |

## Reminder

| Field       | Prisma type | Attributes                                                       |
| ----------- | ----------- | ---------------------------------------------------------------- |
| `id`        | `String`    | @id @default(uuid())                                             |
| `roomId`    | `String`    | —                                                                |
| `fromId`    | `String`    | —                                                                |
| `toId`      | `String`    | —                                                                |
| `createdAt` | `DateTime`  | @default(now())                                                  |
| `seenAt`    | `DateTime?` | —                                                                |
| `room`      | `Room`      | @relation(fields: [roomId], references: [id], onDelete: Cascade) |

## FeedbackReport

| Field                  | Prisma type | Attributes                                                       |
| ---------------------- | ----------- | ---------------------------------------------------------------- |
| `id`                   | `String`    | @id @default(uuid())                                             |
| `roomId`               | `String`    | —                                                                |
| `message`              | `String`    | —                                                                |
| `diagnostics`          | `Json?`     | —                                                                |
| `roomSnapshot`         | `Json?`     | —                                                                |
| `screenshot`           | `Bytes?`    | —                                                                |
| `screenshotMimeType`   | `String?`   | —                                                                |
| `screenshotByteLength` | `Int?`      | —                                                                |
| `screenshotWidth`      | `Int?`      | —                                                                |
| `screenshotHeight`     | `Int?`      | —                                                                |
| `createdAt`            | `DateTime`  | @default(now())                                                  |
| `room`                 | `Room`      | @relation(fields: [roomId], references: [id], onDelete: Cascade) |

## RoomAuditEvent

| Field             | Prisma type | Attributes                                                         |
| ----------------- | ----------- | ------------------------------------------------------------------ |
| `id`              | `BigInt`    | @id @default(autoincrement())                                      |
| `roomId`          | `String`    | —                                                                  |
| `action`          | `String`    | —                                                                  |
| `subjectType`     | `String?`   | —                                                                  |
| `subjectId`       | `String?`   | —                                                                  |
| `actorDeviceHash` | `String?`   | // SHA-256(roomId + device cookie); the raw cookie is never stored |
| `deviceOrdinal`   | `Int?`      | // first device seen in this room is 1 ("Device A")                |
| `actorMemberId`   | `String?`   | —                                                                  |
| `actorMemberName` | `String?`   | // immutable display snapshot                                      |
| `before`          | `Json?`     | —                                                                  |
| `after`           | `Json?`     | —                                                                  |
| `detail`          | `Json?`     | —                                                                  |
| `createdAt`       | `DateTime`  | @default(now())                                                    |
| `room`            | `Room`      | @relation(fields: [roomId], references: [id], onDelete: Restrict)  |

## Member

| Field                | Prisma type          | Attributes                                                                         |
| -------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `id`                 | `String`             | @id @default(uuid())                                                               |
| `roomId`             | `String`             | —                                                                                  |
| `name`               | `String`             | —                                                                                  |
| `token`              | `String`             | @unique // stable server-issued secret, returned when a device selects this member |
| `avatar`             | `String?`            | —                                                                                  |
| `avatarPalette`      | `String?`            | —                                                                                  |
| `userId`             | `String?`            | // the Tribu account that holds this member, set by account sync                   |
| `walletAddress`      | `String?`            | —                                                                                  |
| `lemonTag`           | `String?`            | —                                                                                  |
| `walletLinkedAt`     | `DateTime?`          | —                                                                                  |
| `payoutToken`        | `String?`            | // USDT \| USDC                                                                    |
| `payoutNetwork`      | `String?`            | // key from lib/payout.ts                                                          |
| `payoutAddress`      | `String?`            | —                                                                                  |
| `payoutBank`         | `String?`            | —                                                                                  |
| `payoutLemonTag`     | `String?`            | —                                                                                  |
| `honoredGuest`       | `Boolean`            | @default(false)                                                                    |
| `provisional`        | `Boolean`            | @default(false)                                                                    |
| `createdAt`          | `DateTime`           | @default(now())                                                                    |
| `removedAt`          | `DateTime?`          | // non-null = Former for future activity; ledger identity remains durable          |
| `room`               | `Room`               | @relation(fields: [roomId], references: [id], onDelete: Cascade)                   |
| `user`               | `User?`              | @relation(fields: [userId], references: [id], onDelete: SetNull)                   |
| `paidExpenses`       | `Expense[]`          | @relation("ExpensePaidBy")                                                         |
| `createdExpenses`    | `Expense[]`          | @relation("ExpenseCreatedBy")                                                      |
| `shares`             | `ExpenseShare[]`     | —                                                                                  |
| `reactions`          | `ExpenseReaction[]`  | —                                                                                  |
| `settlementsFrom`    | `Settlement[]`       | @relation("SettlementFrom")                                                        |
| `settlementsTo`      | `Settlement[]`       | @relation("SettlementTo")                                                          |
| `createdSettlements` | `Settlement[]`       | @relation("SettlementCreatedBy")                                                   |
| `pushSubscriptions`  | `PushSubscription[]` | —                                                                                  |
| `installHandoffs`    | `InstallHandoff[]`   | —                                                                                  |

## InstallHandoff

| Field             | Prisma type | Attributes                                                         |
| ----------------- | ----------- | ------------------------------------------------------------------ |
| `tokenHash`       | `String`    | @id @db.Char(64)                                                   |
| `roomId`          | `String`    | —                                                                  |
| `memberId`        | `String?`   | —                                                                  |
| `memberTokenHash` | `String?`   | @db.Char(64)                                                       |
| `createdAt`       | `DateTime`  | @default(now())                                                    |
| `expiresAt`       | `DateTime`  | —                                                                  |
| `room`            | `Room`      | @relation(fields: [roomId], references: [id], onDelete: Cascade)   |
| `member`          | `Member?`   | @relation(fields: [memberId], references: [id], onDelete: SetNull) |

## Expense

| Field             | Prisma type         | Attributes                                                                                |
| ----------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `id`              | `String`            | @id @default(uuid())                                                                      |
| `roomId`          | `String`            | —                                                                                         |
| `description`     | `String`            | —                                                                                         |
| `amountMinor`     | `BigInt`            | // in `currency`                                                                          |
| `currency`        | `String`            | // may differ from the room currency                                                      |
| `baseAmountMinor` | `BigInt`            | —                                                                                         |
| `fxRate`          | `Decimal`           | @db.Decimal(24, 12)                                                                       |
| `paidById`        | `String`            | —                                                                                         |
| `createdById`     | `String?`           | // attribution from X-Member-Token — never authorization                                  |
| `splitMode`       | `SplitMode`         | —                                                                                         |
| `date`            | `DateTime`          | @default(now())                                                                           |
| `category`        | `String?`           | —                                                                                         |
| `createdAt`       | `DateTime`          | @default(now())                                                                           |
| `deletedAt`       | `DateTime?`         | // soft delete → 6s Undo                                                                  |
| `recurringId`     | `String?`           | —                                                                                         |
| `potId`           | `String?`           | —                                                                                         |
| `importBatchId`   | `String?`           | —                                                                                         |
| `importRowIndex`  | `Int?`              | —                                                                                         |
| `room`            | `Room`              | @relation(fields: [roomId], references: [id], onDelete: Cascade)                          |
| `importBatch`     | `ImportBatch?`      | @relation(fields: [importBatchId], references: [id], onDelete: Restrict)                  |
| `paidBy`          | `Member`            | @relation("ExpensePaidBy", fields: [paidById], references: [id], onDelete: Cascade)       |
| `createdBy`       | `Member?`           | @relation("ExpenseCreatedBy", fields: [createdById], references: [id], onDelete: SetNull) |
| `shares`          | `ExpenseShare[]`    | —                                                                                         |
| `reactions`       | `ExpenseReaction[]` | —                                                                                         |

## ImportBatch

| Field               | Prisma type | Attributes                                                       |
| ------------------- | ----------- | ---------------------------------------------------------------- |
| `id`                | `String`    | @id @default(uuid())                                             |
| `roomId`            | `String`    | —                                                                |
| `fingerprint`       | `String`    | —                                                                |
| `sourceFingerprint` | `String?`   | —                                                                |
| `importedAt`        | `DateTime`  | @db.Timestamp(3)                                                 |
| `expenseCount`      | `Int`       | —                                                                |
| `addedMemberCount`  | `Int`       | —                                                                |
| `room`              | `Room`      | @relation(fields: [roomId], references: [id], onDelete: Cascade) |
| `expenses`          | `Expense[]` | —                                                                |

## ExpenseReaction

| Field       | Prisma type | Attributes                                                          |
| ----------- | ----------- | ------------------------------------------------------------------- |
| `id`        | `String`    | @id @default(uuid())                                                |
| `expenseId` | `String`    | —                                                                   |
| `memberId`  | `String`    | —                                                                   |
| `emoji`     | `String`    | —                                                                   |
| `createdAt` | `DateTime`  | @default(now())                                                     |
| `expense`   | `Expense`   | @relation(fields: [expenseId], references: [id], onDelete: Cascade) |
| `member`    | `Member`    | @relation(fields: [memberId], references: [id], onDelete: Cascade)  |

## ExpenseShare

| Field                | Prisma type | Attributes                                                          |
| -------------------- | ----------- | ------------------------------------------------------------------- |
| `id`                 | `String`    | @id @default(uuid())                                                |
| `expenseId`          | `String`    | —                                                                   |
| `memberId`           | `String`    | —                                                                   |
| `amountMinor`        | `BigInt`    | // ALWAYS in room currency (post-FX)                                |
| `enteredAmountMinor` | `BigInt?`   | // EXACT mode: verbatim in expense currency — no-drift re-save      |
| `splitWeight`        | `BigInt?`   | // PERCENTAGE: basis points; SHARES: relative integer weight        |
| `expense`            | `Expense`   | @relation(fields: [expenseId], references: [id], onDelete: Cascade) |
| `member`             | `Member`    | @relation(fields: [memberId], references: [id], onDelete: Cascade)  |

## Settlement

| Field         | Prisma type | Attributes                                                                                   |
| ------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `id`          | `String`    | @id @default(uuid())                                                                         |
| `roomId`      | `String`    | —                                                                                            |
| `fromId`      | `String`    | —                                                                                            |
| `toId`        | `String`    | —                                                                                            |
| `createdById` | `String?`   | // attribution only                                                                          |
| `amountMinor` | `BigInt`    | // room currency                                                                             |
| `method`      | `String?`   | // "cash" \| "bank" \| "peanut" \| null                                                      |
| `note`        | `String?`   | —                                                                                            |
| `receiptUrl`  | `String?`   | // pasted documentation only; never fetched or verified                                      |
| `txHash`      | `String?`   | @unique                                                                                      |
| `chainId`     | `Int?`      | —                                                                                            |
| `token`       | `String?`   | // "USDC" \| "USDT"                                                                          |
| `tokenAmount` | `String?`   | // token base units, decimal string                                                          |
| `network`     | `String?`   | —                                                                                            |
| `createdAt`   | `DateTime`  | @default(now())                                                                              |
| `deletedAt`   | `DateTime?` | —                                                                                            |
| `room`        | `Room`      | @relation(fields: [roomId], references: [id], onDelete: Cascade)                             |
| `from`        | `Member`    | @relation("SettlementFrom", fields: [fromId], references: [id], onDelete: Cascade)           |
| `to`          | `Member`    | @relation("SettlementTo", fields: [toId], references: [id], onDelete: Cascade)               |
| `createdBy`   | `Member?`   | @relation("SettlementCreatedBy", fields: [createdById], references: [id], onDelete: SetNull) |

## FxRate

| Field       | Prisma type | Attributes                                                   |
| ----------- | ----------- | ------------------------------------------------------------ |
| `id`        | `String`    | @id @default(uuid())                                         |
| `base`      | `String`    | —                                                            |
| `quote`     | `String`    | —                                                            |
| `rate`      | `Decimal`   | @db.Decimal(24, 12) // units of `base` per 1 unit of `quote` |
| `fetchedAt` | `DateTime`  | @default(now())                                              |

## PushSubscription

| Field        | Prisma type | Attributes                                                         |
| ------------ | ----------- | ------------------------------------------------------------------ |
| `id`         | `String`    | @id @default(uuid())                                               |
| `roomId`     | `String`    | —                                                                  |
| `memberId`   | `String`    | —                                                                  |
| `endpoint`   | `String`    | // push-service URL; the host is allowlisted at write time         |
| `p256dh`     | `String`    | —                                                                  |
| `auth`       | `String`    | —                                                                  |
| `userAgent`  | `String?`   | —                                                                  |
| `createdAt`  | `DateTime`  | @default(now())                                                    |
| `lastSeenAt` | `DateTime`  | @default(now())                                                    |
| `room`       | `Room`      | @relation(fields: [roomId], references: [id], onDelete: Cascade)   |
| `member`     | `Member`    | @relation(fields: [memberId], references: [id], onDelete: Cascade) |

## NotificationSend

| Field            | Prisma type | Attributes                                                       |
| ---------------- | ----------- | ---------------------------------------------------------------- |
| `id`             | `String`    | @id @default(uuid())                                             |
| `roomId`         | `String`    | —                                                                |
| `template`       | `String`    | —                                                                |
| `dayKey`         | `String`    | // UTC yyyy-mm-dd                                                |
| `dedupeKey`      | `String`    | @unique                                                          |
| `status`         | `String`    | // claimed \| sent \| failed                                     |
| `errorCode`      | `String?`   | —                                                                |
| `openedCount`    | `Int`       | @default(0)                                                      |
| `dismissedCount` | `Int`       | @default(0)                                                      |
| `createdAt`      | `DateTime`  | @default(now())                                                  |
| `room`           | `Room`      | @relation(fields: [roomId], references: [id], onDelete: Cascade) |

## User

| Field        | Prisma type     | Attributes           |
| ------------ | --------------- | -------------------- |
| `id`         | `String`        | @id @default(uuid()) |
| `createdAt`  | `DateTime`      | @default(now())      |
| `email`      | `String?`       | —                    |
| `lastSeenAt` | `DateTime?`     | —                    |
| `accounts`   | `AuthAccount[]` | —                    |
| `members`    | `Member[]`      | —                    |

## AuthAccount

| Field        | Prisma type | Attributes                                                       |
| ------------ | ----------- | ---------------------------------------------------------------- |
| `id`         | `String`    | @id @default(uuid())                                             |
| `userId`     | `String`    | —                                                                |
| `provider`   | `String`    | —                                                                |
| `providerId` | `String`    | —                                                                |
| `createdAt`  | `DateTime`  | @default(now())                                                  |
| `user`       | `User`      | @relation(fields: [userId], references: [id], onDelete: Cascade) |

## RecurringExpense

| Field         | Prisma type | Attributes                                                       |
| ------------- | ----------- | ---------------------------------------------------------------- |
| `id`          | `String`    | @id @default(uuid())                                             |
| `roomId`      | `String`    | —                                                                |
| `description` | `String`    | —                                                                |
| `body`        | `Json`      | —                                                                |
| `dayOfMonth`  | `Int`       | // 1–31; a shorter month uses its last day                       |
| `nextMonth`   | `String`    | // YYYY-MM of the next month to create                           |
| `stoppedAt`   | `DateTime?` | —                                                                |
| `createdAt`   | `DateTime`  | @default(now())                                                  |
| `room`        | `Room`      | @relation(fields: [roomId], references: [id], onDelete: Cascade) |

## Pot

| Field           | Prisma type         | Attributes                                                                        |
| --------------- | ------------------- | --------------------------------------------------------------------------------- |
| `id`            | `String`            | @id @default(uuid())                                                              |
| `roomId`        | `String`            | —                                                                                 |
| `name`          | `String`            | —                                                                                 |
| `keeperId`      | `String`            | —                                                                                 |
| `targetMinor`   | `BigInt?`           | // room currency                                                                  |
| `quotaMinor`    | `BigInt?`           | // per person per month, room currency                                            |
| `dueDate`       | `DateTime?`         | —                                                                                 |
| `yieldAprBps`   | `Int?`              | // estimated yearly rate the keeper's account pays, in basis points; display only |
| `createdAt`     | `DateTime`          | @default(now())                                                                   |
| `closedAt`      | `DateTime?`         | —                                                                                 |
| `room`          | `Room`              | @relation(fields: [roomId], references: [id], onDelete: Cascade)                  |
| `contributions` | `PotContribution[]` | —                                                                                 |

## PotContribution

| Field          | Prisma type | Attributes                                                      |
| -------------- | ----------- | --------------------------------------------------------------- |
| `id`           | `String`    | @id @default(uuid())                                            |
| `potId`        | `String`    | —                                                               |
| `memberId`     | `String`    | —                                                               |
| `amountMinor`  | `BigInt`    | // room currency                                                |
| `settlementId` | `String?`   | @unique                                                         |
| `reason`       | `String?`   | // null (a plain contribution) \| "roundup"                     |
| `createdById`  | `String?`   | —                                                               |
| `createdAt`    | `DateTime`  | @default(now())                                                 |
| `deletedAt`    | `DateTime?` | —                                                               |
| `pot`          | `Pot`       | @relation(fields: [potId], references: [id], onDelete: Cascade) |

## LedgerEntry

| Field         | Prisma type       | Attributes                                                                                                  |
| ------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`          | `BigInt`          | @id @default(autoincrement())                                                                               |
| `roomId`      | `String`          | —                                                                                                           |
| `sourceType`  | `String`          | // expense \| settlement \| pot_contribution                                                                |
| `sourceId`    | `String`          | —                                                                                                           |
| `kind`        | `String`          | // record \| reversal                                                                                       |
| `reversesId`  | `BigInt?`         | @unique // the record a reversal cancels                                                                    |
| `currency`    | `String`          | // room currency; every posting amount is in it                                                             |
| `description` | `String?`         | // snapshot at write time                                                                                   |
| `detail`      | `Json?`           | // snapshot at write time: original amount and currency, method, pot                                        |
| `occurredAt`  | `DateTime`        | // when the money moved: the expense date or when the payment was recorded                                  |
| `createdAt`   | `DateTime`        | @default(now())                                                                                             |
| `room`        | `Room`            | @relation(fields: [roomId], references: [id], onDelete: Restrict)                                           |
| `reverses`    | `LedgerEntry?`    | @relation("LedgerReversal", fields: [reversesId], references: [id], onDelete: Restrict, onUpdate: Restrict) |
| `reversedBy`  | `LedgerEntry?`    | @relation("LedgerReversal")                                                                                 |
| `postings`    | `LedgerPosting[]` | —                                                                                                           |

## LedgerPosting

| Field         | Prisma type   | Attributes                                                         |
| ------------- | ------------- | ------------------------------------------------------------------ |
| `id`          | `BigInt`      | @id @default(autoincrement())                                      |
| `entryId`     | `BigInt`      | —                                                                  |
| `roomId`      | `String`      | —                                                                  |
| `accountType` | `String`      | // member \| pot \| keeper                                         |
| `accountId`   | `String`      | —                                                                  |
| `amountMinor` | `BigInt`      | —                                                                  |
| `entry`       | `LedgerEntry` | @relation(fields: [entryId], references: [id], onDelete: Restrict) |
