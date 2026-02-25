import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import requests

API_BASE = "https://toyotathonburi.com/api"
DATASET_NAME = "cars-lineup"
OUTPUT_PATH = Path("rag-data/cars-lineup.json")


def fetch_json(url: str, *, retries: int = 5, delay: float = 0.6) -> Dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            time.sleep(delay * attempt if attempt else 0.4)
            response = requests.get(url, timeout=20, headers={"User-Agent": "cars-lineup-builder/1.0"})
            if response.status_code == 429:
                raise requests.HTTPError("Rate limited", response=response)
            response.raise_for_status()
            return response.json()
        except Exception as error:  # pylint: disable=broad-except
            last_error = error
            sleep_time = delay * (attempt + 1)
            if isinstance(error, requests.HTTPError) and error.response is not None and error.response.status_code == 429:
                retry_after = error.response.headers.get("Retry-After")
                if retry_after:
                    try:
                        sleep_time = max(sleep_time, float(retry_after))
                    except ValueError:
                        sleep_time = max(sleep_time, 2.5)
                else:
                    sleep_time = max(sleep_time, 2.5)
            time.sleep(sleep_time)
    assert last_error is not None
    raise last_error


def format_price(value: Any) -> str:
    if value in (None, "", "-", 0):
        return "ไม่ระบุ"
    try:
        number = float(value)
        if number.is_integer():
            return f"{int(number):,}"
        return f"{number:,.2f}"
    except (ValueError, TypeError):
        return str(value)


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    text = value
    try:
        text = text.encode("utf-8").decode("unicode_escape")
    except UnicodeDecodeError:
        pass
    return (
        text.replace("\\r", "\n")
        .replace("\\n", "\n")
        .replace("\r\n", "\n")
        .replace("\xa0", " ")
        .strip()
    )


def build_variant_text(series_name: str, philosophy: str, pdf_url: str | None, variant: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append(f"ซีรีส์ {series_name}")
    if philosophy:
        lines.append(f"คอนเซ็ปต์: {philosophy}")
    variant_name = variant.get("modelName") or variant.get("name") or "ไม่ระบุรุ่นย่อย"
    base_price = format_price(variant.get("price"))
    lines.append(f"รุ่นย่อย {variant_name} | ราคาเริ่มต้น {base_price} บาท")

    engine_type = clean_text(variant.get("engine_type"))
    engine_size = clean_text(variant.get("engine_size"))
    horsepower = clean_text(variant.get("horsepower"))
    if engine_type or engine_size or horsepower:
        spec_parts = []
        if engine_type:
            spec_parts.append(engine_type)
        if engine_size:
            spec_parts.append(f"{engine_size} ซีซี")
        if horsepower:
            spec_parts.append(f"{horsepower} แรงม้า")
        lines.append("เครื่องยนต์: " + " | ".join(spec_parts))

    engine_type2 = clean_text(variant.get("engine_type2"))
    engine_size2 = clean_text(variant.get("engine_size2"))
    horsepower2 = clean_text(variant.get("horsepower2"))
    if engine_type2 or engine_size2 or horsepower2:
        spec_parts = []
        if engine_type2:
            spec_parts.append(engine_type2)
        if engine_size2:
            spec_parts.append(f"{engine_size2} ซีซี")
        if horsepower2:
            spec_parts.append(f"{horsepower2} แรงม้า")
        lines.append("ระบบเสริม: " + " | ".join(spec_parts))

    colors = variant.get("Color") or []
    if colors:
        lines.append("เฉดสีภายนอก:")
        for color in colors:
            color_name = color.get("colorname") or "ไม่ระบุสี"
            color_code = color.get("colorcode")
            color_price = format_price(color.get("colorprice"))
            details = [color_name]
            if color_code:
                details.append(f"รหัส {color_code}")
            if color_price and color_price != "0":
                details.append(f"ราคา {color_price} บาท")
            lines.append(f"- {' | '.join(details)}")

    if pdf_url:
        lines.append(f"แค็ตตาล็อก: {pdf_url}")

    return "\n".join(lines)


def main() -> None:
    series_entries = fetch_json(f"{API_BASE}/series")["data"]
    # keep the first occurrence per id to preserve ordering by sequenceA
    series_map: Dict[int, Dict[str, Any]] = {}
    for entry in series_entries:
        series_map.setdefault(entry["id"], entry)

    chunks: List[Dict[str, Any]] = []

    for series_id, series_entry in sorted(series_map.items(), key=lambda item: (item[1].get("sequenceA", 0), item[1].get("name", ""))):
        series_detail = fetch_json(f"{API_BASE}/series/{series_id}")
        series_name = series_detail.get("series") or series_entry.get("name") or f"ซีรีส์ {series_id}"
        philosophy = clean_text(series_detail.get("philosophy"))
        if philosophy.startswith('"') and philosophy.endswith('"'):
            philosophy = philosophy[1:-1].strip()
        pdf_url = series_detail.get("pdf")
        model_list = series_detail.get("model") or []

        model_cache: Dict[int, Dict[str, Any]] = {}
        for model in model_list:
            model_id = model.get("id")
            if not model_id:
                continue
            if model_id in model_cache:
                variant_detail = model_cache[model_id]
            else:
                try:
                    variant_detail = fetch_json(f"{API_BASE}/model/{model_id}")
                except requests.HTTPError as error:
                    if error.response is not None and error.response.status_code == 404:
                        # some model ids might be placeholders without detail endpoints
                        continue
                    raise
                model_cache[model_id] = variant_detail
            text = build_variant_text(series_name, philosophy, pdf_url, variant_detail)
            chunk = {
                "dataset": DATASET_NAME,
                "seriesId": series_id,
                "modelId": model_id,
                "seriesName": series_name,
                "modelName": variant_detail.get("modelName") or model.get("name"),
                "price": variant_detail.get("price"),
                "text": text,
                "sourceUrl": f"{API_BASE}/series/{series_id}",
            }
            chunks.append(chunk)

    output = {
        "dataset": DATASET_NAME,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "chunks": chunks,
    }

    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(chunks)} car lineup entries to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
