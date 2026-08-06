#!/usr/bin/env node
/**
 * Reads the Firestore ruleset that is actually live, and optionally diffs it
 * against the local `firestore.rules`.
 *
 *   npm run rules:live    # print what the project is serving
 *   npm run rules:diff    # compare it with the local file; exit 1 if they differ
 *
 * `firebase.json` has a `firestore` section, so `firestore.rules` **is** what
 * gets deployed — the repo is the source of truth and there is no clipboard
 * step. `npm run deploy` and `npm run ship` publish it with
 * `firebase deploy --only firestore:rules`.
 *
 * What this is for is the gap between the file and the server, which a deploy
 * closes but nothing else reports: a client shipped against rules that deny it
 * fails only in production, and only for the feature that needed them. Rules
 * are the one deploy target here that can be *observed* rather than inferred,
 * so `deploy:check` observes them.
 *
 * Auth comes from `gcloud auth print-access-token`, so whoever runs it needs to
 * be logged in with an account that can read the project's rules.
 */
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const LOCAL_FILE = "firestore.rules"
/** The release every Firestore project publishes its rules under. */
const RELEASE = "cloud.firestore"

const die = (message) => {
  console.error(message)
  process.exit(2)
}

const projectId = () => {
  if (process.env.FIREBASE_PROJECT) return process.env.FIREBASE_PROJECT
  try {
    return JSON.parse(readFileSync(".firebaserc", "utf8")).projects.default
  } catch {
    die("No project id: set FIREBASE_PROJECT, or run this from the repo root.")
  }
}

const accessToken = () => {
  try {
    return execFileSync("gcloud", ["auth", "print-access-token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  } catch {
    die("Could not get a token. Install the gcloud CLI, then `gcloud auth login`.")
  }
}

const api = async (url, project, token) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Goog-User-Project": project,
    },
  })
  if (!response.ok) {
    die(`${response.status} ${response.statusText} from ${url}\n${await response.text()}`)
  }
  return response.json()
}

const fetchLiveRules = async () => {
  const project = projectId()
  const token = accessToken()
  const base = "https://firebaserules.googleapis.com/v1"

  const { releases = [] } = await api(`${base}/projects/${project}/releases`, project, token)
  const release = releases.find((r) => r.name.endsWith(`/${RELEASE}`))
  if (release == null) {
    die(`No ${RELEASE} release on ${project}. Run \`npm run deploy\` to publish rules once first.`)
  }

  const ruleset = await api(`${base}/${release.rulesetName}`, project, token)
  // A ruleset is a list of files; Firestore projects have exactly one.
  return {
    source: (ruleset.source?.files ?? []).map((file) => file.content).join("\n"),
    createTime: ruleset.createTime,
    project,
  }
}

const { source, createTime, project } = await fetchLiveRules()

if (!process.argv.includes("--diff")) {
  console.log(source)
  console.error(`\n— live on ${project}, published ${createTime}`)
  process.exit(0)
}

const livePath = join(tmpdir(), `firestore.rules.live.${project}`)
writeFileSync(livePath, source)

// `diff` rather than a hand-rolled comparison: rules are read by people, and a
// unified diff is the format they already know how to read.
const diff = spawnSync("diff", ["-u", livePath, LOCAL_FILE], { encoding: "utf8" })

if (diff.status === 0) {
  console.log(`In step: ${LOCAL_FILE} matches what ${project} is serving.`)
  process.exit(0)
}

console.log(diff.stdout)
console.error(
  `${LOCAL_FILE} differs from the live ruleset (published ${createTime}).\n` +
    "`-` is live, `+` is local. Publish with `npm run deploy` (or `npm run ship` to push first)."
)
process.exit(1)
