import json
import re
import html
import urllib.request
from pathlib import Path

DOC_ID = "1yndzCTIMZq1lsCu3d1CbuaYWvUs78_ROhEGCudnTJZE"
URL = f"https://docs.google.com/document/d/{DOC_ID}/mobilebasic"
ROOT = Path(__file__).resolve().parent.parent
OUT_JS = ROOT / "public" / "js" / "default-regolamento-data.js"


def fetch_html():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode("utf-8", "replace")


def strip_tags(text):
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"</h[1-6]>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return text.replace("\xa0", " ").strip()


def extract_lines(content):
    start = content.find('<div class="doc-content"')
    if start < 0:
        raise RuntimeError("doc-content not found")

    end_markers = ['<div id="banners"', '<div class="docs-ml-promotion"']
    end = len(content)
    for marker in end_markers:
        pos = content.find(marker, start)
        if pos > start:
            end = min(end, pos)

    doc_html = content[start:end]
    lines = []
    for tag_match in re.finditer(r"<(p|h[1-6]|li)[^>]*>(.*?)</\1>", doc_html, re.DOTALL | re.I):
        text = strip_tags(tag_match.group(2))
        if not text:
            continue
        if text.startswith("http") and "googleusercontent" in text:
            continue
        if "docs.google.com/docs-images" in text:
            continue
        lines.append(text)
    return lines


def normalize_lines(lines):
    cleaned = []
    skip_prefixes = ("html {", "body {", ".app-container", ".doc {", "@import", "window.", "_docs_")

    for line in lines:
        if any(line.startswith(p) for p in skip_prefixes):
            continue
        if line.startswith(".") and "{" in line:
            continue
        if line in {"REGOLAMENTO GAMMA RP", "REGOLAMENTO GAMMA PROJECT", "REGOLAMENTO SERVER", "GAMMA ROLEPLAY"}:
            continue
        cleaned.append(line)
    return cleaned


def is_section_heading(line):
    return bool(re.match(r"^\d+\.\s+[A-ZÀÁÂÄÃÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜ]", line))


def is_item_number(line):
    return bool(re.match(r"^\d+(?:\.\d+)*\.?$", line))


def parse_item_line(line):
    match = re.match(r"^(\d+(?:\.\d+)*)\.\s+(.+)$", line)
    if match:
        return match.group(1), match.group(2).strip()
    return None, None


def parse_regolamento(lines):
    intro = None
    sections = []
    current = None
    pending_num = None

    for line in lines:
        if intro is None and line.startswith("Il buon senso"):
            intro = line
            continue

        if is_section_heading(line):
            m = re.match(r"^(\d+)\.\s+(.+)$", line)
            current = {
                "num": m.group(1),
                "title": m.group(2).strip(),
                "items": [],
            }
            sections.append(current)
            pending_num = None
            continue

        if current is None:
            continue

        item_num, item_text = parse_item_line(line)
        if item_num and item_text:
            current["items"].append({"num": item_num, "text": item_text})
            pending_num = None
            continue

        if is_item_number(line):
            pending_num = line.rstrip(".")
            continue

        if pending_num is not None:
            current["items"].append({"num": pending_num, "text": line})
            pending_num = None
            continue

        if current["items"]:
            current["items"][-1]["text"] += " " + line
        else:
            current["items"].append({"num": "", "text": line})

    return intro, sections


def build_payload(intro, sections):
    return {
        "header": {
            "icon": "GR",
            "title": "Regolamento Gamma RP",
            "subtitle": "GAMMA ROLEPLAY — Regolamento server",
            "stamp": "DOCUMENTO UFFICIALE",
        },
        "intro": intro or "",
        "sections": sections,
        "footer": "Regolamento ufficiale Gamma RP · Aggiornare in caso di modifiche al documento Google",
        "sourceUrl": f"https://docs.google.com/document/d/{DOC_ID}/edit",
    }


def write_js(payload):
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    OUT_JS.write_text(f"window.DEFAULT_REGOLAMENTO = {body};\n", encoding="utf-8")


def main():
    content = fetch_html()
    lines = normalize_lines(extract_lines(content))
    intro, sections = parse_regolamento(lines)
    payload = build_payload(intro, sections)
    write_js(payload)

    total_items = sum(len(s["items"]) for s in sections)
    print(f"Sections: {len(sections)}")
    print(f"Items: {total_items}")
    print(f"Written: {OUT_JS}")
    for s in sections:
        print(f"  {s['num']}. {s['title']} ({len(s['items'])} voci)")


if __name__ == "__main__":
    main()
