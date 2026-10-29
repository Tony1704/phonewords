# Phonewords

Finde Wörter in deiner Telefonnummer über die T9-Tastatur (wie `1-800-FLOWERS` in den USA) – mit deutschem oder englischem Wörterbuch.

Reine statische Website: die Suche läuft komplett im Browser, es gibt kein Backend. Ausgeliefert wird sie von nginx im Docker-Container.

## Lokal starten

```bash
python3 -m http.server -d public 8000
```

oder mit Docker:

```bash
docker build -t phonewords . && docker run --rm -p 8080:80 phonewords
```

## Deployment (Raspberry Pi)

Jeder Push auf `main` baut per GitHub Actions ein Multi-Arch-Image (`amd64` + `arm64`) und pusht es nach `ghcr.io/tony1704/phonewords`.

Auf dem Pi:

```bash
docker compose pull && docker compose up -d
```

`docker-compose.yml` hängt den Container ans externe Netzwerk `apps_proxy` (Reverse Proxy). Ohne Proxy stattdessen `ports: ["8080:80"]` verwenden.

## Wortlisten

`public/words/{de,en}.txt` werden mit `scripts/build-wordlists.py` erzeugt, nach Häufigkeit sortiert, ein Wort pro Zeile (je 60.000 Wörter):

- Häufigkeiten aus [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (CC BY-SA 4.0, basierend auf OpenSubtitles)
- Weil Untertitel voller Namen, Tippfehler und Fremdwörter sind, muss jedes Wort zusätzlich die Hunspell-Rechtschreibprüfung bestehen ([wooorm/dictionaries](https://github.com/wooorm/dictionaries)). Im Englischen zählen nur kleingeschriebene Einträge, damit Eigennamen rausfallen.
- Wörter mit bis zu 3 Buchstaben nur, wenn sie häufig sind (sonst kommen Abkürzungen wie `fps` durch).

```bash
pip install spylls
python3 scripts/build-wordlists.py
```

## Wie gesucht wird

- Jedes Wort wird in seine Ziffernfolge übersetzt (Ä→2, Ö→6, Ü→8, ß→7) und in einem Index abgelegt.
- **Einzelne Wörter:** alle Teilstücke der Nummer, die einem Wort entsprechen.
- **Kombinationen:** eine Beam-Search über die ganze Nummer, die möglichst wenige Ziffern unverändert lässt und häufige, lange Wörter bevorzugt.
