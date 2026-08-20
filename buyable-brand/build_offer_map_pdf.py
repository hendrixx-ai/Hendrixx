#!/usr/bin/env python3
"""Build The Buyable Offer Map — 2-page letter PDF."""

from pathlib import Path

from fpdf import FPDF

CREAM = (246, 241, 234)
INK = (26, 26, 26)
RUST = (140, 58, 47)
WASH = (239, 231, 220)
LINE = (217, 208, 198)

FONT_DIR = Path("/tmp/fonts")
OUT = Path(__file__).resolve().parent / "The-Buyable-Offer-Map.pdf"


class MapPDF(FPDF):
    def header(self):
        self.set_fill_color(*CREAM)
        self.rect(0, 0, self.w, self.h, "F")

    def footer(self):
        self.set_y(-36)
        self.set_draw_color(*INK)
        self.set_line_width(0.6)
        self.line(36, self.h - 40, self.w - 36, self.h - 40)
        self.set_font("Sans", size=8)
        self.set_text_color(*INK)
        self.set_xy(36, self.h - 34)
        self.cell(120, 10, "THE BUYABLE BRAND")
        self.set_font("PlayfairI", size=11)
        self.set_xy(self.w - 160, self.h - 34)
        self.cell(124, 10, "Pretty second. Buyable first.", align="R")


def box(pdf: MapPDF, x, y, w, h):
    pdf.set_draw_color(*INK)
    pdf.set_line_width(0.35)
    pdf.rect(x, y, w, h)


def label(pdf: MapPDF, x, y, num, title):
    pdf.set_xy(x, y)
    pdf.set_font("Sans", size=7.5)
    pdf.set_text_color(*RUST)
    pdf.cell(w=0, h=10, text=num)
    pdf.set_xy(x, y + 9)
    pdf.set_font("Playfair", size=13)
    pdf.set_text_color(*INK)
    pdf.cell(w=0, h=14, text=title)


def help_text(pdf: MapPDF, x, y, w, text):
    pdf.set_xy(x, y)
    pdf.set_font("Sans", size=8)
    pdf.set_text_color(74, 69, 64)
    pdf.multi_cell(w, 10, text)
    return pdf.get_y()


def write_lines(pdf: MapPDF, x, y, w, n=2, gap=16):
    pdf.set_draw_color(*INK)
    pdf.set_line_width(0.25)
    for i in range(n):
        yy = y + i * gap
        pdf.line(x, yy, x + w, yy)
    return y + n * gap


