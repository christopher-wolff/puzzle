#!/usr/bin/env python3
"""Generate clue scene PNGs with OpenAI Images API (gpt-image-1)."""

from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

API_URL = "https://api.openai.com/v1/images/generations"
MODEL = "gpt-image-1"
SIZE = "1536x1024"

OUTPUT_DIR = pathlib.Path(__file__).resolve().parents[1] / "assets" / "clues"

STYLE_PREFIX = (
    "Minimalist cute flat illustration, soft pastel palette, clean rounded shapes, "
    "warm cozy living room atmosphere, simple composition, no text, no logos, no watermark. "
    "Keep the same visual style and same two character designs across all images: "
    "Chris is a sweet young man with short brown hair and green sweater, "
    "Kimberly is a sweet young woman with medium dark hair and yellow cardigan."
)

CLUES = [
    {
        "id": "01",
        "filename": "clue-01.png",
        "scene": "Chris and Kimberly smiling at each other with tiny floating hearts, affectionate and playful.",
    },
    {
        "id": "02",
        "filename": "clue-02.png",
        "scene": "Chris creating a gift with craft materials on a table while smiling, Kimberly admiring him nearby.",
    },
    {
        "id": "03",
        "filename": "clue-03.png",
        "scene": "Chris playfully hiding behind the side of a couch with a mischievous smile.",
    },
    {
        "id": "04",
        "filename": "clue-04.png",
        "scene": "Chris and Kimberly sitting together watching TV on a cozy couch, cute and relaxed.",
    },
    {
        "id": "05",
        "filename": "clue-05.png",
        "scene": "Chris playfully hiding under a wooden table in side view, table above and Chris crouched below the tabletop.",
    },
]


def generate_image(api_key: str, prompt: str, timeout: int = 180) -> bytes:
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "size": SIZE,
        "quality": "medium",
        "output_format": "png",
    }

    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=timeout) as response:
        body = json.loads(response.read().decode("utf-8"))

    data = body.get("data", [])
    if not data:
        raise RuntimeError("OpenAI response did not include image data.")

    first = data[0]
    if "b64_json" in first:
        return base64.b64decode(first["b64_json"])

    if "url" in first:
        with urllib.request.urlopen(first["url"], timeout=timeout) as download:
            return download.read()

    raise RuntimeError("OpenAI response missing both b64_json and url.")


def run(force: bool = False, delay_seconds: float = 1.2) -> int:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Missing OPENAI_API_KEY. Export it and rerun this script.", file=sys.stderr)
        return 2

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for clue in CLUES:
        output_path = OUTPUT_DIR / clue["filename"]
        if output_path.exists() and not force:
            print(f"Skipping {clue['filename']} (already exists). Use --force to replace.")
            continue

        prompt = f"{STYLE_PREFIX}\nScene: {clue['scene']}"
        print(f"Generating clue {clue['id']} -> {output_path.name}")

        try:
            image_bytes = generate_image(api_key=api_key, prompt=prompt)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            print(f"OpenAI API error for clue {clue['id']}: HTTP {exc.code}", file=sys.stderr)
            print(detail, file=sys.stderr)
            return 1
        except Exception as exc:  # noqa: BLE001
            print(f"Generation failed for clue {clue['id']}: {exc}", file=sys.stderr)
            return 1

        output_path.write_bytes(image_bytes)
        print(f"Wrote {output_path}")
        time.sleep(delay_seconds)

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Replace existing output images.")
    args = parser.parse_args()
    return run(force=args.force)


if __name__ == "__main__":
    raise SystemExit(main())
