import fs from "node:fs"
import path from "node:path"

const SCOUT_IDEAS_PATH = path.join(process.cwd(), "data", "scout-ideas.json")
const GENERATED_PAGES_DIR = path.join(process.cwd(), "generated-pages")
const GENERATED_BLOG_POSTS_PATH = path.join(process.cwd(), "data", "generated-blog-posts.json")

const DEFAULT_SCOUT_SEED = [
  { idea: "spiritual meaning of mirror hours in daily life", category: "search_gap", demand_score: 86, competition_score: 38 },
  { idea: "why recurring signs show up during life transitions", category: "trend", demand_score: 82, competition_score: 34 },
  { idea: "how to decode repeated dreams and symbols", category: "trend", demand_score: 79, competition_score: 42 },
  { idea: "spiritual meaning of sudden clarity at dawn", category: "content_gap", demand_score: 74, competition_score: 29 },
  { idea: "what repeating names mean spiritually", category: "trend", demand_score: 77, competition_score: 36 },
]

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

function normalizeIdea(entry = {}) {
  const idea = typeof entry.idea === "string" && entry.idea.trim() ? entry.idea.trim() : "untitled"
  const demandScore = Number.isFinite(Number(entry.demand_score)) ? Number(entry.demand_score) : 50
  const competitionScore = Number.isFinite(Number(entry.competition_score)) ? Number(entry.competition_score) : 50
  const priority = Number.isFinite(Number(entry.priority))
    ? Number(entry.priority)
    : Math.max(1, Math.round(demandScore * 1.25 - competitionScore * 0.55))

  return {
    idea,
    category: typeof entry.category === "string" && entry.category.trim() ? entry.category.trim() : "trend",
    demand_score: Math.max(1, Math.min(100, demandScore)),
    competition_score: Math.max(1, Math.min(100, competitionScore)),
    priority,
    slug: typeof entry.slug === "string" && entry.slug.trim() ? entry.slug.trim() : slugify(idea),
    scouted_at: typeof entry.scouted_at === "string" ? entry.scouted_at : new Date().toISOString(),
  }
}

function listGeneratedSlugs() {
  if (!fs.existsSync(GENERATED_PAGES_DIR)) {
    return []
  }

  return fs.readdirSync(GENERATED_PAGES_DIR)
    .filter((entry) => entry.endsWith(".html"))
    .map((entry) => entry.replace(/\.html$/i, ""))
}

function listGeneratedBlogEntries() {
  const entries = readJson(GENERATED_BLOG_POSTS_PATH, [])
  return Array.isArray(entries)
    ? entries.map((entry) => String(entry?.slug || entry?.topic || "").trim()).filter(Boolean)
    : []
}

function buildGapIdeas(existingSlugs) {
  const slugSet = new Set(existingSlugs)

  return DEFAULT_SCOUT_SEED
    .filter((entry) => !slugSet.has(slugify(entry.idea)))
    .map((entry) => normalizeIdea(entry))
}

function buildCoverageIdea(existingSlugs) {
  if (existingSlugs.length === 0) {
    return []
  }

  const recurringPatternIdea = normalizeIdea({
    idea: "best spiritual patterns missing from recent generated outputs",
    category: "gap_scan",
    demand_score: 72,
    competition_score: 24,
  })

  return existingSlugs.includes(recurringPatternIdea.slug) ? [] : [recurringPatternIdea]
}

export function getScoutIdeas() {
  const data = readJson(SCOUT_IDEAS_PATH, [])
  return Array.isArray(data) ? data.map((entry) => normalizeIdea(entry)) : []
}

export async function runScoutCycle() {
  const generatedPageSlugs = listGeneratedSlugs()
  const generatedBlogSlugs = listGeneratedBlogEntries()
  const knownSlugs = new Set([...generatedPageSlugs, ...generatedBlogSlugs])

  const nextIdeas = [
    ...buildGapIdeas(knownSlugs),
    ...buildCoverageIdea(generatedPageSlugs),
  ]
    .map((entry) => normalizeIdea(entry))
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 12)

  writeJson(SCOUT_IDEAS_PATH, nextIdeas)
  console.log(`[SCOUT] ideas found: ${nextIdeas.length}`)
  return nextIdeas
}