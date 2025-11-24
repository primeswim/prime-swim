# Membership Renewal Tests

This test suite validates the membership renewal logic for different swimmer statuses.

## Running the Tests

```bash
npm run test:membership
```

Or directly:
```bash
npx ts-node --compiler-options '{"module":"commonjs"}' src/lib/membership-renewal.test.ts
```

## Test Cases

The test suite covers the following scenarios:

### 1. Grace Period Swimmer Renewal
- **Scenario**: Swimmer is 10 days past their due date (still in grace period)
- **Expected**: New period starts from the original due date (not today)
- **Reason**: Grace period renewals continue from the due date to avoid losing coverage time

### 2. Due Soon Swimmer Renewal
- **Scenario**: Swimmer renews 15 days before their due date (in renewal window)
- **Expected**: New period starts from the due date
- **Reason**: Renewals in the renewal window start from the scheduled due date

### 3. Expired Swimmer Renewal (Rejoin)
- **Scenario**: Swimmer is 40 days past their due date (beyond grace period)
- **Expected**: New period starts from today (treated as rejoin)
- **Reason**: Expired swimmers restart their membership from the payment date

### 4. New Registration
- **Scenario**: Frozen swimmer with no membership dates (new registration)
- **Expected**: New period starts from today, anchor date is set, swimmer is unfrozen
- **Reason**: First-time memberships begin on the payment date

### 5. Renewal on Exact Due Date
- **Scenario**: Swimmer renews exactly on their due date
- **Expected**: New period starts from the due date
- **Reason**: On-time renewals maintain the original schedule

### 6. Renewal at Last Day of Grace Period
- **Scenario**: Swimmer renews on the last day of the grace period
- **Expected**: New period starts from the due date (still in grace window)
- **Reason**: Grace period includes the last day (inclusive boundary)

### 7. Renewal After Grace Period
- **Scenario**: Swimmer renews 1 day after grace period ends
- **Expected**: Treated as rejoin, starts from today
- **Reason**: After grace period, membership is considered expired and restarted

### 8. Status After Renewal
- **Scenario**: After any successful renewal
- **Expected**: Status should be "active"
- **Reason**: Paid renewals activate membership

### 9. Period Length Consistency
- **Scenario**: All renewal types
- **Expected**: All periods are exactly 364 days (1 year - 1 day)
- **Reason**: Consistent membership period length across all renewal types

### 10. Next Due Date Calculation
- **Scenario**: After renewal
- **Expected**: Next due date is exactly period end + 1 day
- **Reason**: Ensures proper scheduling of the next renewal

## Constants

- **RENEWAL_WINDOW_DAYS**: 30 days before due date
- **GRACE_DAYS**: 30 days after due date
- **Period Length**: 364 days (1 year - 1 day)

## Key Logic Points

1. **Renewal Window**: Swimmers can renew starting 30 days before their due date
2. **Grace Period**: 30-day grace period after due date where renewals still start from the due date
3. **Rejoin**: Swimmers beyond grace period restart from today's date
4. **New Registration**: Frozen swimmers or those without dates start fresh from today

## Integration with Admin Panel

The test logic matches the `markPaid` function in `src/app/admin/swimmers/page.tsx`. Any changes to the renewal logic should:
1. Update the actual implementation in the admin panel
2. Update the test simulation function `simulateMarkPaid` in this file
3. Re-run tests to ensure consistency

