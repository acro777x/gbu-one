"""Extracts positioned text from a PDF with a REAL PDF engine.

    python tools/pdf_layout.py <file.pdf>

Prints one JSON object:

    {"pages": [[{"text": "M", "x": 92.1, "y": 41.0}, ...], ...]}

The worker's own PDF reader has to guess where each glyph was drawn: it
does not track glyph advances, and the School of ICT's date sheet draws
its table inside a rotated and scaled frame whose columns are moved by
kerning inside a TJ array. That sheet parsed to nothing, so the app fell
back to a sample date sheet for the largest school in the university.

PDFium knows exactly where every glyph is. It is a mature C++ PDF engine
(the one used by Chrome), so this helper asks it for the character boxes
instead of teaching the worker to be a PDF engine. It is used only when
available; the worker falls back to its own reader when it is not.

Requires: python -m pip install pypdfium2
"""

from __future__ import annotations

import json
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python tools/pdf_layout.py <file.pdf>", file=sys.stderr)
        return 2

    try:
        import pypdfium2 as pdfium  # type: ignore
    except ImportError:
        print("pypdfium2 is not installed", file=sys.stderr)
        return 3

    try:
        document = pdfium.PdfDocument(sys.argv[1])
        pages = []
        for page in document:
            text_page = page.get_textpage()
            count = text_page.count_chars()
            pieces = []
            for index in range(count):
                char = text_page.get_text_range(index, 1)
                if not char or not char.strip():
                    continue
                box = text_page.get_charbox(index)
                if not box:
                    continue
                # The box is (left, bottom, right, top) in PDF user space.
                # Its centre is the position of this exact glyph, advance
                # included - which is what the grid reader needs.
                x = (box[0] + box[2]) / 2.0
                y = (box[1] + box[3]) / 2.0
                pieces.append({"text": char, "x": x, "y": y})
            pages.append(pieces)
        # On Windows stdout defaults to the local code page, which cannot
        # encode the replacement characters that a broken font produces.
        # Write UTF-8 bytes explicitly instead.
        payload = json.dumps(
            {"pages": pages}, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        sys.stdout.buffer.write(payload)
        sys.stdout.buffer.write(b"\n")
        sys.stdout.buffer.flush()
        return 0
    except Exception as error:  # noqa: BLE001 - a bad PDF must not kill the worker
        print(f"pdfium failed: {error}", file=sys.stderr)
        return 4


if __name__ == "__main__":
    sys.exit(main())
