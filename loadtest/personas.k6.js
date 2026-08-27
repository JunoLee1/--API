/*
 * Football ERP — Persona-based k6 Load Test
 *
 * 7 개 대표 페르소나 (HR/Coach/Finance/Asset/GM/Player/Medical) 를 seed 유저로 로그인 후
 * 각자 대표 read workflow 를 병렬 실행. 읽기 중심 (idempotent) 로 side-effect 최소화.
 *
 * Usage:
 *   BASE_URL=http://localhost:3001/api VUS=10 DURATION=30s \
 *     k6 run loadtest/personas.k6.js --summary-export=loadtest/summary.json
 *
 * CI: .github/workflows/loadtest.yml 에서 자동 실행 (nightly + manual dispatch)
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend, Counter } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api'
const VUS = parseInt(__ENV.VUS || '10', 10)
const DURATION = __ENV.DURATION || '30s'

// Custom metrics — per-persona latency + error tracking
const personaLatency = new Trend('persona_latency', true)
const personaErrors = new Counter('persona_errors')

const PERSONAS = [
  {
    name: 'HR_MANAGER',
    email: 'hr@club.com',
    endpoints: [
      { path: '/hiring-surveys', label: 'list_surveys' },
      { path: '/plan-reports', label: 'list_plan_reports' },
      { path: '/recruitment/job-postings', label: 'list_postings' },
    ],
  },
  {
    name: 'HEAD_COACH',
    email: 'coach@club.com',
    endpoints: [
      { path: '/training', label: 'list_training_sessions' },
      { path: '/players', label: 'list_players' },
      { path: '/tactical', label: 'list_tactical' },
    ],
  },
  {
    name: 'FINANCE_MANAGER',
    email: 'finance@club.com',
    endpoints: [
      { path: '/operating-expense', label: 'list_operating_expense' },
      { path: '/budget-plan', label: 'list_budget_plans' },
      { path: '/financial-report', label: 'list_financial_reports' },
    ],
  },
  {
    name: 'ASSET_MANAGER',
    email: 'asset@club.com',
    endpoints: [
      { path: '/equipment', label: 'list_equipment_items' },
      { path: '/asset-request', label: 'list_asset_requests' },
      { path: '/equipment/loans', label: 'list_equipment_loans' },
    ],
  },
  {
    name: 'GM',
    email: 'gm@club.com',
    endpoints: [
      { path: '/plan-reports?filter=pending-final', label: 'list_pending_plan_reports' },
      { path: '/report?filter=pending-final', label: 'list_pending_reports' },
      { path: '/hiring-dispatch?filter=pending-dispatch', label: 'list_pending_dispatches' },
    ],
  },
  {
    name: 'PLAYER',
    email: 'player@club.com',
    endpoints: [
      { path: '/players/me', label: 'my_profile' },
      { path: '/training', label: 'list_training_sessions' },
      { path: '/notifications', label: 'list_notifications' },
    ],
  },
  {
    name: 'MEDICAL_DIRECTOR',
    email: 'meddir@club.com',
    endpoints: [
      { path: '/injuries', label: 'list_injuries' },
      { path: '/medical-equipment-loan', label: 'list_medical_equipment_loans' },
      { path: '/medical-expenses', label: 'list_medical_expenses' },
    ],
  },
]

const PASSWORD = 'Password1!'

// -----------------------------------------------------------------------------
// setup: sequentially login each persona (respecting rate limit) → save tokens
// -----------------------------------------------------------------------------
export function setup() {
  const tokens = {}
  for (const persona of PERSONAS) {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: persona.email, password: PASSWORD }),
      { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } }
    )
    if (res.status !== 200) {
      console.error(`Login failed for ${persona.name} (${persona.email}): ${res.status} ${res.body}`)
      continue
    }
    // Extract access-token cookie
    const setCookie = res.headers['Set-Cookie'] || ''
    const match = /access-token=([^;]+)/.exec(setCookie)
    if (match) {
      tokens[persona.name] = match[1]
      console.log(`Setup: ${persona.name} logged in`)
    } else {
      console.error(`No access-token cookie for ${persona.name}`)
    }
    // Small delay to spread login rate limit window
    sleep(0.2)
  }
  return { tokens }
}

// -----------------------------------------------------------------------------
// main: each VU picks a persona (round-robin) and runs its workflow
// -----------------------------------------------------------------------------
export default function (data) {
  const idx = (__VU - 1) % PERSONAS.length
  const persona = PERSONAS[idx]
  const token = data.tokens[persona.name]
  if (!token) {
    console.error(`No token for ${persona.name} — skipping VU=${__VU}`)
    return
  }
  const headers = {
    Cookie: `access-token=${token}`,
  }

  group(persona.name, () => {
    for (const ep of persona.endpoints) {
      const url = `${BASE_URL}${ep.path}`
      const res = http.get(url, {
        headers,
        tags: { persona: persona.name, endpoint: ep.label },
      })
      const ok = check(res, {
        [`${persona.name} ${ep.label} status<500`]: (r) => r.status < 500,
      })
      personaLatency.add(res.timings.duration, { persona: persona.name, endpoint: ep.label })
      if (!ok) {
        personaErrors.add(1, { persona: persona.name, endpoint: ep.label })
      }
    }
  })

  sleep(1)
}

// -----------------------------------------------------------------------------
// options
// -----------------------------------------------------------------------------
export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% requests under 2s
    http_req_failed: ['rate<0.10'],    // <10% requests fail
    persona_errors: ['count<50'],      // total per-persona errors bound
  },
}
