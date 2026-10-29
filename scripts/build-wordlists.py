#!/usr/bin/env python3
"""Download frequency word lists and write cleaned lists to public/words/<lang>.txt.

Source: https://github.com/hermitdave/FrequencyWords (content CC-BY-SA 4.0,
derived from OpenSubtitles). Words are kept in frequency order, one per line.
"""
import re
import urllib.request
from pathlib import Path

SRC = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/{lang}/{lang}_50k.txt"
OUT = Path(__file__).resolve().parent.parent / "public" / "words"

LANGS = {
    "de": {"letters": "a-zäöüß", "singles": set()},
    "en": {"letters": "a-z", "singles": {"a", "i"}},
}


def build(lang, cfg):
    raw = urllib.request.urlopen(SRC.format(lang=lang)).read().decode("utf-8")
    valid = re.compile(f"^[{cfg['letters']}]+$")
    seen, words = set(), []
    for line in raw.splitlines():
        word = line.split(" ")[0].strip().lower()
        if not valid.match(word) or word in seen:
            continue
        if len(word) < 2 and word not in cfg["singles"]:
            continue
        seen.add(word)
        words.append(word)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{lang}.txt").write_text("\n".join(words) + "\n", encoding="utf-8")
    print(f"{lang}: {len(words)} words")


if __name__ == "__main__":
    for lang, cfg in LANGS.items():
        build(lang, cfg)
