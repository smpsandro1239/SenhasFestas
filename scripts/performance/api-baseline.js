import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const API_URL = (__ENV.API_URL || 'http://127.0.0.1:3000/api').replace(/\/$/, '');
const EMAIL = __ENV.PERF_EMAIL;
const PASSWORD = __ENV.PERF_PASSWORD;

const loginFailures = new Counter('login_failures');
const catalogFailures = new Counter('catalog_failures');

export const options = {
  scenarios: {
    login_load: {
      executor: 'ramping-vus',
      exec: 'loginFlow',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 30 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
    catalog_load: {
      executor: 'ramping-vus',
      exec: 'catalogFlow',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{endpoint:catalog}': ['p(95)<200', 'p(99)<500'],
    'http_req_duration{endpoint:login}': ['p(95)<1000', 'p(99)<2000'],
    'login_failures': ['count==0'],
    'catalog_failures': ['count==0'],
  },
};

function credentials() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Define PERF_EMAIL e PERF_PASSWORD para uma conta de teste local.');
  }
}

export function loginFlow() {
  credentials();
  const response = http.post(
    `${API_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } },
  );
  const ok = check(response, {
    'login devolve HTTP 200': (r) => r.status === 200,
    'login devolve token': (r) => Boolean(r.json('token')),
  });
  if (!ok) loginFailures.add(1);
  sleep(1);
}

export function catalogFlow() {
  credentials();
  const login = http.post(
    `${API_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } },
  );
  if (login.status !== 200 || !login.json('token')) {
    loginFailures.add(1);
    return;
  }

  const token = login.json('token');
  const response = http.get(`${API_URL}/products?page=1&limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { endpoint: 'catalog' },
  });
  const ok = check(response, {
    'catálogo devolve HTTP 200': (r) => r.status === 200,
    'catálogo devolve items': (r) => Array.isArray(r.json('items')),
  });
  if (!ok) catalogFailures.add(1);
  sleep(1);
}
