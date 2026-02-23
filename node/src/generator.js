const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

function cleanTokens(name) {
  return (name.toUpperCase().match(/[A-Z0-9]+/g) || []).filter(Boolean);
}

function acronymHints(raw) {
  const hints = raw.match(/\b[A-Z]{2,5}\b/g) || [];
  const seen = new Set();
  const out = [];
  for (const h of hints) {
    if (!seen.has(h)) {
      out.push(h);
      seen.add(h);
    }
  }
  return out;
}

function extractYear(tokens) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (/^\d{4}$/.test(t)) return t;
  }
  return '';
}

function lettersOnly(tokens) {
  return tokens
    .map((t) => t.replace(/[^A-Z]/g, ''))
    .filter(Boolean);
}

function pronounceabilityScore(code) {
  const letters = code.replace(/[^A-Z]/g, '');
  if (!letters) return 0;
  let v = 0;
  for (const ch of letters) if (VOWELS.has(ch)) v += 1;
  const ratio = v / Math.max(letters.length, 1);
  return 1.0 - Math.min(Math.abs(ratio - 0.45), 0.45) / 0.45;
}

function readabilityScore(code) {
  const badPairs = ['00', '11', 'O0', '0O', 'I1', '1I'];
  let penalty = 0;
  for (const bp of badPairs) if (code.includes(bp)) penalty += 0.2;
  const mix = /[A-Z]/.test(code) && /\d/.test(code);
  return Math.max(0, (mix ? 1.0 : 0.6) - penalty);
}

function lengthScore(code, minLen, maxLen) {
  const ideal = (minLen + maxLen) / 2;
  return Math.max(0, 1.0 - Math.abs(code.length - ideal) / Math.max(ideal, 1));
}

function score(code, minLen, maxLen) {
  return (
    0.45 * pronounceabilityScore(code) +
    0.35 * readabilityScore(code) +
    0.2 * lengthScore(code, minLen, maxLen)
  );
}

function randomDigit() {
  const digits = '23456789';
  return digits[Math.floor(Math.random() * digits.length)];
}

function fit(code, minLen, maxLen) {
  let c = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length > maxLen) c = c.slice(0, maxLen);
  while (c.length < minLen) c += randomDigit();
  return c;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(arr, k) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < k) {
    const idx = randInt(0, copy.length - 1);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

export function generateCodes(
  campaignName,
  { minLen = 6, maxLen = 12, includeYear = true, count = 8 } = {}
) {
  if (minLen < 6 || maxLen > 12 || minLen > maxLen) {
    throw new Error('length bounds must be within 6-12 and min<=max');
  }

  const raw = campaignName || '';
  const tokens = cleanTokens(raw);
  if (!tokens.length) throw new Error('campaign_name must contain letters or digits');

  const hints = acronymHints(raw);
  const year = includeYear ? extractYear(tokens) : '';
  const year2 = year ? year.slice(-2) : '';
  const words = lettersOnly(tokens);

  const cands = new Set();
  const priority = [];
  for (const a of hints) {
    if (year) priority.push(a + year);
    if (year2) priority.push(a + year2);
    priority.push(a + String(randInt(20, 99)));
  }

  if (words.length) {
    const acronym = words.map((w) => w[0]).join('');
    cands.add(acronym + year);
    cands.add(acronym + year2);

    if (words.length >= 2) {
      cands.add(words[0].slice(0, 2) + words[1].slice(0, 2) + year2);
      cands.add(words[0].slice(0, 3) + words.at(-1).slice(0, 2) + year2);
      cands.add(words[0].slice(0, 2) + words.at(-1).slice(0, 2) + year);
    }

    const main = words[0];
    cands.add(main.slice(0, 4) + year2);
    cands.add(main.slice(0, 3) + (words[1]?.slice(0, 2) || '') + year2);

    if (words.length >= 3) {
      cands.add(words[0].slice(0, 2) + words[1].slice(0, 2) + words[2].slice(0, 2) + year2);
      cands.add(words[0][0] + words[1].slice(0, 2) + words[2].slice(0, 2) + year);
    }
  }

  for (let i = 0; i < 24; i++) {
    const pickCount = Math.min(words.length, [1, 2, 3][randInt(0, 2)]);
    const pick = sample(words, pickCount);
    const frag = pick.map((w) => w.slice(0, [1, 2, 3][randInt(0, 2)])).join('');
    const suffixChoices = [year, year2, String(randInt(20, 99)), String(randInt(2000, 2099))].filter(Boolean);
    const suffix = suffixChoices[randInt(0, suffixChoices.length - 1)] || String(randInt(20, 99));
    cands.add(frag + suffix);
  }

  const normalized = [...cands]
    .map((c) => fit(c, minLen, maxLen))
    .filter((c) => c.length >= minLen && c.length <= maxLen);

  const ranked = [...new Set(normalized)].sort((a, b) => score(b, minLen, maxLen) - score(a, minLen, maxLen));

  const ordered = [];
  const seen = new Set();
  for (const p of priority) {
    const fitted = fit(p, minLen, maxLen);
    if (!seen.has(fitted)) {
      ordered.push(fitted);
      seen.add(fitted);
    }
  }
  for (const c of ranked) {
    if (!seen.has(c)) {
      ordered.push(c);
      seen.add(c);
    }
  }

  return ordered.slice(0, count);
}
