/**
 * One address, one spelling.
 *
 * Firebase Auth lowercases the address it stores, so every email the app reads
 * back from a token — `user.email`, `request.auth.token.email` — is already
 * normalised. Recipes, sessions, storage paths and invites all descend from
 * that token and are therefore consistent with each other for free.
 *
 * Registration is the one place a *typed* address enters the system, and that
 * is where the two spellings diverged: someone who typed `Kaylee.…` got an
 * auth account at `kaylee.…` and a `users` profile at `Kaylee.…`, which nothing
 * else in the app could ever match again. Two rows in the people picker was the
 * visible half; the invisible half was worse, because an ask addressed to the
 * unmatched spelling is filtered out by the recipient's own query *and* denied
 * by the read rule — an invitation that fails silently at both ends.
 *
 * So every address is put through here before it is stored or compared. Case
 * only: the local part of an address is case-sensitive per RFC 5321, but no
 * provider this app will meet honours that, and Firebase has already made the
 * decision for us by folding the case on the account itself. Matching its
 * behaviour is what keeps the profile and the account describing one person.
 */
export const normaliseEmail = (raw: string) => raw.trim().toLowerCase()

/**
 * Good enough to keep an address out of the database that nobody could ever
 * receive mail at. Not an attempt at RFC 5322 — the local part of an address
 * may legally contain almost anything, including spaces inside quotes, and a
 * validator that chases that correctly rejects real addresses to catch typos
 * that a confirmation mail catches for free.
 *
 * What it does insist on is the part that has actually gone wrong here: **no
 * whitespace anywhere**, and **anchored at both ends**. The previous pattern,
 * `/[^@]+@[^.]+\..+/`, had neither — `[^@]+` happily matched `maint .8`, and
 * unanchored it would have accepted `ask maint@gmail.com about it` as well. A
 * profile went into `users` at `maint .8@gmail.com` and sat there as a person
 * who could be picked out of the invite list and never reached.
 *
 * The domain needs at least two labels with something in each, so `a@b`,
 * `a@.com`, and `a@b..com` are all out.
 *
 * Validate the *normalised* address, not the raw one: a trailing newline off a
 * paste should be trimmed rather than reported as an invalid address, since
 * trimming is what gets stored anyway.
 */
export const isValidEmail = (raw: string) =>
  /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(normaliseEmail(raw))