def checkbox_row(pdf: MapPDF, x, y, items, col_w=118):
    pdf.set_font("Sans", size=8)
    pdf.set_text_color(*INK)
    pdf.set_draw_color(*INK)
    pdf.set_line_width(0.3)
    for i, item in enumerate(items):
        xx = x + (i % 2) * col_w
        yy = y + (i // 2) * 13
        pdf.rect(xx, yy, 7, 7)
        pdf.set_xy(xx + 10, yy - 2)
        pdf.cell(col_w - 12, 11, item)
    return y + ((len(items) + 1) // 2) * 13


def build():
    pdf = MapPDF(format="Letter", unit="pt")
    pdf.set_auto_page_break(False)
    pdf.add_font("Playfair", "", str(FONT_DIR / "PlayfairDisplay.ttf"))
    pdf.add_font("PlayfairI", "", str(FONT_DIR / "PlayfairDisplay-Italic.ttf"))
    pdf.add_font("Sans", "", str(FONT_DIR / "SourceSans3.ttf"))
    pdf.add_font("SansI", "", str(FONT_DIR / "SourceSans3-Italic.ttf"))

    # ---------- PAGE 1 ----------
    pdf.add_page()
    m = 36
    w = pdf.w - 2 * m

    pdf.set_xy(m, 28)
    pdf.set_font("Sans", size=8)
    pdf.set_text_color(*RUST)
    pdf.cell(w, 10, "THE BUYABLE BRAND   ·   FREE MAP")

    pdf.set_xy(m, 42)
    pdf.set_font("Playfair", size=26)
    pdf.set_text_color(*INK)
    pdf.multi_cell(w, 28, "Fill this in and you will have")
    pdf.set_xy(m, pdf.get_y() - 2)
    pdf.set_font("PlayfairI", size=26)
    pdf.multi_cell(w, 28, "one sentence you could sell this month.")

    pdf.set_xy(m, pdf.get_y() + 2)
    pdf.set_font("Sans", size=10)
    pdf.set_text_color(50, 46, 42)
    pdf.multi_cell(
        w,
        13,
        "Not a vibe. Not a bio. An offer. If a stranger cannot buy the sentence, it is not finished. Write in ink. First draft is supposed to be ugly.",
    )

    y = pdf.get_y() + 10
    gap = 10
    col_w = (w - gap) / 2
    box_h = 118

    # 01 WHO
    x1 = m
    box(pdf, x1, y, col_w, box_h)
    label(pdf, x1 + 10, y + 8, "01  ·  WHO", "I help")
    help_text(
        pdf,
        x1 + 10,
        y + 34,
        col_w - 20,
        "One beginner. Situation + skill they already have. Not “everyone.”",
    )
    write_lines(pdf, x1 + 10, y + 72, col_w - 20, 2)
    checkbox_row(pdf, x1 + 10, y + 98, ["I can find 100 of them this week"], col_w - 20)

    # 02 RESULT
    x2 = m + col_w + gap
    box(pdf, x2, y, col_w, box_h)
    label(pdf, x2 + 10, y + 8, "02  ·  RESULT", "so they can")
    help_text(
        pdf,
        x2 + 10,
        y + 34,
        col_w - 20,
        "Visible in 14 days. Not “feel confident.” A file, a link, a rewritten bio.",
    )
    write_lines(pdf, x2 + 10, y + 72, col_w - 20, 2)
    checkbox_row(pdf, x2 + 10, y + 98, ["They can point at it this month"], col_w - 20)

    y = y + box_h + 10
    box_h2 = 112

    # 03 WITHOUT
    box(pdf, x1, y, col_w, box_h2)
    label(pdf, x1 + 10, y + 8, "03  ·  WITHOUT", "without")
    help_text(
        pdf,
        x1 + 10,
        y + 34,
        col_w - 20,
        "The fear that keeps them lurking. 10k followers, guru cosplay, a 40-hour course.",
    )
    write_lines(pdf, x1 + 10, y + 72, col_w - 20, 2)

    # 04 + 05
    box(pdf, x2, y, col_w, box_h2)
    label(pdf, x2 + 10, y + 8, "04–05  ·  FORMAT + PRICE", "Circle one of each")
    pdf.set_font("Sans", size=8.5)
    pdf.set_text_color(*INK)
    formats = [
        "Template pack",
        "Swipe / scripts",
        "Mini-course (<90 min)",
        "Notion system",
        "Weekend kit",
        "Teardown PDF",
    ]
    yy = y + 38
    for i, item in enumerate(formats):
        xx = x2 + 10 + (i % 2) * 124
        row = i // 2
        pdf.rect(xx, yy + row * 13, 7, 7)
        pdf.set_xy(xx + 10, yy + row * 13 - 2)
        pdf.cell(110, 11, item)
    prices = ["$27", "$47", "$97", "$147"]
    py = yy + 40
    for i, item in enumerate(prices):
        xx = x2 + 10 + i * 52
        pdf.rect(xx, py, 7, 7)
        pdf.set_xy(xx + 9, py - 2)
        pdf.cell(42, 11, item)
    pdf.rect(x2 + 10, py + 14, 7, 7)
    pdf.set_xy(x2 + 19, py + 12)
    pdf.cell(80, 11, "Other $________")

    # 06 SENTENCE
    y = y + box_h2 + 10
    box_h3 = 132
    pdf.set_fill_color(*WASH)
    pdf.set_draw_color(*INK)
    pdf.rect(m, y, w, box_h3, "FD")
    label(pdf, m + 12, y + 8, "06  ·  THE SENTENCE", "Copy this. This is the offer.")
    pdf.set_xy(m + 12, y + 36)
    pdf.set_font("PlayfairI", size=14)
    pdf.set_text_color(*INK)
    pdf.multi_cell(w - 24, 18, "I help  _______________________________")
    pdf.set_x(m + 12)
    pdf.multi_cell(w - 24, 18, "get  _______________________________")
    pdf.set_x(m + 12)
    pdf.multi_cell(w - 24, 18, "without  _______________________________")
    checkbox_row(
        pdf,
        m + 12,
        y + 104,
        [
            "A stranger knows if it’s for them in 3 seconds",
            "I would say this on a Reel tomorrow",
        ],
        (w - 24) / 2,
    )

    # 07 + 08
    y = y + box_h3 + 10
    box_h4 = 148
    box(pdf, x1, y, col_w, box_h4)
    label(pdf, x1 + 10, y + 8, "07  ·  BIO ONE-LINER", "The sentence, compressed")
    help_text(
        pdf,
        x1 + 10,
        y + 34,
        col_w - 20,
        "Formula: result for who. Without, on purpose.",
    )
    write_lines(pdf, x1 + 10, y + 68, col_w - 20, 3, gap=18)
    pdf.set_xy(x1 + 10, y + 122)
    pdf.set_font("SansI", size=8)
    pdf.set_text_color(74, 69, 64)
    pdf.multi_cell(col_w - 20, 10, "Ex: I make your taste buyable. No audience required.")

    box(pdf, x2, y, col_w, box_h4)
    label(pdf, x2 + 10, y + 8, "08  ·  FIRST 5 HOOKS", "Do not open Canva yet")
    write_lines(pdf, x2 + 10, y + 48, col_w - 20, 5, gap=18)

    # ---------- PAGE 2 ----------
    pdf.add_page()
    pdf.set_xy(m, 28)
    pdf.set_font("Sans", size=8)
    pdf.set_text_color(*RUST)
    pdf.cell(w, 10, "THE BUYABLE BRAND   ·   HOW TO USE THE MAP")

    pdf.set_xy(m, 42)
    pdf.set_font("Playfair", size=24)
    pdf.set_text_color(*INK)
    pdf.multi_cell(w, 28, "A finished map — steal the shape.")

    pdf.set_xy(m, pdf.get_y() + 2)
    pdf.set_font("Sans", size=10)
    pdf.set_text_color(50, 46, 42)
    pdf.multi_cell(
        w,
        13,
        "Use this until you write your own. Same structure. Your nouns.",
    )

    y = pdf.get_y() + 12
    rows = [
        ("WHO", "Ambitious beginners with taste (design, photo, video, writing, style) and no product"),
        ("RESULT", "A named digital offer and a live checkout link in 14 days"),
        ("WITHOUT", "A big following, a studio, or guru cosplay"),
        ("FORMAT", "Weekend kit first, then a 14-day system"),
        ("PRICE", "$27, then $147"),
        (
            "SENTENCE",
            "I help ambitious beginners with taste get a named offer and a live checkout without waiting for 10k followers.",
        ),
        ("BIO", "I make your taste buyable. Starting from zero, in public."),
    ]
    row_h = 28
    pdf.set_draw_color(*LINE)
    for i, (k, v) in enumerate(rows):
        yy = y + i * row_h
        if i % 2 == 0:
            pdf.set_fill_color(*WASH)
            pdf.rect(m, yy, w, row_h, "F")
        pdf.set_xy(m + 8, yy + 6)
        pdf.set_font("Sans", size=8)
        pdf.set_text_color(*RUST)
        pdf.cell(70, 16, k)
        pdf.set_xy(m + 82, yy + 4)
        pdf.set_font("Playfair", size=11)
        pdf.set_text_color(*INK)
        pdf.multi_cell(w - 94, 13, v)

    y = y + len(rows) * row_h + 16
    pdf.set_xy(m, y)
    pdf.set_font("Playfair", size=16)
    pdf.set_text_color(*INK)
    pdf.cell(w, 20, "Use it in 20 minutes")

    steps = [
        "Fill boxes 1–5 without editing. Ugly is correct.",
        "Write the sentence once. Read it out loud. Cut one adjective.",
        "Write the bio line. Put it on Instagram today. Not “when the grid matches.”",
        "Write 5 hooks. Film one tomorrow.",
        "Reply to the email (or the DM) with your sentence. I will tell you if it is buyable.",
    ]
    y = y + 24
    for i, step in enumerate(steps, 1):
        pdf.set_xy(m, y)
        pdf.set_font("Playfair", size=12)
        pdf.set_text_color(*RUST)
        pdf.cell(18, 14, f"{i:02d}")
        pdf.set_xy(m + 22, y)
        pdf.set_font("Sans", size=10.5)
        pdf.set_text_color(*INK)
        pdf.multi_cell(w - 22, 14, step)
        y = pdf.get_y() + 2

    y += 10
    # two doors
    door_w = (w - 10) / 2
    pdf.set_draw_color(*INK)
    pdf.rect(m, y, door_w, 118)
    pdf.rect(m + door_w + 10, y, door_w, 118)

    pdf.set_xy(m + 12, y + 10)
    pdf.set_font("Sans", size=8)
    pdf.set_text_color(*RUST)
    pdf.cell(door_w - 24, 10, "DOOR 1")
    pdf.set_xy(m + 12, y + 24)
    pdf.set_font("Playfair", size=15)
    pdf.set_text_color(*INK)
    pdf.cell(door_w - 24, 18, "First Product in a Weekend")
    pdf.set_xy(m + 12, y + 44)
    pdf.set_font("PlayfairI", size=13)
    pdf.cell(door_w - 24, 16, "$27")
    pdf.set_xy(m + 12, y + 64)
    pdf.set_font("Sans", size=9.5)
    pdf.multi_cell(
        door_w - 24,
        12,
        "Name it, outline it, package it, upload it. Templates included. The weekend files — not just the sentence.",
    )

    pdf.set_xy(m + door_w + 22, y + 10)
    pdf.set_font("Sans", size=8)
    pdf.set_text_color(*RUST)
    pdf.cell(door_w - 24, 10, "DOOR 2")
    pdf.set_xy(m + door_w + 22, y + 24)
    pdf.set_font("Playfair", size=15)
    pdf.set_text_color(*INK)
    pdf.cell(door_w - 24, 18, "The Buyable Brand")
    pdf.set_xy(m + door_w + 22, y + 44)
    pdf.set_font("PlayfairI", size=13)
    pdf.cell(door_w - 24, 16, "$147")
    pdf.set_xy(m + door_w + 22, y + 64)
    pdf.set_font("Sans", size=9.5)
    pdf.multi_cell(
        door_w - 24,
        12,
        "14-day install: offer, profile, content pillars, and the Reel → DM → checkout funnel.",
    )

    y = y + 130
    pdf.set_xy(m, y)
    pdf.set_font("SansI", size=10)
    pdf.set_text_color(50, 46, 42)
    pdf.multi_cell(
        w,
        13,
        "This map is not a personality test, a 40-page workbook, or a promise you will make $10k. It is a sentence + a price + five hooks. That is enough to start selling. One sentence is free. A store is not.",
    )

    pdf.output(str(OUT))
    print(OUT, OUT.stat().st_size)


if __name__ == "__main__":
    build()
