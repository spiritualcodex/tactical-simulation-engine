import fs from "node:fs"
import path from "node:path"
import { runScoutCycle, getScoutIdeas } from "./scoutEngine.mjs"
import { getManagerRules, selectNextBuild } from "./managerEngine.mjs"
import { assignBuildTask } from "./teamOrchestrator.mjs"

const MATCH_HISTORY_PATH = path.join(process.cwd(), "data", "match-history.json")

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return fallback
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8")
}

function slugify(value) {
  return String(value || "untitled")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled"
}

function getCycleKey(timestamp = Date.now()) {
  const date = new Date(timestamp)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  const hour = String(date.getUTCHours()).padStart(2, "0")
  const quarter = Math.floor(date.getUTCMinutes() / 15)
  return `${year}-${month}-${day}T${hour}:Q${quarter}`
}

function countBuildsForCycle(history, cycleKey) {
  return history.filter((entry) => entry?.cycle_key === cycleKey && entry?.attempted_build === true).length
}

function hasMonetizationOutputs(buildResult) {
  const landingPage = typeof buildResult?.landing_url === "string" && buildResult.landing_url.trim()
  const cta = typeof buildResult?.cta === "string" && buildResult.cta.trim()
  const productPath = typeof buildResult?.product_path === "string" && buildResult.product_path.trim()

  return Boolean(landingPage && cta && productPath)
}

export function getMatchHistory() {
  const history = readJson(MATCH_HISTORY_PATH, [])
  return Array.isArray(history) ? history : []
}

export function getMatchScoreboard() {
  const history = getMatchHistory()
  const lastMatch = history[0] || null
  const scoutIdeas = getScoutIdeas()

  return {
    matchesPlayed: history.length,
    lastMatch: lastMatch
      ? {
          idea: String(lastMatch.idea || ""),
          result: String(lastMatch.result || "unknown"),
        }
      : null,
    scoutQueue: scoutIdeas.length,
  }
}

export async function runMatchCycle({ executeBuild, distributeBuild } = {}) {
  if (typeof executeBuild !== "function") {
    throw new Error("match_cycle_missing_execute_build")
  }

  const rules = getManagerRules()
  const cycleKey = getCycleKey()
  const history = getMatchHistory()

  if (countBuildsForCycle(history, cycleKey) >= rules.max_builds_per_cycle) {
    console.log("[MANAGER] no valid idea this cycle")
    return {
      success: false,
      reason: "max_builds_per_cycle_reached",
      cycleKey,
      scoutIdeas: getScoutIdeas(),
    }
  }

  const scoutIdeas = await runScoutCycle()
  const selection = await selectNextBuild()
  if (!selection.selectedIdea) {
    return {
      success: false,
      reason: selection.reason,
      scoutIdeas,
    }
  }

  const assignment = await assignBuildTask(selection.selectedIdea)
  console.log(`[MATCH] building product: ${selection.selectedIdea}`)

  const buildResult = await executeBuild({
    topic: selection.selectedIdea,
    intent: "build_income_stream",
  }, {
    source: "match:stadium",
  })

  const monetizationVerified = !rules.require_monetization || hasMonetizationOutputs(buildResult)
  if (rules.require_monetization && !monetizationVerified) {
    console.log("[MANAGER] build rejected (missing monetization outputs)")
  }

  if (typeof distributeBuild === "function" && buildResult?.success && monetizationVerified) {
    await distributeBuild(buildResult)
  }

  const historyEntry = {
    match_id: `stadium_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    idea: selection.selectedIdea,
    result: buildResult?.success && monetizationVerified ? "built" : (buildResult?.success ? "skipped" : "failed"),
    slug: String(buildResult?.slug || slugify(selection.selectedIdea)),
    revenue_estimate: Number.isFinite(Number(buildResult?.revenue_estimate)) ? Number(buildResult.revenue_estimate) : 0,
    reason: selection.reason,
    team: assignment.team,
    cycle_key: cycleKey,
    attempted_build: true,
    monetization_verified: monetizationVerified,
    manager_category: selection?.candidate?.manager_category || null,
    createdAt: new Date().toISOString(),
  }

  writeJson(MATCH_HISTORY_PATH, [historyEntry, ...history].slice(0, 100))
  console.log(`[MATCH] result complete: ${historyEntry.result} ${historyEntry.slug}`)

  return {
    success: buildResult?.success === true && monetizationVerified,
    scoutIdeas,
    selected: selection,
    team: assignment,
    result: historyEntry,
    build: buildResult,
    cycleKey,
  }
}