"use strict";

// T9 key layout; umlauts sit on the key of their base letter.
const KEYS = {
  2: "abcä", 3: "def", 4: "ghi", 5: "jkl",
  6: "mnoö", 7: "pqrsß", 8: "tuvü", 9: "wxyz",
};
const LETTER_TO_DIGIT = {};
for (const [digit, letters] of Object.entries(KEYS)) {
  for (const ch of letters) LETTER_TO_DIGIT[ch] = digit;
}

const MAX_DIGITS = 20;
const MAX_WORD_LEN = 12;
const BEAM = 40;          // partial solutions kept per position
const WORDS_PER_SLOT = 3; // most frequent words tried per digit span
const RAW_COST = 10;      // per digit left uncovered
const WORD_COST = 3;      // per word used

const dictionaries = {};  // lang -> Promise<{ index: Map<digits, [{word, rank}]> }>

function toDigits(word) {
  let out = "";
  for (const ch of word) out += LETTER_TO_DIGIT[ch];
  return out;
}

function loadDictionary(lang) {
  if (!dictionaries[lang]) {
    dictionaries[lang] = fetch(`words/${lang}.txt`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const index = new Map();
        text.split("\n").forEach((word, rank) => {
          if (!word || word.length > MAX_WORD_LEN) return;
          const key = toDigits(word);
          if (!index.has(key)) index.set(key, []);
          index.get(key).push({ word, rank });
        });
        return { index };
      })
      .catch((err) => {
        delete dictionaries[lang];
        throw err;
      });
  }
  return dictionaries[lang];
}

// Turns any input (also "1-800-FLOWERS") into a plain digit string.
function normalizeNumber(input) {
  let out = "";
  for (const ch of input.toLowerCase()) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (LETTER_TO_DIGIT[ch]) out += LETTER_TO_DIGIT[ch];
  }
  return out.slice(0, MAX_DIGITS);
}

function wordsAt(index, digits, i, minLen) {
  const found = [];
  for (let j = i + minLen; j <= Math.min(digits.length, i + MAX_WORD_LEN); j++) {
    const words = index.get(digits.slice(i, j));
    if (words) found.push({ j, words });
  }
  return found;
}

function rankPenalty(rank) {
  return Math.log2(rank + 2) * 0.3;
}

// Beam search from the end of the number: best[i] holds the cheapest ways to
// spell digits[i..]. A segment is either a word or a run of plain digits.
function findCombinations(index, digits, minLen) {
  const n = digits.length;
  const best = new Array(n + 1);
  best[n] = [{ cost: 0, segs: [] }];

  for (let i = n - 1; i >= 0; i--) {
    const options = [];

    for (const rest of best[i + 1]) {
      const segs = rest.segs.slice();
      if (segs.length && segs[0].raw) segs[0] = { raw: digits[i] + segs[0].raw };
      else segs.unshift({ raw: digits[i] });
      options.push({ cost: rest.cost + RAW_COST, segs });
    }

    for (const { j, words } of wordsAt(index, digits, i, minLen)) {
      for (const { word, rank } of words.slice(0, WORDS_PER_SLOT)) {
        const cost = WORD_COST + rankPenalty(rank);
        for (const rest of best[j]) {
          options.push({ cost: rest.cost + cost, segs: [{ word }, ...rest.segs] });
        }
      }
    }

    options.sort((a, b) => a.cost - b.cost);
    const seen = new Set();
    best[i] = [];
    for (const opt of options) {
      const key = opt.segs.map((s) => s.word || s.raw).join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      best[i].push(opt);
      if (best[i].length >= BEAM) break;
    }
  }

  return best[0].filter((c) => c.segs.some((s) => s.word));
}

function findSingleWords(index, digits, minLen) {
  const byWord = new Map();
  for (let i = 0; i < digits.length; i++) {
    for (const { j, words } of wordsAt(index, digits, i, minLen)) {
      for (const { word, rank } of words) {
        if (!byWord.has(word)) byWord.set(word, { word, rank, start: i, end: j });
      }
    }
  }
  return [...byWord.values()].sort(
    (a, b) => b.word.length - a.word.length || a.rank - b.rank
  );
}

// toUpperCase() would turn ß into "SS" and break the digit alignment.
function upper(word) {
  return word.replace(/[^ß]/g, (ch) => ch.toUpperCase());
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// ---- UI ----

const $number = document.getElementById("number");
const $minlen = document.getElementById("minlen");
const $status = document.getElementById("status");
const $combos = document.getElementById("combos");
const $words = document.getElementById("words");
const $combosSection = document.getElementById("combos-section");
const $wordsSection = document.getElementById("words-section");
const $langButtons = document.querySelectorAll("[data-lang]");

let lang = "de";
try {
  const saved = localStorage.getItem("phonewords.lang");
  if (saved === "de" || saved === "en") lang = saved;
} catch {}

function setLang(next) {
  lang = next;
  $langButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  try { localStorage.setItem("phonewords.lang", lang); } catch {}
  update();
}

function renderCombos(combos) {
  $combos.replaceChildren();
  for (const combo of combos.slice(0, 25)) {
    const li = el("li");
    combo.segs.forEach((seg, k) => {
      if (k > 0) li.append(el("span", "sep", "-"));
      li.append(seg.word ? el("span", "w", upper(seg.word)) : el("span", "d", seg.raw));
    });
    $combos.append(li);
  }
  $combosSection.hidden = combos.length === 0;
}

function renderWords(digits, words) {
  $words.replaceChildren();
  for (const { word, start, end } of words.slice(0, 150)) {
    const li = el("li");
    li.append(el("strong", null, upper(word)));
    const ctx = el("span", "ctx");
    ctx.append(digits.slice(0, start), el("mark", null, upper(word)), digits.slice(end));
    li.append(ctx);
    $words.append(li);
  }
  $wordsSection.hidden = words.length === 0;
}

let requestId = 0;

async function update() {
  const id = ++requestId;
  const digits = normalizeNumber($number.value);
  const minLen = Number($minlen.value);

  if (!digits) {
    $status.textContent = "";
    renderCombos([]);
    renderWords("", []);
    return;
  }

  let dict;
  try {
    if (!dictionaries[lang]) $status.textContent = "Lade Wörterbuch …";
    dict = await loadDictionary(lang);
  } catch (err) {
    if (id === requestId) $status.textContent = `Wörterbuch konnte nicht geladen werden (${err.message}).`;
    return;
  }
  if (id !== requestId) return;

  const combos = findCombinations(dict.index, digits, minLen);
  const words = findSingleWords(dict.index, digits, minLen);
  renderCombos(combos);
  renderWords(digits, words);

  $status.textContent = words.length
    ? `${words.length} ${words.length === 1 ? "Wort" : "Wörter"} gefunden in ${digits}.`
    : `Keine Wörter gefunden in ${digits} – probier eine kleinere Wortlänge oder die andere Sprache.`;
}

let debounce;
$number.addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(update, 120);
});
$minlen.addEventListener("change", update);
$langButtons.forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  update();
});

setLang(lang);
loadDictionary(lang).catch(() => {});
