# Payment Provider Research — Slice 5.7

> **Status:** Dated, non-authoritative working input for roadmap Slice 5.7.
> Researched 2026-09-10 from vendor documentation and terms. Pricing,
> features, and policies must be rechecked before implementation. The roadmap
> remains authoritative, and Slice 5.7 remains unclaimed behind the Phase 1.1
> trust gate.

## Recommendation

Use **Creem as the preferred sandbox candidate, conditional on a short vendor
and architecture validation**. Do not select it for production yet.

Creem is the closer functional fit for a one-time desktop product because it
can generate license keys after purchase, expose them in the receipt and
customer portal, enforce activation limits, and activate, validate, and
deactivate installations. Paddle Billing supports one-time digital-product
checkout and fulfillment webhooks, but explicitly leaves license generation
and product fulfillment to the seller.

The condition matters. Creem's documented license endpoints require a merchant
API key, while the same documentation correctly says never to expose that key
client-side. SagaSpine therefore still needs a minimal entitlement
service or a client-safe, vendor-supported alternative. Creem also has a
shorter public operating history, separate payout fees, and several details
that require written clarification. If Creem cannot close the validation gates
below, use Paddle for checkout and build or buy the licensing layer separately.

Do not choose on headline transaction fees alone.

## Product Requirements

The v1 integration must support:

- a one-time **$59–79** desktop-app purchase;
- a full-featured, card-free 14–30 day trial;
- external hosted checkout from the landing page and desktop app;
- a customer portal or equivalent purchase-history surface;
- emailed and recoverable license credentials;
- activation on macOS and Windows without embedding a merchant secret;
- an offline-tolerant entitlement with clear clock and network behavior;
- device transfer/deactivation and restore-purchase flows;
- full and partial refunds plus chargeback/revocation events;
- test/sandbox mode and signed, replay-safe webhooks;
- no SagaSpine account service; and
- no payment, license, or device operation that can expose manuscripts,
  project data, AI-provider keys, canon, mechanics, or state.

The trial should be owned by the app, not modeled as a recurring subscription.
Both vendors support one-time products, while their hosted trial features are
subscription-oriented. Requiring a payment method for a product that is sold
as a one-time purchase would create unnecessary cancellation and trust costs.

## Comparison

| Dimension | Paddle Billing | Creem | Assessment for v1 |
|---|---|---|---|
| Merchant of record | Payments, indirect tax, invoicing, fraud, and compliance; advertises 200+ markets | Payments, indirect tax, invoicing, fraud, and compliance; purchases broadly supported and merchants supported in 86 countries | Both cover the core MoR need; Paddle's geographic documentation is clearer |
| One-time purchase | Native non-recurring price and `transaction.completed` fulfillment webhook | Native one-time product and hosted checkout session | Both fit |
| Checkout | Overlay and inline web checkout; Paddle-hosted checkout is documented for Mac/iOS apps | Hosted checkout URL with success redirect and signed result parameters | Use the system browser/landing page for either provider; do not embed checkout in Electron |
| Customer portal | Hosted portal with transaction history, invoices, and completed-transaction details | Hosted magic-link portal; license documentation says purchased keys appear there | Both can support purchase recovery; verify Creem's one-time portal UX in sandbox |
| License lifecycle | Paddle Billing does not provide product fulfillment; seller handles license delivery and validation after webhooks | Built-in key generation, activation limits, activation, validation, deactivation, expiry, and portal/receipt delivery | Creem has the substantial feature advantage |
| Safe desktop validation | Requires a separate licensing design | License endpoints require a secret merchant API key and therefore cannot be called directly by Electron | Both require a secure boundary unless Creem documents a client-safe method |
| Offline tolerance | Not provided by checkout; seller's licensing layer must implement it | Documentation recommends a locally implemented offline grace period and cached validation | Neither provides the required policy out of the box |
| Webhooks | Signed event system and simulator; one-time fulfillment uses `transaction.completed` | Signed events, sandbox, manual resend, five documented delivery attempts, and an idempotency warning | Both are adequate on paper; handler must verify, dedupe, and tolerate reordering |
| Refunds/disputes | Full or partial refunds; automated dispute defense; documented chargeback fees | Full or partial refunds; Creem may refund to prevent disputes; $25 USD/EUR chargeback fee documented | Neither removes seller financial exposure; verify license revocation behavior |
| Standard transaction price | 5% + $0.50 | 3.9% + $0.40 | Creem is cheaper before payout and other fees |
| Payouts | Monthly, $100 minimum; normally no Paddle payout fee for matching-currency local transfers | Twice monthly, $50 minimum, with a $7 USD/EUR or 1% bank-payout fee (whichever is higher); funds may be held 7–12 days for risk assessment | Creem's payout fee largely erodes its US headline-price advantage |
| Seller approval | Account and website/domain verification; public legal and refund pages required | KYC/KYB plus account review; product must be live with visible pricing, privacy policy, terms, and support email; review advertised as 24–72 hours | Start both sandbox accounts early; production approval depends on the landing/legal pages |
| Operational confidence | Long-established vendor, extensive Billing API surface, SDKs, portal, webhook simulator, and public migration history | Newer vendor with simpler developer-facing product and current V2 merchant terms | Paddle is the lower continuity and operations risk |

