import fs from "node:fs"
import path from "node:path"
import { getScoutIdeas } from "./scoutEngine.mjs"

const MATCH_HISTORY_PATH = path.join(process.cwd(), "data", "match-history.json")
const MANAGER_RULES_PATH = path.join(process.cwd(), "data", "manager-rules.json")
const DEFAULT_MANAGER_RULES = {
  min_priority: 7,
  min_demand_score: 6,
  max_builds_per_cycle: 1,
  require_monetization: true,
  allowed_categories: ["spiritual", "ai-tools", "self-improvement"],
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

function slugify(value) {
  return String(value || "untitled")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled"
}

function listBuiltSlugs() {
  const history = readJson(MATCH_HISTORY_PATH, [])
  return new Set(
    Array.isArray(history)
      ? history
        .filter((entry) => entry?.result === "built")
        .map((entry) => String(entry?.slug || slugify(entry?.idea)).trim())
        .filter(Boolean)
      : [],
  )
}

function normalizeScoreValue(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  return numeric > 10 ? numeric / 10 : numeric
}

function normalizeRules(rawRules = {}) {
  const allowedCategories = Array.isArray(rawRules.allowed_categories)
    ? rawRules.allowed_categories.map((entry) => String(entry || "").trim().toLowerCase()).filter(Boolean)
    : DEFAULT_MANAGER_RULES.allowed_categories

  return {
    min_priority: normalizeScoreValue(rawRules.min_priority ?? DEFAULT_MANAGER_RULES.min_priority),
    min_demand_score: normalizeScoreValue(rawRules.min_demand_score ?? DEFAULT_MANAGER_RULES.min_demand_score),
    max_builds_per_cycle: Number.isFinite(Number(rawRules.max_builds_per_cycle))
      ? Math.max(0, Math.floor(Number(rawRules.max_builds_per_cycle)))
      : DEFAULT_MANAGER_RULES.max_builds_per_cycle,
    require_monetization: rawRules.require_monetization !== false,
    allowed_categories: allowedCategories,
  }
}

function readManagerRules() {
  return normalizeRules(readJson(MANAGER_RULES_PATH, DEFAULT_MANAGER_RULES))
}

function deriveManagerCategory(entry = {}) {
  const explicit = typeof entry.manager_category === "string" && entry.manager_category.trim()
    ? entry.manager_category.trim().toLowerCase()
    : ""
  if (explicit) {
    return explicit
  }

  const raw = `${entry.idea || ""} ${entry.category || ""}`.toLowerCase()
  if (/(spiritual|soul|dream|sign|mirror|numerology|meaning|symbol|synchronic|transition|recurring)/.test(raw)) {
    return "spiritual"
  }

  if (/(ai|tool|tools|agent|automation|builder|codex)/.test(raw)) {
    return "ai-tools"
  }

  if (/(clarity|habit|growth|healing|improve|improvement|discipline|mindset|self)/.test(raw)) {
    return "self-improvement"
  }

  return typeof entry.category === "string" && entry.category.trim()
    ? entry.category.trim().toLowerCase()
    : "uncategorized"
}

function rejectIdea(reason, idea) {
  console.log(`[MANAGER] idea rejected (${reason})${idea ? `: ${idea}` : ""}`)
}

function passesRules(entry, rules, builtSlugs) {
  if (builtSlugs.has(entry.slug)) {
    return false
  }

  const normalizedPriority = normalizeScoreValue(entry.priority)
  if (normalizedPriority < rules.min_priority) {
    rejectIdea("low priority", entry.idea)
    return false
  }

  const normalizedDemand = normalizeScoreValue(entry.demand_score)
  if (normalizedDemand < rules.min_demand_score) {
    rejectIdea("low demand", entry.idea)
    return false
  }

  const managerCategory = deriveManagerCategory(entry)
  if (rules.allowed_categories.length > 0 && !rules.allowed_categories.includes(managerCategory)) {
    rejectIdea("category blocked", entry.idea)
    return false
  }

  return true
}

export function getManagerRules() {
  return readManagerRules()
}

export async function selectNextBuild() {
  const scoutIdeas = getScoutIdeas()
  const builtSlugs = listBuiltSlugs()
  const rules = readManagerRules()
  const candidates = scoutIdeas.map((entry) => ({
    ...entry,
    manager_category: deriveManagerCategory(entry),
  }))
  const selectedIdea = candidates.find((entry) => passesRules(entry, rules, builtSlugs)) || null

  if (!selectedIdea) {
    console.log("[MANAGER] no valid idea this cycle")
    return {
      selectedIdea: null,
      reason: candidates.length === 0 ? "no_scout_ideas_available" : "no_valid_idea_this_cycle",
      candidate: null,
      rules,
    }
  }

  const reason = `Highest priority ${selectedIdea.category} with demand ${selectedIdea.demand_score} and competition ${selectedIdea.competition_score}`
  console.log("[MANAGER] build approved")
  console.log(`[MANAGER] selected idea: ${selectedIdea.idea}`)
  return {
    selectedIdea: selectedIdea.idea,
    reason,
    candidate: selectedIdea,
    rules,
  }
}