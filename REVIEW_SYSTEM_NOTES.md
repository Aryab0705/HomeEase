# Review & Rating System — Implementation Notes

## What the flow looks like now

A customer opens a completed booking, clicks **Write a Review**, and gets five
empty star rows (Overall Rating, Work Quality, Punctuality, Professionalism,
Value for Money). Submit stays disabled until all five are set and the comment
is at least 10 characters. On success the modal closes, a toast fires, the page
state refreshes in place, and the provider's public average updates for everyone
without a reload.

Request path:

```
BookingDetail modal
  → POST /api/reviews
  → protect → authorize("customer") → uploadMultiple
  → normalizeReviewPayload → reviewRules → validate
  → createReview
  → Review document + recalcProviderRating aggregation
  → Socket.IO: review:created + provider:ratingUpdated
```

## Root causes that were fixed

**Submission always failed.** The modal sent flat `{quality, punctuality, ...}`
while the validators required nested `ratings.quality` / `ratings.timeliness` /
`ratings.communication`. `ratings` was therefore `undefined` and `validate`
returned 422 before the controller ever ran. Fixed by adding
`normalizeReviewPayload` (which accepts flat or nested bodies and strips any
client-supplied identity fields), rewriting the validators, and aligning the
schema on the spec's category names.

**All five stars rendered filled.** The modal initialised state to
`{overallRating: 5, quality: 5, ...}` and `StarRating` filled via
`i < Math.round(rating)`. Ratings now start at `0` and `StarRating` was rewritten
with a proper hover preview, keyboard support, and a committed-value path.

**Reviews were invisible.** There was no reviews UI on the public provider
profile at all, `recalcProviderRating` returned early when a provider had zero
reviews, and a `pre("save")` hook overwrote the customer's chosen overall score.
Added `ProviderReviewsSection` (average, count, star distribution, category
averages, paginated review cards), fixed the aggregation, removed the hook, and
made `/providers/:id` a public route so signed-out visitors see the same
reputation.

## Security invariants

Enforced in `createReview`, independently of anything the frontend does:

- `customerId` comes from `req.user._id`; a `customerId` in the body is stripped.
- `providerId` comes from the booking, never the body.
- The booking must belong to the authenticated customer (403 otherwise).
- The booking must be `completed` (400 otherwise).
- Duplicates are rejected twice — an explicit `Review.exists` check (409) and a
  `unique: true` index on `bookingId` that maps E11000 → 409.
- Public review payloads populate only `"name avatar"`. Email, phone, and
  address are never exposed.

Provider averages are computed by a `Review.aggregate` pipeline over real
documents. No rating value from the frontend is ever trusted for aggregates.

## Backward compatibility

Legacy documents are supported without a migration. `quality` → `workQuality`,
`timeliness` → `punctuality`, `communication` → `valueForMoney`, and a top-level
`rating` → `overallRating`. These are mapped three ways: a `post("init")` hook
for hydrated documents, `$ifNull` coalescing in every aggregation, and an
explicit `legacy` fallback in the React components.

The React fallback is load-bearing: the read endpoints use `.lean()`, which skips
document hydration, so the `post("init")` hook does **not** run for them. Without
the fallback, old reviews render as 0 stars.

## Testing

```bash
cd server
npm run test:reviews
```

`scripts/test/reviewSystem.e2e.js` runs the full 21-step flow against a real
MongoDB: it creates a customer, a provider, and a completed booking; submits a
review; asserts the document exists; checks visibility for the submitting
customer, the provider, and an unrelated third customer; verifies the provider
average and review count moved; asserts the duplicate submission is rejected;
and confirms the socket payloads carry the full rating aggregate and leak no
private customer fields. It cleans up everything it created.

It has not been executed yet — the sandboxed Linux environment would not start,
so it was written and reviewed but never run.

## Outstanding: global `sanitizeFilter`

`server/src/config/db.js` sets `mongoose.set("sanitizeFilter", true)`. This
rewrites **any query filter value containing `$`-prefixed keys** into
`{$eq: <that object>}`, which matches nothing or throws a `CastError` → HTTP 500,
unless the object is wrapped in `mongoose.trusted(...)`.

This is pre-existing and unrelated to reviews, but it breaks real endpoints:

| File | What breaks |
|---|---|
| `adminController.js` | provider search (`$or` + `$regex`, `$in`), admin bookings date range + `$or`, admins list `role: {$in}` |
| `userController.js` | user list filters |
| `bookingController.js` | date-range filter |
| `quoteController.js` | status filter |

Two details make it easy to miss. `.aggregate()` pipelines are exempt, and so is
`countDocuments()` — in Mongoose 9.7.2 it calls `this.cast()` directly and never
routes through `_castConditions`, the only caller of `sanitizeFilter`. So a
paginated endpoint reports a correct total next to an empty list.

The review system itself is unaffected: its query filters use no `$` operators,
and the two places that needed one (`getAdminReviews`, and the E2E cleanup)
are wrapped in `mongoose.trusted()`.

Fixing the rest is a judgment call, because filters like
`{$regex: req.query.search}` mix server structure with raw user input — those
want input escaping, not a blanket trust marker. Worth doing deliberately rather
than mechanically.
