import json
import urllib.request
from pathlib import Path
from typing import Final

from bs4 import BeautifulSoup

URL: Final[str] = "https://tpqi-net.tpqi.go.th/qualifications/4412"


def fetch_html(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        data = response.read()
    return data.decode(charset, errors="replace")


soup = BeautifulSoup(fetch_html(URL), "html.parser")
main = soup.select_one("div.col-md-9.col-sm-12")
if main is None:
    raise RuntimeError("Failed to locate main qualification content")

title_elem = soup.select_one("div.info h4") or soup.select_one("h4")
title_text = title_elem.get_text(strip=True) if title_elem else "TPQI Qualification 4412"

summary_heading_elem = main.select_one("p.h5")
summary_heading = summary_heading_elem.get_text(strip=True) if summary_heading_elem else "รายละเอียด"

entries: dict[str, str] = {}
for dl in main.find_all("dl"):
    for dt in dl.find_all("dt"):
        dd = dt.find_next_sibling("dd")
        if not dd:
            continue
        label = dt.get_text(" ", strip=True)
        value = "\n".join(list(dd.stripped_strings)).strip()
        if not value:
            continue
        if label in entries:
            if entries[label]:
                entries[label] += f"\n{value}"
            else:
                entries[label] = value
        else:
            entries[label] = value

units: list[dict[str, str | None]] = []
for anchor in main.select("a.text-secondary"):
    raw_text = anchor.get_text(" ", strip=True)
    if not raw_text:
        continue
    parts = raw_text.split(maxsplit=1)
    code = parts[0]
    description = parts[1] if len(parts) > 1 else ""
    units.append(
        {
            "code": code,
            "name": description,
            "url": anchor.get("href"),
        },
    )

org_label = "องค์กรรับรอง ที่สามารถเข้ารับการประเมินสมรรถนะบุคคล"
org_value = entries.get(org_label, "")
orgs: list[dict[str, str]] = []
if org_value:
    pending: dict[str, str] | None = None
    for raw_line in org_value.splitlines():
        chunk = raw_line.strip()
        if not chunk:
            continue
        if chunk.startswith(":"):
            name = chunk.lstrip(":").strip()
            if pending:
                pending["name"] = name
                orgs.append(pending)
                pending = None
            else:
                orgs.append({"code": "", "name": name})
            continue
        if ":" in chunk:
            code, name = chunk.split(":", 1)
            orgs.append({"code": code.strip(), "name": name.strip()})
            pending = None
        else:
            if pending:
                orgs.append(pending)
            pending = {"code": chunk, "name": ""}
    if pending:
        orgs.append(pending)


def format_section_heading(text: str) -> str:
    return f"## {text.strip()}"


markdown_parts: list[str] = [format_section_heading(summary_heading)]
summary_lines: list[str] = []
primary_label = "คุณวุฒิวิชาชีพ"
target_label = "กลุ่มบุคคลในอาชีพ (Target Group)"

if entries.get(primary_label):
    summary_lines.append(f"- {primary_label}: {entries[primary_label]}")
if entries.get(target_label):
    summary_lines.append(f"- {target_label}: {entries[target_label]}")

if summary_lines:
    markdown_parts.extend(summary_lines)

char_label = "คุณลักษณะของผลการเรียนรู้ (Characteristics of Outcomes)"
if entries.get(char_label):
    markdown_parts.append("")
    markdown_parts.append(format_section_heading(char_label))
    markdown_parts.append(entries[char_label])

path_label = "การเลื่อนระดับคุณวุฒิวิชาชีพ (Qualification Pathways)"
if entries.get(path_label):
    markdown_parts.append("")
    markdown_parts.append(format_section_heading(path_label))
    markdown_parts.append(entries[path_label])

unit_label = "หน่วยสมรรถนะ (หน่วยสมรรถนะทั้งหมดของคุณวุฒิวิชาชีพนี้)"
if units:
    markdown_parts.append("")
    markdown_parts.append(format_section_heading(unit_label))
    for unit in units:
        desc = unit["name"] or ""
        link = unit["url"]
        if link:
            line = f"- [{unit['code']}]({link})"
        else:
            line = f"- {unit['code']}"
        if desc:
            line += f" — {desc}"
        markdown_parts.append(line)
elif entries.get(unit_label):
    markdown_parts.append("")
    markdown_parts.append(format_section_heading(unit_label))
    markdown_parts.append(entries[unit_label])

if orgs:
    markdown_parts.append("")
    markdown_parts.append(format_section_heading(org_label))
    for org in orgs:
        name = org["name"]
        if name:
            markdown_parts.append(f"- {org['code']}: {name}")
        else:
            markdown_parts.append(f"- {org['code']}")

markdown_text = "\n".join(markdown_parts).strip()


def markdown_to_plain(md_text: str) -> str:
    plain_lines: list[str] = []
    for raw_line in md_text.splitlines():
        line = raw_line.strip()
        if not line:
            plain_lines.append("")
            continue
        if line.startswith("## "):
            plain_lines.append(line[3:].strip())
        elif line.startswith("- "):
            plain_lines.append(line[2:].strip())
        else:
            plain_lines.append(line)
    cleaned: list[str] = []
    prev_blank = False
    for line in plain_lines:
        if not line:
            if not prev_blank:
                cleaned.append("")
            prev_blank = True
        else:
            cleaned.append(line)
            prev_blank = False
    return "\n".join(cleaned).strip()


content_text = markdown_to_plain(markdown_text)

description_source = entries.get(char_label) or entries.get(primary_label) or ""
description_line = description_source.splitlines()[0].strip() if description_source else title_text

record: dict[str, object] = {
    "url": URL,
    "title": title_text,
    "description": description_line,
    "content_markdown": markdown_text,
    "content_text": content_text,
}

if units:
    record["units"] = units
if orgs:
    record["assessment_providers"] = orgs

output_path = Path("rag-data/raw/tpqi-qualification-4412.raw.json")
output_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Raw record written to {output_path}")
