import express from 'express';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCodes } from './generator.js';

const app = express();
app.use(express.json({ limit: '256kb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_PATH = path.join(__dirname, 'code_store.json');

function normalizeKey(campaignName, campaignDescription) {
  const n = String(campaignName || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const d = String(campaignDescription || '').trim().toUpperCase().replace(/\s+/g, ' ');
  return `${n}||${d}`;
}

function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function utcNowIso() {
  return new Date().toISOString();
}

function errorResponse(res, status, code, message, details = null) {
  return res.status(status).json({
    ok: false,
    error: { code, message, details },
    meta: { timestamp: utcNowIso(), request_id: randomUUID() },
  });
}

app.get('/health', (_req, res) => {
  return res.json({
    ok: true,
    data: { service: 'campaign-code-service-node', status: 'healthy' },
    meta: { timestamp: utcNowIso(), request_id: randomUUID() },
  });
});

app.post('/generate', (req, res) => {
  const started = performance.now();

  if (!req.is('application/json')) {
    return errorResponse(res, 400, 'INVALID_JSON', 'Content-Type must be application/json');
  }

  const body = req.body || {};
  const requestId = String(body.request_id || '').trim() || randomUUID();
  const campaignName = String(body.campaign_name || '').trim();
  const campaignDescription = String(body.campaign_description || '').trim();
  if (!campaignName) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', 'campaign_name is required');
  }

  let minLen = 6;
  let maxLen = 10;
  let includeYear = true;
  let count = 8;

  try {
    minLen = Number(body.min_len ?? 6);
    maxLen = Number(body.max_len ?? 10);
    includeYear = Boolean(body.include_year ?? true);
    count = Number(body.count ?? 8);
  } catch (e) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid request fields', String(e));
  }

  try {
    const key = normalizeKey(campaignName, campaignDescription);
    const store = loadStore();

    let generatedCode;
    if (store[key]) {
      generatedCode = store[key];
    } else {
      // campaign_name is primary context; description is secondary signal
      const combinedContext = campaignDescription
        ? `${campaignName} ${campaignName} ${campaignDescription}`
        : campaignName;

      const candidates = generateCodes(combinedContext, {
        minLen,
        maxLen,
        includeYear,
        count,
      });

      generatedCode = candidates[0];
      store[key] = generatedCode;
      saveStore(store);
    }

    const elapsedMs = Math.round(performance.now() - started);
    return res.json({
      ok: true,
      data: {
        generated_code: generatedCode,
      },
      meta: {
        timestamp: utcNowIso(),
        request_id: requestId,
        processing_ms: elapsedMs,
      },
    });
  } catch (e) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', e.message || String(e));
  }
});

app.use((_req, res) => errorResponse(res, 404, 'NOT_FOUND', 'Route not found'));

app.use((err, _req, res, _next) => {
  return errorResponse(res, 500, 'INTERNAL_ERROR', 'Unhandled server error', err?.message || null);
});

const PORT = Number(process.env.PORT || 8081);
app.listen(PORT, () => {
  console.log(`campaign-code-service-node listening on :${PORT}`);
});
