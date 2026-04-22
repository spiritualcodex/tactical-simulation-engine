import fs from "node:fs"
import path from "node:path"

const SIMULATION_STATE_PATH = path.join(process.cwd(), "data", "simulation-state.json")
const DEFAULT_MATCHES_PER_SEASON = 30
const MAX_ACTIVE_PROJECTS = 8
const MAX_YOUTH_PROJECTS = 12
const MAX_HISTORY = 80
const MAX_SEASON_HISTORY = 12
const DEFAULT_LIVE_PHASE = "[SCOUTING]"

const phaseTimers = new Map()

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function buildId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function slugify(value) {
  return String(value || "untitled")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled"
}

function toCurrency(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.round(numeric * 100) / 100
}

function normalizeProject(project = {}, fallbackTopic = "untitled") {
  const topic = typeof project.topic === "string" && project.topic.trim()
    ? project.topic.trim()
    : fallbackTopic

  return {
    project_id: typeof project.project_id === "string" ? project.project_id : buildId("project"),
    topic,
    slug: typeof project.slug === "string" && project.slug.trim() ? project.slug.trim() : slugify(topic),
    origin: typeof project.origin === "string" ? project.origin : "scout",
    status: typeof project.status === "string" ? project.status : "queued",
    source: typeof project.source === "string" ? project.source : "simulation",
    createdAt: typeof project.createdAt === "string" ? project.createdAt : new Date().toISOString(),
    promotedAt: typeof project.promotedAt === "string" ? project.promotedAt : null,
    completedAt: typeof project.completedAt === "string" ? project.completedAt : null,
    match_id: typeof project.match_id === "string" ? project.match_id : null,
    season: Number.isFinite(project.season) ? project.season : 1,
    matchDay: Number.isFinite(project.matchDay) ? project.matchDay : 0,
    revenueEstimate: toCurrency(project.revenueEstimate),
  }
}

function createDefaultState() {
  return {
    season: 1,
    matchDay: 0,
    matchesPerSeason: DEFAULT_MATCHES_PER_SEASON,
    productsBuilt: 0,
    revenueTotal: 0,
    lastProduct: "",
    livePhase: DEFAULT_LIVE_PHASE,
    phaseUpdatedAt: new Date().toISOString(),
    activeProjects: [],
    youthProjects: [],
    history: [],
    seasonStats: {
      productsBuilt: 0,
      revenueTotal: 0,
      matchesPlayed: 0,
    },
    seasonHistory: [],
  }
}

function normalizeState(state = {}) {
  const base = createDefaultState()
  const matchesPerSeason = Number.isFinite(state.matchesPerSeason)
    ? Math.max(20, Math.min(50, Number(state.matchesPerSeason)))
    : DEFAULT_MATCHES_PER_SEASON

  return {
    season: Number.isFinite(state.season) ? Math.max(1, Number(state.season)) : base.season,
    matchDay: Number.isFinite(state.matchDay) ? Math.max(0, Number(state.matchDay)) : base.matchDay,
    matchesPerSeason,
    productsBuilt: Number.isFinite(state.productsBuilt) ? Math.max(0, Number(state.productsBuilt)) : base.productsBuilt,
    revenueTotal: toCurrency(state.revenueTotal),
    lastProduct: typeof state.lastProduct === "string" ? state.lastProduct : base.lastProduct,
    livePhase: typeof state.livePhase === "string" && state.livePhase.trim() ? state.livePhase : base.livePhase,
    phaseUpdatedAt: typeof state.phaseUpdatedAt === "string" ? state.phaseUpdatedAt : base.phaseUpdatedAt,
    activeProjects: Array.isArray(state.activeProjects)
      ? state.activeProjects.map((project) => normalizeProject(project)).slice(0, MAX_ACTIVE_PROJECTS)
      : base.activeProjects,
    youthProjects: Array.isArray(state.youthProjects)
      ? state.youthProjects.map((project) => normalizeProject(project)).slice(0, MAX_YOUTH_PROJECTS)
      : base.youthProjects,
    history: Array.isArray(state.history) ? state.history.slice(0, MAX_HISTORY) : base.history,
    seasonStats: {
      productsBuilt: Number.isFinite(state?.seasonStats?.productsBuilt) ? Math.max(0, Number(state.seasonStats.productsBuilt)) : 0,
      revenueTotal: toCurrency(state?.seasonStats?.revenueTotal),
      matchesPlayed: Number.isFinite(state?.seasonStats?.matchesPlayed) ? Math.max(0, Number(state.seasonStats.matchesPlayed)) : 0,
    },
    seasonHistory: Array.isArray(state.seasonHistory) ? state.seasonHistory.slice(0, MAX_SEASON_HISTORY) : base.seasonHistory,
  }
}