## Fee Check at the Planned Price

This uses only each vendor's advertised standard transaction formula, excludes
tax, currency conversion, refunds, disputes, optional services, and volume
pricing, and rounds to cents.

| Price | Paddle fee | Creem transaction fee | Difference |
|---:|---:|---:|---:|
| $59 | $3.45 | $2.70 | $0.75 |
| $69 | $3.95 | $3.09 | $0.86 |
| $79 | $4.45 | $3.48 | $0.97 |

For a US seller receiving a $69 sale, allocating Creem's documented 1% payout
fee adds roughly $0.69 before any minimum-fee effect. The apparent $0.86
advantage then falls to roughly $0.17. This is directional rather than an
accounting quote: confirm the fee base, payout currency, minimums, reserves,
and negotiated terms in the live merchant agreement.

## Required Architecture

Do not put a Paddle or Creem merchant API key, webhook secret, or private
signing key in the web bundle, Electron renderer, Electron main process, or
packaged application. Packaging obfuscates secrets; it does not protect them.

The smallest acceptable boundary is:

```text
Landing page / desktop app
          |
          | opens system browser
          v
Provider-hosted checkout -----> signed webhook
                                      |
                                      v
                         Minimal entitlement service
                         - verifies and deduplicates events
                         - holds provider credentials
                         - maps purchase to license state
                         - returns a signed offline lease
                                      |
                                      v
                         Electron verifies lease locally
```

This is an entitlement service, not an author account or cloud-data service.
It should know only provider IDs, a license identifier, product/edition,
entitlement status, an opaque installation identifier, and timestamps. It must
never receive or mutate project content. A model has no role in this path.

Suggested policy for the implementation slice, subject to explicit product
approval:

- first paid activation requires a network connection;
- the service returns a signed, renewable entitlement lease;
- the app verifies the signature locally with an embedded public key;
- use a generous offline window and grace period rather than checking every
  launch;
- detect obvious clock rollback without punishing normal timezone or clock
  corrections;
- a failed network check does not erase a valid cached entitlement; and
- trial expiry or licensing failure must never strand the author's manuscript:
  opening, backup, and export remain available even if editing or paid features
  are gated.

Exact lease duration and post-trial behavior are product decisions for Slice
5.7, not conclusions of this research.

## Creem Validation Gates

Resolve these before selecting Creem:

1. **Client-safe activation:** Does Creem offer a documented public/client
   credential or signed-license verification flow for desktop apps? If not,
   confirm that a merchant-owned proxy is the supported design.
2. **Automatic revocation:** Confirm what happens to a one-time license after
   a full refund, partial refund, chargeback, or Creem-initiated refund, and
   which webhook is authoritative.
