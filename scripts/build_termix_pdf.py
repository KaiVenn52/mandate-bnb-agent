from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "evidence" / "termix" / "artifact.json"
OUTPUT = ROOT / "output" / "pdf" / "MANDATE-Agent-Advantage-Report.pdf"

INK = colors.HexColor("#111315")
STONE = colors.HexColor("#62666A")
LINE = colors.HexColor("#D9DBDD")
PAPER = colors.HexColor("#F6F4EF")
YELLOW = colors.HexColor("#F5B900")
GREEN = colors.HexColor("#16845B")
WHITE = colors.white


def register_font() -> str:
    candidates = [
        Path(r"C:\Windows\Fonts\arial.ttf"),
        Path(r"C:\Windows\Fonts\segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            pdfmetrics.registerFont(TTFont("MandateSans", str(candidate)))
            return "MandateSans"
    return "Helvetica"


FONT = register_font()


class QualityChart(Flowable):
    def __init__(self, rows: list[dict], width: float, height: float = 65 * mm):
        super().__init__()
        self.rows = rows
        self.width = width
        self.height = height

    def draw(self):
        canvas = self.canv
        left = 14 * mm
        bottom = 14 * mm
        chart_w = self.width - left - 8 * mm
        chart_h = self.height - bottom - 16 * mm
        canvas.setStrokeColor(LINE)
        canvas.setFillColor(STONE)
        canvas.setFont(FONT, 7)
        for value in range(0, 11, 2):
            y = bottom + chart_h * value / 10
            canvas.line(left, y, left + chart_w, y)
            canvas.drawRightString(left - 3 * mm, y - 2, str(value))

        grouped: dict[str, dict[str, float]] = {}
        for row in self.rows:
            grouped.setdefault(row["task_id"], {})[row["path"]] = row["quality_score"]
        group_w = chart_w / len(grouped)
        bar_w = 12 * mm
        for idx, (task_id, values) in enumerate(grouped.items()):
            center = left + group_w * (idx + 0.5)
            for offset, path, color in [(-bar_w, "Human, no agent", STONE), (0, "Marketplace agent", YELLOW)]:
                score = values[path]
                x = center + offset
                h = chart_h * score / 10
                canvas.setFillColor(color)
                canvas.rect(x, bottom, bar_w - 1.5 * mm, h, stroke=0, fill=1)
                canvas.setFillColor(INK)
                canvas.setFont(FONT, 8)
                canvas.drawCentredString(x + (bar_w - 1.5 * mm) / 2, bottom + h + 2.5 * mm, f"{score}/10")
            canvas.setFillColor(INK)
            canvas.setFont(FONT, 8)
            canvas.drawCentredString(center - bar_w / 2, 5 * mm, task_id)

        canvas.setFillColor(STONE)
        canvas.rect(left, self.height - 5 * mm, 4 * mm, 2 * mm, stroke=0, fill=1)
        canvas.setFillColor(INK)
        canvas.drawString(left + 6 * mm, self.height - 5.5 * mm, "Human, no agent")
        canvas.setFillColor(YELLOW)
        canvas.rect(left + 42 * mm, self.height - 5 * mm, 4 * mm, 2 * mm, stroke=0, fill=1)
        canvas.setFillColor(INK)
        canvas.drawString(left + 48 * mm, self.height - 5.5 * mm, "Marketplace agent")


def paragraph_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", fontName=FONT, fontSize=27, leading=31, textColor=INK, spaceAfter=7 * mm),
        "kicker": ParagraphStyle("kicker", fontName=FONT, fontSize=8, leading=11, textColor=STONE, uppercase=True, tracking=1.3, spaceAfter=2 * mm),
        "h1": ParagraphStyle("h1", fontName=FONT, fontSize=18, leading=22, textColor=INK, spaceBefore=4 * mm, spaceAfter=4 * mm),
        "h2": ParagraphStyle("h2", fontName=FONT, fontSize=12, leading=15, textColor=INK, spaceBefore=3 * mm, spaceAfter=2 * mm),
        "body": ParagraphStyle("body", fontName=FONT, fontSize=9.2, leading=14, textColor=INK, spaceAfter=3 * mm),
        "small": ParagraphStyle("small", fontName=FONT, fontSize=7.5, leading=10.5, textColor=STONE),
        "table": ParagraphStyle("table", fontName=FONT, fontSize=7.4, leading=9.6, textColor=INK),
        "table_header": ParagraphStyle("table_header", fontName=FONT, fontSize=7.4, leading=9.6, textColor=WHITE),
        "metric": ParagraphStyle("metric", fontName=FONT, fontSize=18, leading=20, textColor=INK, alignment=TA_CENTER),
        "metric_label": ParagraphStyle("metric_label", fontName=FONT, fontSize=6.8, leading=8, textColor=STONE, alignment=TA_CENTER),
        "callout": ParagraphStyle("callout", fontName=FONT, fontSize=9.2, leading=14, textColor=INK, borderColor=YELLOW, borderWidth=1, borderPadding=8, backColor=colors.HexColor("#FFF8D8")),
    }


def metric_strip(styles, summary):
    cells = []
    metrics = [
        ("PAIRED TASKS", "3 / 3"),
        ("MEDIAN SPEEDUP", f"{summary['median_speedup_x']:.1f}x"),
        ("AVG QUALITY LIFT", f"+{summary['average_quality_delta_points']:.1f} pts"),
        ("OBSERVED COST GAP", "$0.00"),
    ]
    for label, value in metrics:
        cells.append([Paragraph(value, styles["metric"]), Paragraph(label, styles["metric_label"])])
    table = Table([cells], colWidths=[42 * mm] * 4, rowHeights=[25 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    return table


def page_decor(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 15 * mm, A4[0] - 20 * mm, 15 * mm)
    canvas.setFont(FONT, 7)
    canvas.setFillColor(STONE)
    canvas.drawString(20 * mm, 9 * mm, "MANDATE - Agent Advantage Report - 13 Aug 2026")
    canvas.drawRightString(A4[0] - 20 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def make_pdf():
    artifact = json.loads(DATA.read_text(encoding="utf-8"))
    data = artifact["snapshot"]["datasets"]
    summary = data["summary_metrics"][0]
    results = data["paired_results"]
    styles = paragraph_styles()

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=22 * mm, title="MANDATE Agent Advantage Report",
        author="MANDATE",
    )
    story = []
    story += [
        Paragraph("TERMiX CHALLENGE - VERIFIED EVIDENCE", styles["kicker"]),
        Paragraph("MANDATE<br/>Agent Advantage Report", styles["title"]),
        Paragraph("Three real, same-input tasks comparing marketplace agents with a browser-timed human path without an agent.", styles["body"]),
        Spacer(1, 3 * mm),
        metric_strip(styles, summary),
        Spacer(1, 7 * mm),
        Paragraph("Executive summary", styles["h1"]),
        Paragraph(
            "MANDATE completed all three paired tasks required by the TermiX track, including trading and security. "
            "Each pair used the same frozen input SHA-256 and a rubric locked before either path ran. The median human "
            "time was 233.650 seconds; the median agent browser round trip was 0.2718 seconds. The median per-task "
            "speedup was 866.7x. Agents scored 10/10 on all tasks, while human scores were 2/10, 4/10, and 8/10.",
            styles["body"],
        ),
        Paragraph(
            "Observed incremental cash cost was $0 for both paths. This report therefore claims a measured speed and "
            "quality advantage, not a paid-service cost advantage.", styles["callout"]
        ),
        Spacer(1, 5 * mm),
        Paragraph("Quality on the same locked rubric", styles["h2"]),
        QualityChart(data["quality_rows"], 170 * mm),
        Paragraph("Figure 1. Quality scores on the pre-committed 10-point rubric. No results were substituted or manually rescored after either path ran.", styles["small"]),
        PageBreak(),
        Paragraph("Exact paired results", styles["h1"]),
        Paragraph("Human time is browser timed from task start to submitted answer. Agent time is the browser-observed round trip to the public production API.", styles["body"]),
    ]

    header = ["Task", "Category", "Human", "Agent", "Speedup", "Quality", "Cash cost"]
    rows = [[Paragraph(x, styles["table_header"]) for x in header]]
    for row in results:
        rows.append([
            Paragraph(f"<b>{row['task_id']}</b><br/>{row['task']}", styles["table"]),
            Paragraph(row["category"], styles["table"]),
            Paragraph(f"{row['human_seconds']:.3f} s", styles["table"]),
            Paragraph(f"{row['agent_seconds']:.4f} s", styles["table"]),
            Paragraph(f"{row['speedup_x']:.1f}x", styles["table"]),
            Paragraph(f"{row['human_quality']}/10 -> {row['agent_quality']}/10", styles["table"]),
            Paragraph("$0 -> $0", styles["table"]),
        ])
    results_table = LongTable(rows, repeatRows=1, colWidths=[42*mm, 30*mm, 19*mm, 19*mm, 17*mm, 24*mm, 20*mm])
    results_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PAPER]),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    story += [results_table, Spacer(1, 7*mm)]

    for row in results:
        story.append(KeepTogether([
            Paragraph(f"{row['task_id']} - {row['task']}", styles["h2"]),
            Paragraph(
                f"Category: {row['category']}. Time saved: {row['time_saved_seconds']:.4f} seconds. "
                f"Quality lift: +{row['quality_delta']} points. Frozen input SHA-256: "
                f"<font size='6'>{row['input_sha256']}</font>", styles["body"]
            ),
        ]))

    story += [
        Spacer(1, 3*mm),
        Paragraph("Cost interpretation", styles["h1"]),
        Paragraph(
            "Observed incremental cash cost was $0.00 on both paths. For sensitivity only, valuing the measured human "
            "time at a disclosed $15/hour yields $1.2084, $0.9735, and $0.9446 across A-01 to A-03 ($3.1265 total). "
            "This is modeled opportunity cost, not money paid. Agent hosting and development are excluded, and no "
            "marketplace service fee was charged during these runs. A future paid rerun is required before claiming a "
            "monetary advantage.", styles["body"]
        ),
        PageBreak(),
        Paragraph("Method and audit trail", styles["h1"]),
        Paragraph("Controls", styles["h2"]),
        Paragraph(
            "Both paths received the exact JSON represented by the same input digest. The rubric was visible and locked "
            "before either path started. Raw outputs retain timestamps, scorer version, timings, decisions, rejected "
            "options, calculations, and recommendations. A-02 includes a verification note for schema-preserving numeric "
            "normalization (18.0 in Python versus 18 in JSON); the value is unchanged and the reconstructed hash matches.",
            styles["body"],
        ),
        Paragraph("Evidence inventory", styles["h2"]),
    ]

    inv_header = ["Task", "Human output", "Agent output", "Hash status"]
    inv_rows = [[Paragraph(x, styles["table_header"]) for x in inv_header]]
    for row in data["evidence_inventory"]:
        inv_rows.append([
            Paragraph(row["task_id"], styles["table"]),
            Paragraph(row["human_file"], styles["table"]),
            Paragraph(row["agent_file"], styles["table"]),
            Paragraph(row["hash_status"], styles["table"]),
        ])
    inv_table = LongTable(inv_rows, repeatRows=1, colWidths=[13*mm, 55*mm, 55*mm, 47*mm])
    inv_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PAPER]),
        ("TOPPADDING", (0, 0), (-1, -1), 3*mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3*mm),
    ]))
    story += [
        inv_table,
        Spacer(1, 7*mm),
        Paragraph("Separate onchain proof", styles["h2"]),
        Paragraph(
            "ERC-8183 YieldRoute Job #506 completed a seven-step BSC Testnet lifecycle with exact 0.1 test U escrow and "
            "zero residual allowance. Its submitted deliverable binds a public live-data report and evidence SHA-256. "
            "This proves marketplace settlement mechanics separately; it was not the payment rail for these three benchmark runs.", styles["body"]
        ),
        Paragraph("Limitations", styles["h2"]),
        Paragraph(
            "The human sample is one operator and three tasks. Agent timings are API round trips, while human timings "
            "include reading and composition. Market inputs were frozen fixtures, not live capital decisions. The quality "
            "rubric is deterministic and task-specific. These controls support reproducibility but do not estimate "
            "population-wide performance or paid unit economics.", styles["body"]
        ),
        Paragraph("Sources", styles["h2"]),
        Paragraph(
            "Official TermiX track: https://www.bnbchain.org/en/hackathons/smart-money-era<br/>"
            "Onchain settlement: https://testnet.bscscan.com/tx/0xf423d6403c8e7926ea0e125c3b216226b95856fc836293645ef14c8ae531f043<br/>"
            "Evidence Passport: https://mandate-bnb-agent.vercel.app/evidence/evidence-passport-506.json<br/>"
            "Public product: https://mandate-bnb-agent.vercel.app<br/>"
            "Submission wallet: 0xD30BbB80c863c9B94622EF92337AaD65148D2EC3",
            styles["small"],
        ),
    ]

    doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)
    print(OUTPUT)


if __name__ == "__main__":
    make_pdf()
