#!/usr/bin/env node
/**
 * What is out of step, and shipping it.
 *
 *   npm run deploy:check   report drift, change nothing
 *   npm run ship           push, then deploy whatever actually drifted
 *   npm run deploy         deploy whatever drifted, without pushing
 *
 * This exists because "what needs updating — the functions, the rules, or just
 * a push?" was a question that took three commands and some archaeology to
 * answer, and getting it wrong shipped a client against rules that denied it.
 * Two deploy targets that move independently need one place that says where
 * each of them stands.
 *
 * The two are checked in deliberately different ways:
 *
 * - **Rules are observed.** `liveRules.mjs` fetches the live ruleset and
 *   compares it, so this reports reality rather than a belief about it.
 * - **Functions are recorded**, against a `deployed/functions` git tag moved on
 *   each successful deploy. There is no cheap way to ask Cloud Functions which
 *   source it is running, and a tag is at least shared, versioned, and honest
 *   about being a record of intent — it can be wrong if someone deploys and the
 *   tag push fails, which is why it says when it has never been set at all.
 */
import { execFileSync, spawnSync } from "node:child_process"

const TAG = "deployed/functions"

const run = (command, args, options = {}) =>
  spawnSync(command, args, { encoding: "utf8", ...options })

const loud = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit" })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}`)
  }
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim()

/* ----------------------------------------------------------------- state */

const headCommit = () => git("rev-parse", "--short", "HEAD")

const unpushed = () => {
  const upstream = run("git", ["rev-parse", "--abbrev-ref", "@{upstream}"])
  if (upstream.status !== 0) return { known: false, count: 0 }
  const count = Number(git("rev-list", "--count", "@{upstream}..HEAD"))
  return { known: true, count }
}

/**
 * Whether the rules on the server differ from the file. Exit 1 means drift,
 * 0 means in step, anything else means the check itself could not run — most
 * often no gcloud credentials, which is a different thing from being current
 * and must not be reported as one.
 */
const rulesState = () => {
  const result = run("node", ["scripts/liveRules.mjs", "--diff"])
  if (result.status === 0) return { state: "current" }
  if (result.status === 1) return { state: "drifted", detail: result.stdout }
  return { state: "unknown", detail: (result.stderr || result.stdout).trim().split("\n")[0] }
}

const functionsState = () => {
  const tagged = run("git", ["rev-parse", "-q", "--verify", `refs/tags/${TAG}`])
  if (tagged.status !== 0) return { state: "unrecorded" }

  const since = git("rev-parse", "--short", `refs/tags/${TAG}`)
  const changed = run("git", ["diff", "--quiet", `refs/tags/${TAG}`, "HEAD", "--", "functions/"])
  return changed.status === 0 ? { state: "current", since } : { state: "drifted", since }
}

/* ---------------------------------------------------------------- report */

const pad = (label) => label.padEnd(10)

const report = ({ rules, functions, ahead }) => {
  if (ahead.known && ahead.count > 0) {
    console.log(`${pad("master")} ${ahead.count} commit${ahead.count === 1 ? "" : "s"} not pushed`)
  } else if (ahead.known) {
    console.log(`${pad("master")} pushed`)
  }

  console.log(
    `${pad("rules")} ${
      rules.state === "current"
        ? "in step"
        : rules.state === "drifted"
          ? "DRIFTED — the live ruleset differs from firestore.rules"
          : `could not check — ${rules.detail}`
    }`
  )

  console.log(
    `${pad("functions")} ${
      functions.state === "current"
        ? `in step since ${functions.since}`
        : functions.state === "drifted"
          ? `CHANGED since ${functions.since}`
          : "never recorded — deploy once to start tracking"
    }`
  )
}

/* ---------------------------------------------------------------- deploy */

const deployRules = () => {
  console.log("\n→ deploying rules")
  // `firebase.json` points at firestore.rules, so this is the whole of it.
  loud("firebase", ["deploy", "--only", "firestore:rules"])
}

const deployFunctions = () => {
  console.log("\n→ deploying functions")
  loud("npm", ["--prefix", "functions", "run", "deploy"])

  // Moved only after the deploy succeeds, so a failed deploy leaves the tag
  // where it was and this keeps reporting drift.
  loud("git", ["tag", "-f", TAG, "HEAD"])
  const pushed = run("git", ["push", "-f", "origin", `refs/tags/${TAG}`])
  if (pushed.status !== 0) {
    console.log(`  (tag moved locally; could not push it — ${TAG} may look stale elsewhere)`)
  }
  console.log(`  ${TAG} → ${headCommit()}`)
}

/* ------------------------------------------------------------------ main */

const mode = process.argv.includes("--check")
  ? "check"
  : process.argv.includes("--deploy")
    ? "deploy"
    : "ship"

const state = { rules: rulesState(), functions: functionsState(), ahead: unpushed() }

if (mode === "ship" && state.ahead.known && state.ahead.count > 0) {
  console.log(`→ pushing ${state.ahead.count} commit${state.ahead.count === 1 ? "" : "s"}\n`)
  // Before anything is deployed: shipping a function built from a commit that
  // never reached master is how production ends up ahead of the repository.
  loud("git", ["push"])
  state.ahead = unpushed()
  console.log("")
}

report(state)

if (mode === "check") {
  const stuck = state.rules.state === "drifted" || state.functions.state !== "current"
  process.exit(stuck ? 1 : 0)
}

if (state.rules.state === "drifted") deployRules()
if (state.functions.state !== "current") deployFunctions()

if (state.rules.state !== "drifted" && state.functions.state === "current") {
  console.log("\nNothing to deploy.")
}
