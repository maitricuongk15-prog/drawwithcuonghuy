import { NativeModules, Platform } from 'react-native';

const SERVER_PORT = 3001;
const DEFAULT_PROD_SERVER_URL = 'https://drawwithcuonghuy.onrender.com';
const DEFAULT_DEV_LAN_URL = 'http://192.168.1.14:3001';

let activeServerUrl = '';

function normalizeUrl(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/\/+$/, '');
}

function getHostFromScriptUrl() {
  try {
    const scriptUrl = NativeModules?.SourceCode?.scriptURL;
    if (!scriptUrl) {
      return '';
    }
    return new URL(scriptUrl).hostname || '';
  } catch {
    return '';
  }
}

function isDevelopmentRuntime() {
  if (typeof __DEV__ === 'boolean') {
    return __DEV__;
  }
  return process.env.NODE_ENV !== 'production';
}

function getDevelopmentLanUrl() {
  const envDevUrl = normalizeUrl(process.env.EXPO_PUBLIC_DEV_LAN_URL);
  if (envDevUrl) {
    return envDevUrl;
  }
  return isDevelopmentRuntime() ? normalizeUrl(DEFAULT_DEV_LAN_URL) : '';
}

export function getServerCandidates() {
  const envUrl = normalizeUrl(process.env.EXPO_PUBLIC_SERVER_URL);
  const isDev = isDevelopmentRuntime();
  const prodFallbackUrl = !isDev ? normalizeUrl(DEFAULT_PROD_SERVER_URL) : '';
  const primaryUrl = envUrl || prodFallbackUrl;
  const scriptHost = isDev ? getHostFromScriptUrl() : '';
  const autoDevUrl = scriptHost ? `http://${scriptHost}:${SERVER_PORT}` : '';
  const emulatorUrl = isDev && Platform.OS === 'android' ? `http://10.0.2.2:${SERVER_PORT}` : '';
  const localhostUrl = isDev ? `http://localhost:${SERVER_PORT}` : '';
  const loopbackUrl = isDev ? `http://127.0.0.1:${SERVER_PORT}` : '';
  const devLanUrl = getDevelopmentLanUrl();

  // Keep production focused on EXPO_PUBLIC_SERVER_URL and avoid stale local fallbacks.
  const basePriority = [
    normalizeUrl(activeServerUrl),
    normalizeUrl(primaryUrl),
    envUrl,
    normalizeUrl(autoDevUrl),
    normalizeUrl(emulatorUrl),
    normalizeUrl(localhostUrl),
    normalizeUrl(loopbackUrl),
  ];

  const candidates = [...basePriority, devLanUrl].filter(Boolean);

  return [...new Set(candidates)];
}

export function setActiveServerUrl(url) {
  activeServerUrl = normalizeUrl(url);
}

export function getActiveServerUrl() {
  const [firstCandidate] = getServerCandidates();
  return firstCandidate || '';
}

// Backward-compatible export for existing imports.
export const SERVER_URL = getActiveServerUrl();