function readState() {
  ensureDir(path.dirname(SIMULATION_STATE_PATH))

  if (!fs.existsSync(SIMULATION_STATE_PATH)) {
    const initialState = createDefaultState()
    fs.writeFileSync(SIMULATION_STATE_PATH, JSON.stringify(initialState, null, 2), "utf8")
    return initialState
  }

  try {
    return normalizeState(JSON.parse(fs.readFileSync(SIMULATION_STATE_PATH, "utf8")))
  } catch {
    return createDefaultState()
  }
}

function writeState(nextState) {
  ensureDir(path.dirname(SIMULATION_STATE_PATH))
  fs.writeFileSync(SIMULATION_STATE_PATH, JSON.stringify(normalizeState(nextState), null, 2), "utf8")
}

function mutateState(mutator) {
  const state = readState()
  const nextState = normalizeState(mutator(state) || state)
  writeState(nextState)
  return nextState
}

function addHistoryEntry(state, entry = {}) {
  state.history = [
    {
      history_id: buildId("history"),
      event: typeof entry.event === "string" ? entry.event : "recorded",
      topic: typeof entry.topic === "string" ? entry.topic : "untitled",
      slug: typeof entry.slug === "string" ? entry.slug : slugify(entry.topic),
      season: Number.isFinite(entry.season) ? entry.season : state.season,
      matchDay: Number.isFinite(entry.matchDay) ? entry.matchDay : state.matchDay,
      revenueEstimate: toCurrency(entry.revenueEstimate),
      source: typeof entry.source === "string" ? entry.source : "simulation",
      status: typeof entry.status === "string" ? entry.status : "active",
      createdAt: new Date().toISOString(),
    },
    ...state.history,
  ].slice(0, MAX_HISTORY)
}

function seedYouthProjects(state, topic, source) {
  const trimmedTopic = typeof topic === "string" && topic.trim() ? topic.trim() : "untitled"
  const existingSlugs = new Set([
    ...state.youthProjects.map((project) => project.slug),
    ...state.activeProjects.map((project) => project.slug),
  ])
  const candidateTopics = [
    trimmedTopic,
    `${trimmedTopic} premium follow-up`,
    `${trimmedTopic} video cutdown`,
    `${trimmedTopic} email sequence`,
  ]

  for (const candidateTopic of candidateTopics) {
    const slug = slugify(candidateTopic)
    if (existingSlugs.has(slug)) {
      continue
    }

    state.youthProjects.push(normalizeProject({
      project_id: buildId("youth"),
      topic: candidateTopic,
      slug,
      origin: candidateTopic === trimmedTopic ? "scout:primary" : "scout:derivative",
      source,
      status: "queued",
      season: state.season,
      matchDay: state.matchDay,
    }, candidateTopic))
    existingSlugs.add(slug)
  }

  state.youthProjects = state.youthProjects.slice(0, MAX_YOUTH_PROJECTS)
}

function promoteYouthProject(state, topic, matchId, source) {
  const preferredSlug = slugify(topic)
  const preferredIndex = state.youthProjects.findIndex((project) => project.slug === preferredSlug)
  const projectIndex = preferredIndex >= 0 ? preferredIndex : 0
  const [selectedProject] = state.youthProjects.splice(projectIndex, 1)
  const promotedProject = normalizeProject({
    ...(selectedProject || { topic, slug: preferredSlug }),
    status: "active",
    source,
    match_id: matchId,
    promotedAt: new Date().toISOString(),
    season: state.season,
    matchDay: state.matchDay,
  }, topic)

  state.activeProjects = [promotedProject, ...state.activeProjects.filter((project) => project.match_id !== matchId)]
    .slice(0, MAX_ACTIVE_PROJECTS)

  return promotedProject
}

function rolloverSeason(state) {
  state.seasonHistory = [
    {
      season: state.season,
      matchesPlayed: state.seasonStats.matchesPlayed,
      productsBuilt: state.seasonStats.productsBuilt,
      revenueTotal: toCurrency(state.seasonStats.revenueTotal),
      completedAt: new Date().toISOString(),
    },
    ...state.seasonHistory,
  ].slice(0, MAX_SEASON_HISTORY)

  state.season += 1
  state.matchDay = 0
  state.activeProjects = []
  state.seasonStats = {
    productsBuilt: 0,
    revenueTotal: 0,
    matchesPlayed: 0,
  }
}

function clearPhaseTimers(matchId) {
  const timers = phaseTimers.get(matchId) || []
  timers.forEach((timerId) => clearTimeout(timerId))
  phaseTimers.delete(matchId)
}

function setLivePhase(phase) {
  mutateState((state) => {
    state.livePhase = phase
    state.phaseUpdatedAt = new Date().toISOString()
    return state
  })
}