3. **Restore purchase:** Verify in sandbox that a one-time buyer can recover
   their key and manage device activations without a SagaSpine
   account. The public portal page is mostly subscription-oriented even though
   the license page says keys are available in the portal.
4. **Offline contract:** Ask whether license responses can be verified locally
   with vendor signatures. If they cannot, the entitlement service must issue
   its own signed lease.
5. **Coverage wording:** Clarify the mismatch among Creem's claims of tax work
   in 50+, 190+, and broadly supported buyer countries, and obtain the exact
   MoR/tax coverage applicable to desktop software sales.
6. **Effective pricing:** Confirm whether percentage fees apply to tax,
   currency conversion, and refunds; confirm US payout fees and reserve policy.
7. **Product approval:** Confirm that a local-first writing application with
   optional BYOK text-AI features is acceptable and does not trigger a prompt
   moderation requirement intended for hosted AI image/video generators.
8. **Operational guarantees:** Obtain API rate limits, support response targets,
   incident history or status commitments, data export, key rotation, webhook
   retention/replay limits, and termination/migration procedures.

Any failure on client-secret safety, recoverability, tax/MoR coverage, or
exportability is a deal-breaker. A small price difference is not grounds to
waive one of those requirements.

## Decision and Implementation Sequence

Research is complete enough to narrow the next work, but not to select a live
provider:

1. Create sandbox accounts with both vendors; do not claim Slice 5.7.
2. In Creem sandbox, create one $69 lifetime product with license keys and a
   two-device limit. Exercise purchase, receipt, portal recovery, activation,
   validation, deactivation, refund, and webhook replay.
3. Send the eight validation questions above to Creem and retain the answers
   with this record.
4. Use Paddle sandbox only to prove the checkout, customer portal, and webhook
   path; estimate the separate licensing-service work rather than building it.
5. Make the vendor decision when the answers and sandbox evidence exist.
6. After Phase 1.1 is recorded and triaged, claim Slice 5.7 and implement the
   provider-neutral entitlement boundary, license UX, local trial, and manual
   smoke coverage.

The present recommendation is therefore **Creem if it passes the gates;
Paddle otherwise**.

## Primary Sources

### Paddle

- [Paddle for digital products](https://developer.paddle.com/get-started/how-paddle-works/digital-products/)
- [Paddle developer documentation index](https://developer.paddle.com/llms.txt)
- [Paddle pricing](https://www.paddle.com/pricing)
- [Paddle customer portal sessions](https://developer.paddle.com/api-reference/customer-portals/create-customer-portal-session/)
- [Paddle webhooks](https://developer.paddle.com/webhooks/)
- [Paddle supported countries](https://developer.paddle.com/concepts/sell/supported-countries-locales/)
- [Paddle payouts](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid)
- [Paddle chargebacks](https://www.paddle.com/help/manage/risk-prevention/understanding-chargebacks-with-paddle)
- [Paddle merchant terms](https://www.paddle.com/legal/terms)

### Creem

- [Creem documentation index](https://docs.creem.io/llms.txt)
- [Creem pricing](https://www.creem.io/pricing)
- [Creem one-time payments](https://docs.creem.io/features/one-time-payment)
- [Creem customer portal](https://docs.creem.io/features/customer-portal)
- [Creem license keys](https://docs.creem.io/features/addons/licenses)
- [Creem webhooks](https://docs.creem.io/code/webhooks)
- [Creem refunds and chargebacks](https://docs.creem.io/merchant-of-record/finance/refunds-and-chargebacks)
- [Creem payouts](https://docs.creem.io/merchant-of-record/finance/payouts)
- [Creem supported countries](https://docs.creem.io/merchant-of-record/supported-countries)
- [Creem account reviews](https://docs.creem.io/merchant-of-record/account-reviews/account-reviews)
- [Creem merchant terms](https://www.creem.io/terms)
