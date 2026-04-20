# Parts Partner — Roadmap v2

> Phase 1 (all 20 original features) is complete and deployed.
> This document covers refinements to existing features and new feature proposals for Phase 2.

---

## Refinements to Existing Features

### 1. RO Detail — Customer History Panel

Right now when you open an RO, there's no view into that customer/VIN's history. Adding a collapsible "Vehicle History" sidebar panel showing prior visits, what was declined, open recalls addressed, and last service dates would be high-value for advisors upselling and techs diagnosing.

### 2. Customer Approval Portal — Line-Item Enhancements

The portal currently lets customers approve/decline items but doesn't show them *why*. Adding optional photo attachment per line item (e.g. a photo of the worn brake pad) and "bundle discount" support (approve all 3 items and save $X) would meaningfully increase approval rates.

### 3. Parts Analytics — Trend Comparison

The current analytics page shows absolute KPIs but no trend direction. Adding a "vs prior period" comparison (delta % with up/down arrow) on the KPI cards and a line chart showing fill rate over time would make it actually actionable.

### 4. Notification Bell — Categorization

Currently all notifications are in one flat list. Adding type icons (wrench for RO events, box for parts, warning triangle for recalls) and a simple filter (All / Unread / Critical) would help once volume picks up.

### 5. DVI / Inspection PDF — Tire & Brake Visual Gauges

The inspection PDF is text-based. Adding visual gauge graphics for tire tread (32nds) and brake pad depth (mm) with color-coded thresholds (green/yellow/red) would make it dramatically more persuasive to customers and more professional-looking. Also a green , yellow and red for each line item in the inspection PDF.

### 6. Parts Queue — Real-Time Updates

Currently polls every 30 seconds. Switching to Server-Sent Events (SSE) would make the counter queue feel live, which matters when a tech is at the counter waiting for a pulled part to show "ready."

---

## New Features

### 7. RO Templates / Quick-Start Services

Let managers save templates for common jobs (oil change, brake job, tire rotation, state inspection). When creating a new RO, technicians pick a template that pre-populates the standard labor lines and commonly-used parts. Eliminates repetitive data entry, reduces errors on high-volume service.

### 8. Technician Scorecard

Each tech already has time entries and line items. A scorecard view showing: efficiency % (flat-rate billed vs clock hours), comeback rate (same repair within 30 days), average labor per RO, and ROs completed per week — over a rolling period. Useful for performance reviews and incentive pay conversations.

### 9. Month-End Close Report

An auto-generated PDF report triggered from the admin panel: total ROs closed, revenue breakdown (customer-pay / warranty / internal), gross profit %, advisor performance table, top/bottom parts categories, open RO aging, parts fill rate for the period. This is what the service manager hands to the dealer principal.

### 10. Digital Vehicle Check-In (Customer-Facing)

A tablet-optimized form customers fill out at drop-off: existing damage acknowledgment with photo capture, their concerns in their own words (feeds directly into RO notes as customer-stated concern), and an e-signature. Eliminates disputes about pre-existing damage and gives techs unfiltered customer language.

### 11. Supplier Catalog Search at Ordering

When adding parts to an order, allow a live price/availability check against supplier catalogs (NAPA, AutoZone Pro, etc.) via their APIs. Show: your cost, their stock, ETA at your store. Advisors currently have to switch to the supplier website manually.

### 12. Recall Campaign Tracker

Beyond just flagging recalls on individual ROs — a dedicated view showing all vehicles in the customer database with open recalls, their contact status (notified / scheduled / repaired / unreachable), and appointment booking. Dealer-level recall compliance tracking for OEM requirements.

### 13. Shift Handoff Log

A simple end-of-day/shift notes feature for service managers: free-text notes + tagged ROs that need attention next shift. Visible to the incoming manager as a banner when they log in. Replaces sticky notes and text messages between managers.

### 14. Bulk Inventory Import via CSV

A CSV upload flow in the admin/inventory area for initial population or mass price updates. Maps columns to Prisma fields with a preview/confirm step before committing. Right now there's no way to get bulk data in without direct DB access.

### 15. Parts Return / Core Credit Dashboard

A dedicated view aggregating all `PartReturn` records across the rooftop: outstanding cores awaiting return, defective parts pending supplier credit, estimated credits due vs credits received. Currently returns are visible per-RO but not rolled up.

---

## Priority Matrix

| # | Feature | Effort | Value | Who Benefits |
|---|---------|--------|-------|--------------|
| 7 | RO Templates | Low | High | Techs / Advisors |
| 1 | Customer History Panel | Low–Med | High | Advisors |
| 9 | Month-End Close Report | Low–Med | High | Manager / Owner |
| 14 | Bulk Inventory Import | Low | High | Admin |
| 13 | Shift Handoff Log | Very Low | Med–High | Managers |
| 2 | Portal Photo + Bundle Discounts | Med | High | Advisors / Revenue |
| 5 | DVI Visual Gauges (tire/brake) | Med | High | Customers / Trust |
| 8 | Tech Scorecard | Low | Med | Manager |
| 10 | Digital Check-In | Med | Med–High | Advisors / Legal |
| 3 | Analytics Trend Comparison | Low | Med | Manager |
| 6 | Parts Queue SSE | Low | Med | Counter / Techs |
| 15 | Core Credit Dashboard | Low | Med | Parts Manager |
| 12 | Recall Campaign Tracker | Med | Med | Service Manager |
| 11 | Supplier Catalog Integration | Med–High | High | Advisors |
| 4 | Notification Categories & Filters | Very Low | Low–Med | Everyone |

---

## Suggested Starting Point

**#7 RO Templates**, **#1 Customer History Panel**, and **#9 Month-End Report** are the recommended first batch:

- All three use only data already in the database
- No new third-party dependencies
- High visibility impact for managers and advisors
