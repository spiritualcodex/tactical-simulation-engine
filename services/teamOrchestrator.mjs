import fs from "node:fs"
import path from "node:path"

const TRANSFER_MARKET_PATH = path.join(process.cwd(), "data", "transfer-market.json")

const DEFAULT_TRANSFER_MARKET = [
  { tool: "Claude", role: "creative", strength: 9 },
  { tool: "Gemini", role: "frontend", strength: 8 },
  { tool: "Codex", role: "backend", strength: 9 },
  { tool: "Autopilot", role: "distribution", strength: 8 },
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

export function getTransferMarket() {
  const market = readJson(TRANSFER_MARKET_PATH, DEFAULT_TRANSFER_MARKET)
  const normalized = Array.isArray(market) && market.length > 0 ? market : DEFAULT_TRANSFER_MARKET
  writeJson(TRANSFER_MARKET_PATH, normalized)
  return normalized
}

function selectBestTool(entries, role, fallback) {
  const candidates = entries
    .filter((entry) => String(entry?.role || "").trim() === role)
    .sort((left, right) => Number(right?.strength || 0) - Number(left?.strength || 0))

  return String(candidates[0]?.tool || fallback)
}

export async function assignBuildTask(idea) {
  const market = getTransferMarket()
  const team = {
    frontend: selectBestTool(market, "frontend", "Gemini"),
    backend: selectBestTool(market, "backend", "Codex"),
    creative: selectBestTool(market, "creative", "Claude"),
    distribution: selectBestTool(market, "distribution", "Autopilot"),
  }

  console.log(`[TEAM] assigned tools: frontend=${team.frontend}, backend=${team.backend}, creative=${team.creative}, distribution=${team.distribution}`)
  return {
    idea,
    team,
  }
}