function scheduleLivePhases(matchId, phases = []) {
  clearPhaseTimers(matchId)

  const timers = phases.map(({ delayMs, phase }) => setTimeout(() => {
    setLivePhase(phase)
  }, delayMs))

  phaseTimers.set(matchId, timers)
}

export function getSimulationStatus() {
  const state = readState()
  return {
    season: state.season,
    matchDay: state.matchDay,
    productsBuilt: state.productsBuilt,
    revenueTotal: state.revenueTotal,
    lastProduct: state.lastProduct,
    youthQueue: state.youthProjects.length,
    livePhase: state.livePhase,
    phaseUpdatedAt: state.phaseUpdatedAt,
    matchesPerSeason: state.matchesPerSeason,
    activeProjects: state.activeProjects,
    youthProjects: state.youthProjects,
    history: state.history,
    seasonHistory: state.seasonHistory,
  }
}

export function recordSimulationMatchStart({ matchId, topic, source = "engine" } = {}) {
  if (typeof matchId !== "string" || !matchId.trim()) {
    return getSimulationStatus()
  }

  const nextState = mutateState((state) => {
    if (state.matchDay >= state.matchesPerSeason) {
      rolloverSeason(state)
    }

    state.matchDay += 1
    state.seasonStats.matchesPlayed += 1
    seedYouthProjects(state, topic, source)
    const promotedProject = promoteYouthProject(state, topic, matchId, source)
    state.livePhase = DEFAULT_LIVE_PHASE
    state.phaseUpdatedAt = new Date().toISOString()

    addHistoryEntry(state, {
      event: "match_started",
      topic: promotedProject.topic,
      slug: promotedProject.slug,
      source,
      status: "active",
      season: state.season,
      matchDay: state.matchDay,
    })

    return state
  })

  scheduleLivePhases(matchId, [
    { delayMs: 0, phase: "[SCOUTING]" },
    { delayMs: 700, phase: "[MATCH START]" },
    { delayMs: 1400, phase: "[BUILDING]" },
  ])

  return nextState
}

export function recordSimulationMatchCompletion({ matchId, topic, slug, revenueEstimate = 0, source = "engine" } = {}) {
  if (typeof matchId !== "string" || !matchId.trim()) {
    return getSimulationStatus()
  }

  const nextState = mutateState((state) => {
    const normalizedRevenue = toCurrency(revenueEstimate)
    const nextSlug = typeof slug === "string" && slug.trim() ? slug.trim() : slugify(topic)
    const nextTopic = typeof topic === "string" && topic.trim() ? topic.trim() : nextSlug

    state.productsBuilt += 1
    state.revenueTotal = toCurrency(state.revenueTotal + normalizedRevenue)
    state.lastProduct = nextSlug
    state.seasonStats.productsBuilt += 1
    state.seasonStats.revenueTotal = toCurrency(state.seasonStats.revenueTotal + normalizedRevenue)
    state.activeProjects = state.activeProjects.map((project) => project.match_id === matchId
      ? normalizeProject({
          ...project,
          topic: nextTopic,
          slug: nextSlug,
          status: "deployed",
          revenueEstimate: normalizedRevenue,
          completedAt: new Date().toISOString(),
        }, nextTopic)
      : project)

    addHistoryEntry(state, {
      event: "revenue_recorded",
      topic: nextTopic,
      slug: nextSlug,
      source,
      status: "complete",
      season: state.season,
      matchDay: state.matchDay,
      revenueEstimate: normalizedRevenue,
    })

    return state
  })

  scheduleLivePhases(matchId, [
    { delayMs: 0, phase: "[DEPLOYED]" },
    { delayMs: 850, phase: "[REVENUE UPDATE]" },
    { delayMs: 2200, phase: DEFAULT_LIVE_PHASE },
  ])

  return nextState
}

export function recordSimulationMatchFailure({ matchId, topic, source = "engine" } = {}) {
  if (typeof matchId !== "string" || !matchId.trim()) {
    return getSimulationStatus()
  }

  const nextState = mutateState((state) => {
    state.activeProjects = state.activeProjects.map((project) => project.match_id === matchId
      ? normalizeProject({
          ...project,
          topic,
          status: "failed",
        }, topic)
      : project)

    addHistoryEntry(state, {
      event: "match_failed",
      topic,
      slug: slugify(topic),
      source,
      status: "failed",
      season: state.season,
      matchDay: state.matchDay,
    })

    state.livePhase = DEFAULT_LIVE_PHASE
    state.phaseUpdatedAt = new Date().toISOString()
    return state
  })

  scheduleLivePhases(matchId, [
    { delayMs: 0, phase: "[MATCH FAILED]" },
    { delayMs: 1800, phase: DEFAULT_LIVE_PHASE },
  ])

  return nextState
}