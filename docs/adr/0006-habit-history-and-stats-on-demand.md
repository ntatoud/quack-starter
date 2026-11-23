# 0006: A Habit keeps the history of its Schedule and Target, and its stats are computed on demand from it

Accepted, 2026-11-23.

## Context

A User changes a Habit over time: "3 times a week" becomes "5 times a week", "8 glasses" becomes "6". Whether a past Day was a Success depends on what the Habit asked for on that Day. Applying the new Schedule or Target to the past rewrites old Streaks and success rates after the fact, which a User reads as the app losing their history.

## Decision

- A Habit keeps every version of its Schedule and Target, each with the Day it takes effect. A change takes effect from Today for its User; earlier Days stay judged by the version in force then.
- Check-ins are stored by Day, in the time zone of the User, not as instants: changing the time zone never moves one.
- Streaks, Successes, and success rates are not stored. Pure functions of the habits domain compute them from a range of Check-ins and the Habit's versions, on each request. The summary across all Habits (Check-ins per Day) is a SQL aggregate.

## Considered Options

- **One Schedule and Target per Habit, applied to the whole past**: simpler, but rewrites Streaks.
- **Schedule and Target fixed at creation, a change means a new Habit**: honest, but splits one Habit's history in two.
- **Stored Streaks, updated on each Check-in**: fast to read, but every change of a version, a time zone, or a past Check-in must update them, and a missed update is a wrong Streak nobody can see. The volume (one Check-in per Habit and Day) does not need it.

## Consequences

- The rules of Success and Streak are tested without a database.
- Reading a Habit's stats reads its versions along with its Check-ins.
