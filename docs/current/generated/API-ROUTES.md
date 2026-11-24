# Generated HTTP route inventory

<!-- GENERATED FILE. Run `pnpm docs:generate`; do not hand-edit. -->

Source: `apps/web/src/app/**/route.ts`  
Input SHA-256: `9c9f286f8161cb5da5f0c0bc7586095422488c3fe13fccedf309fe7f4d33d265`

Exported operations: 56

| Method   | Path                                                         | Handler                                                                                  |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `GET`    | `/api/currencies`                                            | `apps/web/src/app/api/currencies/route.ts`                                               |
| `DELETE` | `/api/expenses/:id/reactions`                                | `apps/web/src/app/api/expenses/[id]/reactions/route.ts`                                  |
| `POST`   | `/api/expenses/:id/reactions`                                | `apps/web/src/app/api/expenses/[id]/reactions/route.ts`                                  |
| `POST`   | `/api/import`                                                | `apps/web/src/app/api/import/route.ts`                                                   |
| `DELETE` | `/api/install-handoff`                                       | `apps/web/src/app/api/install-handoff/route.ts`                                          |
| `POST`   | `/api/install-handoff`                                       | `apps/web/src/app/api/install-handoff/route.ts`                                          |
| `GET`    | `/api/lemon/nonce`                                           | `apps/web/src/app/api/lemon/nonce/route.ts`                                              |
| `POST`   | `/api/push/dismissed`                                        | `apps/web/src/app/api/push/dismissed/route.ts`                                           |
| `POST`   | `/api/push/opened`                                           | `apps/web/src/app/api/push/opened/route.ts`                                              |
| `GET`    | `/api/rate`                                                  | `apps/web/src/app/api/rate/route.ts`                                                     |
| `POST`   | `/api/rooms`                                                 | `apps/web/src/app/api/rooms/route.ts`                                                    |
| `GET`    | `/api/rooms/:slug`                                           | `apps/web/src/app/api/rooms/[slug]/route.ts`                                             |
| `PATCH`  | `/api/rooms/:slug`                                           | `apps/web/src/app/api/rooms/[slug]/route.ts`                                             |
| `POST`   | `/api/rooms/:slug/badges`                                    | `apps/web/src/app/api/rooms/[slug]/badges/route.ts`                                      |
| `GET`    | `/api/rooms/:slug/events`                                    | `apps/web/src/app/api/rooms/[slug]/events/route.ts`                                      |
| `POST`   | `/api/rooms/:slug/expenses`                                  | `apps/web/src/app/api/rooms/[slug]/expenses/route.ts`                                    |
| `DELETE` | `/api/rooms/:slug/expenses/:id`                              | `apps/web/src/app/api/rooms/[slug]/expenses/[id]/route.ts`                               |
| `PATCH`  | `/api/rooms/:slug/expenses/:id`                              | `apps/web/src/app/api/rooms/[slug]/expenses/[id]/route.ts`                               |
| `POST`   | `/api/rooms/:slug/expenses/:id/restore`                      | `apps/web/src/app/api/rooms/[slug]/expenses/[id]/restore/route.ts`                       |
| `POST`   | `/api/rooms/:slug/feedback`                                  | `apps/web/src/app/api/rooms/[slug]/feedback/route.ts`                                    |
| `GET`    | `/api/rooms/:slug/history`                                   | `apps/web/src/app/api/rooms/[slug]/history/route.ts`                                     |
| `GET`    | `/api/rooms/:slug/history/export`                            | `apps/web/src/app/api/rooms/[slug]/history/export/route.ts`                              |
| `POST`   | `/api/rooms/:slug/import`                                    | `apps/web/src/app/api/rooms/[slug]/import/route.ts`                                      |
| `POST`   | `/api/rooms/:slug/install-handoff`                           | `apps/web/src/app/api/rooms/[slug]/install-handoff/route.ts`                             |
| `GET`    | `/api/rooms/:slug/lemon-quote`                               | `apps/web/src/app/api/rooms/[slug]/lemon-quote/route.ts`                                 |
| `POST`   | `/api/rooms/:slug/members`                                   | `apps/web/src/app/api/rooms/[slug]/members/route.ts`                                     |
| `DELETE` | `/api/rooms/:slug/members/:memberId`                         | `apps/web/src/app/api/rooms/[slug]/members/[memberId]/route.ts`                          |
| `PATCH`  | `/api/rooms/:slug/members/:memberId`                         | `apps/web/src/app/api/rooms/[slug]/members/[memberId]/route.ts`                          |
| `POST`   | `/api/rooms/:slug/members/:memberId/claim`                   | `apps/web/src/app/api/rooms/[slug]/members/[memberId]/claim/route.ts`                    |
| `PATCH`  | `/api/rooms/:slug/members/:memberId/profile`                 | `apps/web/src/app/api/rooms/[slug]/members/[memberId]/profile/route.ts`                  |
| `POST`   | `/api/rooms/:slug/members/:memberId/reactivate`              | `apps/web/src/app/api/rooms/[slug]/members/[memberId]/reactivate/route.ts`               |
| `POST`   | `/api/rooms/:slug/members/:memberId/restore`                 | `apps/web/src/app/api/rooms/[slug]/members/[memberId]/restore/route.ts`                  |
| `POST`   | `/api/rooms/:slug/members/:memberId/wallet`                  | `apps/web/src/app/api/rooms/[slug]/members/[memberId]/wallet/route.ts`                   |
| `POST`   | `/api/rooms/:slug/pots`                                      | `apps/web/src/app/api/rooms/[slug]/pots/route.ts`                                        |
| `PATCH`  | `/api/rooms/:slug/pots/:potId`                               | `apps/web/src/app/api/rooms/[slug]/pots/[potId]/route.ts`                                |
| `POST`   | `/api/rooms/:slug/pots/:potId/contributions`                 | `apps/web/src/app/api/rooms/[slug]/pots/[potId]/contributions/route.ts`                  |
| `DELETE` | `/api/rooms/:slug/pots/:potId/contributions/:contributionId` | `apps/web/src/app/api/rooms/[slug]/pots/[potId]/contributions/[contributionId]/route.ts` |
| `POST`   | `/api/rooms/:slug/pots/:potId/expenses`                      | `apps/web/src/app/api/rooms/[slug]/pots/[potId]/expenses/route.ts`                       |
| `DELETE` | `/api/rooms/:slug/pots/:potId/expenses/:expenseId`           | `apps/web/src/app/api/rooms/[slug]/pots/[potId]/expenses/[expenseId]/route.ts`           |
| `DELETE` | `/api/rooms/:slug/push-subscriptions`                        | `apps/web/src/app/api/rooms/[slug]/push-subscriptions/route.ts`                          |
| `POST`   | `/api/rooms/:slug/push-subscriptions`                        | `apps/web/src/app/api/rooms/[slug]/push-subscriptions/route.ts`                          |
| `POST`   | `/api/rooms/:slug/push-subscriptions/status`                 | `apps/web/src/app/api/rooms/[slug]/push-subscriptions/status/route.ts`                   |
| `GET`    | `/api/rooms/:slug/receipt-parse`                             | `apps/web/src/app/api/rooms/[slug]/receipt-parse/route.ts`                               |
| `POST`   | `/api/rooms/:slug/receipt-parse`                             | `apps/web/src/app/api/rooms/[slug]/receipt-parse/route.ts`                               |
| `POST`   | `/api/rooms/:slug/recurring`                                 | `apps/web/src/app/api/rooms/[slug]/recurring/route.ts`                                   |
| `DELETE` | `/api/rooms/:slug/recurring/:recurringId`                    | `apps/web/src/app/api/rooms/[slug]/recurring/[recurringId]/route.ts`                     |
| `POST`   | `/api/rooms/:slug/settlements`                               | `apps/web/src/app/api/rooms/[slug]/settlements/route.ts`                                 |
| `DELETE` | `/api/rooms/:slug/settlements/:id`                           | `apps/web/src/app/api/rooms/[slug]/settlements/[id]/route.ts`                            |
| `POST`   | `/api/share-target`                                          | `apps/web/src/app/api/share-target/route.ts`                                             |
| `GET`    | `/healthcheck`                                               | `apps/web/src/app/healthcheck/route.ts`                                                  |
| `GET`    | `/manifest.webmanifest`                                      | `apps/web/src/app/manifest.webmanifest/route.ts`                                         |
| `GET`    | `/r/:slug/card/:kind`                                        | `apps/web/src/app/(product-shell)/r/[slug]/card/[kind]/route.ts`                         |
| `POST`   | `/r/:slug/card/:kind`                                        | `apps/web/src/app/(product-shell)/r/[slug]/card/[kind]/route.ts`                         |
| `GET`    | `/r/:slug/recap/card`                                        | `apps/web/src/app/(product-shell)/r/[slug]/recap/card/route.ts`                          |
| `GET`    | `/r/:slug/recap/story`                                       | `apps/web/src/app/(product-shell)/r/[slug]/recap/story/route.ts`                         |
| `GET`    | `/readiness`                                                 | `apps/web/src/app/readiness/route.ts`                                                    |

This inventory proves exported verbs and paths only. Read `../API.md` and the handler source for trust,
validation, status, rate-limit, idempotency, retention, and feature-gate semantics.
