import {
  getActiveServerUrl,
  getServerCandidates,
  setActiveServerUrl,
} from '../config/server';

const REQUEST_TIMEOUT_MS = 3000;

async function requestJsonAgainst(baseUrl, path, { method = 'GET', payload, timeoutMs } = {}) {
  const controller = new AbortController();
  const requestTimeout = Math.max(500, Number(timeoutMs) || REQUEST_TIMEOUT_MS);
  const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    };
    if (payload !== undefined) {
      options.body = JSON.stringify(payload);
    }

    const url = `${baseUrl}${path}`;
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const bodyText = (await response.text()).replace(/\s+/g, ' ').trim();
      const preview = bodyText.slice(0, 180);
      const detail = preview ? ` Body: ${preview}` : '';
      throw new Error(
        `Server returned non-JSON response (${response.status} ${response.statusText}) at ${url}.${detail}`
      );
    }

    const data = await response.json();
    return { response, data, baseUrl };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout at ${baseUrl}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requestJson(path, options) {
  const candidates = getServerCandidates();
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const result = await requestJsonAgainst(baseUrl, path, options);
      setActiveServerUrl(baseUrl);
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  const hintUrl = getActiveServerUrl() || candidates[0] || 'N/A';
  const tried = candidates.length ? candidates.join(', ') : 'N/A';
  const rootMessage = lastError?.message || 'Unknown connection error';
  throw new Error(
    `Cannot reach server (${rootMessage}). Last tried: ${hintUrl}. Candidates: ${tried}`
  );
}
