import { requestJson } from './apiClient';

const AUTH_REQUEST_TIMEOUT_MS = 15000;

export async function registerUser(payload) {
  return requestJson('/api/register', {
    method: 'POST',
    payload,
    timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
  });
}

export async function loginUser(payload) {
  return requestJson('/api/login', {
    method: 'POST',
    payload,
    timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
  });
}
