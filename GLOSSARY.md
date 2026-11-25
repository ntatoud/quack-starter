# Quack

A starter app where people sign up, sign in, and track the Habits they want to keep.

## Identity

**User**:
A person who has signed up, identified by their email and proving it with a password.
_Avoid_: Account, member, customer

**Session**:
The proof that a User has signed in, valid until they sign out or it expires.
_Avoid_: Token, login

**Current User**:
The User whose Session, or whose Grant to an AI Client, made the request being handled.
_Avoid_: Viewer, logged-in user, me

**Role**:
What a User is allowed to do: `user` or `admin`. A Role gives a set of Permissions.
_Avoid_: Group, profile

**Status**:
Whether a User can sign in: `active`, `invited` (added, but has not chosen a password yet), or `suspended` (refused by an Admin). Only an `active` User signs in, and a User who is no longer `active` loses every Session.
_Avoid_: State, enabled, banned

**Profile**:
What a User tells about themself: their first and last name, avatar, job title, team, and country. Only the first and last name are required. A User who just signed up has none.
_Avoid_: Account, details, metadata

**Onboarding**:
What a User goes through after signing up, before reaching the app: they give their name, which creates their Profile. A User is onboarded once they have completed it, the date it records.
_Avoid_: Setup, welcome, wizard

**Preference**:
How the app looks on a device, such as the side of the sidebar or the theme (light, dark, or that of the system), whoever is signed in on it. Each one has a default, which a device where it was never changed gets.
A User changes them in the settings, next to their Profile.
_Avoid_: Customization, option

**Permission**:
The right to take one kind of action in a context, such as listing Todos. A request needs the Permission of what it asks for.
_Avoid_: Scope, right, privilege

**AI Client**:
An application driven by an AI model (Claude, ChatGPT...) that acts for a User through MCP, known by the address of the document that describes it. One address is one AI Client, for every User.
_Avoid_: Client, app, integration, connection

**Grant**:
A User's consent that lets one AI Client act for them with some of their Permissions, until the User revokes it or the AI Client stops using it for a while. A User gives one AI Client at most one Grant.
_Avoid_: Token, authorization, connection

**Password Reset**:
How a User who forgot their password chooses a new one, through a link sent to their email.
_Avoid_: Password recovery, forgot password

**Password Change**:
How a signed-in User replaces their password, proving it with the current one.
_Avoid_: Password update

**Email Change**:
How a signed-in User replaces their email: the new one takes effect once they open a link sent to it.
_Avoid_: Email update

**Admin**:
A User whose Role is `admin`. Only an Admin sees the list of Users; any other Current User is forbidden from it.
_Avoid_: Superuser, staff

## Habits

**Habit**:
Something a User wants to do regularly, on a Schedule, towards a Target. An archived Habit is hidden from the User's days but keeps its history.
_Avoid_: Goal, routine, tracker, todo

**Owner**:
The User who created a Habit and the only one who sees it.
_Avoid_: Author, creator

**Schedule**:
When a Habit is due: every Day, on some days of the week, or a number of times a week.
_Avoid_: Frequency, recurrence, plan

**Target**:
What doing a Habit means on a Day: having done it, or a quantity in a unit to reach at least (8 glasses of water) or to stay at most (2 coffees).
_Avoid_: Objective, goal, threshold

**Check-in**:
A User's record that they did a Habit on a Day, with the quantity for a Habit whose Target is one. A Habit has at most one per Day.
_Avoid_: Log, entry, completion, tick

**Success**:
A Day, or a week for a Habit due a number of times a week, on which the Habit's Target was met.
_Avoid_: Done, completed, hit

**Streak**:
The run of consecutive Successes of a Habit, up to its last period that has ended or succeeded. A period still in progress never breaks it.
_Avoid_: Chain, run, combo

**Day**:
A calendar date in the time zone of the User. Today for a User is the Day it is where they are.
_Avoid_: Date, timestamp
