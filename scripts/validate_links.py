import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
manual = eval(
    ROOT.joinpath("public/js/default-data.js")
    .read_text(encoding="utf-8")
    .replace("window.DEFAULT_MANUAL = ", "")
    .rstrip(";")
)
reg = json.loads(
    ROOT.joinpath("public/js/default-regolamento-data.js")
    .read_text(encoding="utf-8")
    .replace("window.DEFAULT_REGOLAMENTO = ", "")
    .rstrip(";")
)

CODE_HINTS = {"9.10": "npc", "9.13": "GANG"}
EXTRA_REFS = {
    "1.5": [{"section": "1", "item": "6"}],
    "1.3 + 2.22": [{"section": "1", "item": "4"}, {"section": "2", "item": "22"}],
    "2.1 + 6.3": [{"section": "6", "item": "3"}],
    "2.1 + 6.2": [{"section": "6", "item": "2"}],
}


def find_section(section_num):
    for i, section in enumerate(reg["sections"]):
        if str(section["num"]) == str(section_num):
            return i, section
    return -1, None


def find_item(section, item_num, hint=None):
    matches = [
        (i, item)
        for i, item in enumerate(section["items"])
        if str(item.get("num", "")) == str(item_num)
    ]
    if not matches:
        return -1
    if len(matches) == 1:
        return matches[0][0]
    if hint:
        for i, item in matches:
            if hint.lower() in item["text"].lower():
                return i
    for i, item in matches:
        if len(item["text"]) > 40:
            return i
    return matches[0][0]


def get_links(rule):
    code_key = str(rule.get("code", "")).strip()
    codes = re.findall(r"\d+\.\d+", code_key)
    links = []
    seen = set()

    for code in codes:
        sec, item = code.split(".")
        hint = CODE_HINTS.get(code)
        si, section = find_section(sec)
        if si < 0:
            continue
        ii = find_item(section, item, hint)
        if ii < 0:
            continue
        key = (si, ii)
        if key not in seen:
            seen.add(key)
            links.append(code)

    for ref in EXTRA_REFS.get(code_key, []):
        si, section = find_section(ref["section"])
        if si < 0:
            continue
        ii = find_item(section, ref["item"])
        if ii < 0:
            continue
        key = (si, ii)
        if key not in seen:
            seen.add(key)
            links.append(f"{ref['section']}.{ref['item']}")

    return links


missing = []
for section in manual["sections"]:
    for rule in section["rules"]:
        links = get_links(rule)
        if links:
            print(f"OK      {rule['code']:14} {rule['name'][:35]:35} -> {', '.join(links)}")
        else:
            missing.append(rule)
            print(f"MISSING {rule['code']:14} {rule['name'][:35]:35}")

print(f"\nTotal missing: {len(missing)}")
