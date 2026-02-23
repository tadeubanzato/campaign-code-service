import re
import random
from typing import List, Optional

VOWELS = set("AEIOU")


def _clean_tokens(name: str) -> List[str]:
    parts = re.findall(r"[A-Za-z0-9]+", name.upper())
    return [p for p in parts if p]


def _extract_year(tokens: List[str]) -> str:
    for t in reversed(tokens):
        if t.isdigit() and len(t) == 4:
            return t
    return ""


def _letters_only(tokens: List[str]) -> List[str]:
    out = []
    for t in tokens:
        s = re.sub(r"[^A-Z]", "", t)
        if s:
            out.append(s)
    return out


def _pronounceability_score(code: str) -> float:
    letters = ''.join(ch for ch in code if ch.isalpha())
    if not letters:
        return 0
    v = sum(ch in VOWELS for ch in letters)
    ratio = v / max(len(letters), 1)
    # sweet spot around 0.35-0.55
    return 1.0 - min(abs(ratio - 0.45), 0.45) / 0.45


def _readability_score(code: str) -> float:
    bad_pairs = ["00", "11", "O0", "0O", "I1", "1I"]
    penalty = sum(bp in code for bp in bad_pairs) * 0.2
    mix = (any(c.isalpha() for c in code) and any(c.isdigit() for c in code))
    return max(0.0, (1.0 if mix else 0.6) - penalty)


def _length_score(code: str, min_len: int, max_len: int) -> float:
    ideal = (min_len + max_len) / 2
    return max(0.0, 1.0 - abs(len(code) - ideal) / max(ideal, 1))


def _score(code: str, min_len: int, max_len: int) -> float:
    return (
        0.45 * _pronounceability_score(code)
        + 0.35 * _readability_score(code)
        + 0.20 * _length_score(code, min_len, max_len)
    )


def _fit(code: str, min_len: int, max_len: int) -> str:
    code = re.sub(r"[^A-Z0-9]", "", code.upper())
    if len(code) > max_len:
        code = code[:max_len]
    while len(code) < min_len:
        code += random.choice("23456789")
    return code


def generate_codes(
    campaign_name: str,
    min_len: int = 6,
    max_len: int = 12,
    include_year: bool = True,
    count: int = 8,
    seed: Optional[int] = None,
) -> List[str]:
    if seed is not None:
        random.seed(seed)

    if min_len < 6 or max_len > 12 or min_len > max_len:
        raise ValueError("length bounds must be within 6-12 and min<=max")

    tokens = _clean_tokens(campaign_name)
    if not tokens:
        raise ValueError("campaign_name must contain letters or digits")

    year = _extract_year(tokens) if include_year else ""
    year2 = year[-2:] if year else ""
    words = _letters_only(tokens)

    cands = set()

    # patterns
    if words:
        acronym = ''.join(w[0] for w in words if w)
        cands.add(acronym + year)
        cands.add(acronym + year2)

        if len(words) >= 2:
            cands.add(words[0][:2] + words[1][:2] + year2)
            cands.add(words[0][:3] + words[-1][:2] + year2)
            cands.add(words[0][:2] + words[-1][:2] + year)

        main = words[0]
        cands.add(main[:4] + year2)
        cands.add(main[:3] + (words[1][:2] if len(words) > 1 else "") + year2)

        if len(words) >= 3:
            cands.add(words[0][:2] + words[1][:2] + words[2][:2] + year2)
            cands.add(words[0][0] + words[1][:2] + words[2][:2] + year)

    # fallback random blends
    for _ in range(24):
        pick = random.sample(words, k=min(len(words), random.choice([1, 2, 3])))
        frag = ''.join(w[:random.choice([1, 2, 3])] for w in pick)
        suffix = random.choice([year, year2, str(random.randint(20, 99)), str(random.randint(2000, 2099))])
        cands.add(frag + suffix)

    normalized = [_fit(c, min_len, max_len) for c in cands]
    normalized = [c for c in normalized if min_len <= len(c) <= max_len]

    ranked = sorted(set(normalized), key=lambda c: _score(c, min_len, max_len), reverse=True)
    return ranked[:count]
