# HITL Gates

Use ACP permission questions or an explicit user confirmation. Do not skip
a gate because the model is confident.

## rules_consent

Show the campus vehicle rules (from `rules.md` plus any campus copy).
Options: agree / decline. Decline ends the booking.

Skip only when `gates.json` already records an accepted `rules_consent`
for this user in this booking and the user is not starting over.

## confirm

Show a summary of `booking.json`: identity, passengers, vehicle types,
purpose, funding, and each itinerary. Options: accept / modify.
Modify returns to collect.

## pledge

Show the commitment letter before any submit:

- Follow the published vehicle rules, including advance-time limits.
- Submitted facts are true, complete, and the applicant's responsibility.
- Use the vehicle only for the stated purpose; do not lend it out.
- Obey traffic law; report damage or accidents.
- Accept that false or repeated violations can block later requests.

Options: sign / cancel. Cancel ends the booking. Record signer name and
time in `gates.json`. Do not treat a chat "ok" as a signed pledge unless
the user confirmed this letter.

## Modification

After a validate error, return to collect with the failing fields named.
Do not re-open `rules_consent` or `confirm` unless the user asks to reset.
