import express from 'express';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { generateCodes } from './generator.js';

const app = express();
app.use(express.json({ limit: '256kb' }));

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
  const requestId = randomUUID();

  if (!req.is('application/json')) {
    return errorResponse(res, 400, 'INVALID_JSON', 'Content-Type must be application/json');
  }

  const body = req.body || {};
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
    const combinedContext = campaignDescription
      ? `${campaignName} ${campaignDescription}`
      : campaignName;

    const candidates = generateCodes(combinedContext, {
      minLen,
      maxLen,
      includeYear,
      count,
    });

    const elapsedMs = Math.round(performance.now() - started);
    return res.json({
      ok: true,
      data: {
        campaign_name: campaignName,
        campaign_description: campaignDescription,
        generated_code: candidates[0],
        candidates,
        generation_mode: 'rules_only',
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
