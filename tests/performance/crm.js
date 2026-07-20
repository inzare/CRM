import { check, sleep } from 'k6';
import http from 'k6/http';
export const options = {
  scenarios: {
    crm: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || '1m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1'],
  },
};
const base = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const email = __ENV.EMAIL || 'sales@consultflow.local';
const password = __ENV.PASSWORD || 'ConsultFlow!2026';
export function setup() {
  const login = http.post(`${base}/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(login, { 'setup login succeeds': (r) => r.status === 200 });
  const token = login.json('accessToken');
  const companies = http.get(`${base}/companies?pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const stages = http.get(`${base}/pipeline-stages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { token, companyId: companies.json('data.0.id'), stageId: stages.json('0.id') };
}
export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' };
  const login = http.post(`${base}/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'login' },
  });
  check(login, { 'login 200': (r) => r.status === 200 });
  const companies = http.get(`${base}/companies?search=software&pageSize=25`, {
    headers,
    tags: { name: 'company_search' },
  });
  check(companies, { 'company search 200': (r) => r.status === 200 });
  const pipeline = http.get(`${base}/pipeline`, { headers, tags: { name: 'pipeline' } });
  check(pipeline, { 'pipeline 200': (r) => r.status === 200 });
  const opportunity = http.post(
    `${base}/opportunities`,
    JSON.stringify({
      name: `k6 opportunity ${__VU}-${__ITER}`,
      companyId: data.companyId,
      stageId: data.stageId,
      expectedValue: '10000',
      probability: 10,
      closeDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    }),
    { headers, tags: { name: 'opportunity_create' } },
  );
  check(opportunity, { 'opportunity create 201': (r) => r.status === 201 });
  sleep(1);
}
