#!/usr/bin/env python3
"""Build the word lists in public/words/<lang>.txt (one word per line, most frequent first).

Frequencies come from FrequencyWords (https://github.com/hermitdave/FrequencyWords,
CC-BY-SA 4.0, derived from OpenSubtitles). Subtitles are full of names, typos and
foreign words, so every word must also pass a Hunspell spell check
(dictionaries from https://github.com/wooorm/dictionaries).

Requires: pip install spylls
"""
import re
import tempfile
import urllib.request
from pathlib import Path

from spylls.hunspell import Dictionary

FREQ_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/{lang}/{lang}_full.txt"
DICT_URL = "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/{lang}/index.{ext}"
OUT = Path(__file__).resolve().parent.parent / "public" / "words"
MAX_WORDS = 60000
# Rare short words are mostly abbreviations (fps, esp) and clutter the results.
SHORT_WORD_LEN = 3
SHORT_WORD_MAX_RANK = 8000

LANGS = {
    # German nouns are capitalized in the dictionary, so the capitalized form counts too.
    "de": {"letters": "a-zäöüß", "singles": set(), "allow_capitalized": True},
    # English proper nouns are capitalized in the dictionary; only lowercase entries count.
    "en": {"letters": "a-z", "singles": {"a", "i"}, "allow_capitalized": False},
}


def download(url, path):
    urllib.request.urlretrieve(url, path)
    return path


def is_real_word(dictionary, word, allow_capitalized):
    # lookup() also accepts a capitalized spelling of a lowercase entry, but not the
    # reverse, so a lowercase lookup only matches words that may appear in lowercase.
    if dictionary.lookup(word):
        return True
    return allow_capitalized and dictionary.lookup(word.capitalize())


def build(lang, cfg, tmp):
    for ext in ("aff", "dic"):
        download(DICT_URL.format(lang=lang, ext=ext), tmp / f"{lang}.{ext}")
    dictionary = Dictionary.from_files(str(tmp / lang))
    freq = download(FREQ_URL.format(lang=lang), tmp / f"{lang}_freq.txt")

    valid = re.compile(f"^[{cfg['letters']}]+$")
    seen, words = set(), []
    with open(freq, encoding="utf-8") as f:
        for line in f:
            word = line.split(" ")[0].strip().lower()
            if word in seen or not valid.match(word):
                continue
            seen.add(word)
            if len(word) < 2 and word not in cfg["singles"]:
                continue
            if len(word) <= SHORT_WORD_LEN and len(words) >= SHORT_WORD_MAX_RANK:
                continue
            if not is_real_word(dictionary, word, cfg["allow_capitalized"]):
                continue
            words.append(word)
            if len(words) >= MAX_WORDS:
                break

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{lang}.txt").write_text("\n".join(words) + "\n", encoding="utf-8")
    print(f"{lang}: {len(words)} words")


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        for lang, cfg in LANGS.items():
            build(lang, cfg, Path(tmp))
