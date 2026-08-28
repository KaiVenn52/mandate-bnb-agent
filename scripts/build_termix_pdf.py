from __future__ import annotations

import json
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import LongTable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "evidence" / "termix" / "summary.json"
OUTPUT = ROOT / "output" / "pdf" / "MANDATE-Agent-Advantage-Report.pdf"
INK, MUTED, LINE, PAPER, YELLOW, WHITE = (colors.HexColor(x) for x in ("#171714", "#66645e", "#d4cec0", "#f4f1e8", "#f5b900", "#ffffff"))

font_path = Path(r"C:\Windows\Fonts\arial.ttf")
FONT = "Helvetica"
if font_path.exists():
    pdfmetrics.registerFont(TTFont("MandateSans", str(font_path)))
    FONT = "MandateSans"


def styles():
    return {
        "title": ParagraphStyle("title", fontName=FONT, fontSize=28, leading=31, textColor=INK, spaceAfter=7*mm),
        "k": ParagraphStyle("k", fontName=FONT, fontSize=8, leading=10, textColor=colors.HexColor("#8b6500"), spaceAfter=2*mm),
        "h1": ParagraphStyle("h1", fontName=FONT, fontSize=17, leading=21, textColor=INK, spaceBefore=5*mm, spaceAfter=3*mm),
        "h2": ParagraphStyle("h2", fontName=FONT, fontSize=12, leading=15, textColor=INK, spaceBefore=4*mm, spaceAfter=2*mm),
        "body": ParagraphStyle("body", fontName=FONT, fontSize=9.2, leading=14, textColor=INK, spaceAfter=3*mm),
        "small": ParagraphStyle("small", fontName=FONT, fontSize=7.1, leading=9.5, textColor=MUTED),
        "cell": ParagraphStyle("cell", fontName=FONT, fontSize=7.3, leading=9.4, textColor=INK),
        "head": ParagraphStyle("head", fontName=FONT, fontSize=7.3, leading=9.4, textColor=WHITE),
        "metric": ParagraphStyle("metric", fontName=FONT, fontSize=17, leading=20, textColor=INK, alignment=1),
        "label": ParagraphStyle("label", fontName=FONT, fontSize=6.5, leading=8, textColor=MUTED, alignment=1),
        "callout": ParagraphStyle("callout", fontName=FONT, fontSize=9.2, leading=14, textColor=INK, borderColor=YELLOW, borderWidth=1, borderPadding=8, backColor=colors.HexColor("#fff7d1")),
    }


def decorate(canvas, doc):
    canvas.saveState(); canvas.setStrokeColor(LINE); canvas.line(18*mm, 15*mm, A4[0]-18*mm, 15*mm)
    canvas.setFont(FONT, 7); canvas.setFillColor(MUTED); canvas.drawString(18*mm, 9*mm, "MANDATE · Final Agent Advantage Report · 28 Aug 2026")
    canvas.drawRightString(A4[0]-18*mm, 9*mm, f"Page {doc.page}"); canvas.restoreState()


def make_pdf():
    data = json.loads(DATA.read_text(encoding="utf-8")); summary, rows, grid = data["summary"], data["rows"], data["trading_record"]; s = styles()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=17*mm, bottomMargin=22*mm, title="MANDATE Agent Advantage Report", author="MANDATE")
    metrics = Table([[
        [Paragraph("3 / 3", s["metric"]), Paragraph("INDEPENDENT HIRES", s["label"])],
        [Paragraph(f'{summary["median_speedup_x"]:.1f}x', s["metric"]), Paragraph("MEDIAN SPEEDUP", s["label"])],
        [Paragraph(f'+{summary["average_quality_delta_points"]:.1f}', s["metric"]), Paragraph("AVG QUALITY POINTS", s["label"])],
        [Paragraph("0.1 test U", s["metric"]), Paragraph("SERVICE COST / TASK", s["label"])],
    ]], colWidths=[43.5*mm]*4, rowHeights=[26*mm])
    metrics.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),PAPER),("GRID",(0,0),(-1,-1),.5,LINE),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    story = [Paragraph("TERMIX CHALLENGE · FINAL HIRE-BACKED EVIDENCE", s["k"]), Paragraph("MANDATE<br/>Agent Advantage Report", s["title"]), Paragraph("Three real paired tasks comparing independently hired marketplace agents with a browser-timed human path without an agent.", s["body"]), metrics,
        Paragraph("Executive summary", s["h1"]), Paragraph(f'MANDATE completed three separate ERC-8183 hires on BSC Testnet: Jobs #642, #644 and #666. All use different client and provider wallets, escrow exactly 0.1 test U, expose public deliverables, and read COMPLETED onchain. The median human time was {summary["median_human_seconds"]:.3f} seconds versus {summary["median_agent_seconds"]:.4f} seconds for the hire-verified production round trip, a median per-task speedup of {summary["median_speedup_x"]:.1f}x. Agents scored 10/10 on all three locked rubrics; the human path scored 2/10, 4/10 and 8/10.', s["body"]),
        Paragraph("Truthful cost statement: each job used 0.1 test U, a test token with no claimed fiat value. Gas was paid in testnet tBNB, but complete lifecycle gas was not retained as an aggregate. This report makes no dollar-cost or trading-profitability claim.", s["callout"]),
        Paragraph("Exact paired results", s["h1"])]
    head = [Paragraph(x,s["head"]) for x in ("Task / category","Human","Agent","Speedup","Quality","Onchain hire")]
    table_rows=[head]
    for r in rows:
        table_rows.append([Paragraph(f'<b>{r["task_id"]}</b><br/>{r["task"]}<br/><font color="#66645e">{r["category"]}</font>',s["cell"]),Paragraph(f'{r["human_seconds"]:.3f}s',s["cell"]),Paragraph(f'{r["agent_seconds"]:.4f}s',s["cell"]),Paragraph(f'{r["speedup_x"]:.1f}x',s["cell"]),Paragraph(f'{r["human_quality"]}/10 to {r["agent_quality"]}/10',s["cell"]),Paragraph(f'Job #{r["job_id"]}<br/>Agent #{r["agent_id"]}<br/>0.1 test U',s["cell"])])
    t=LongTable(table_rows,repeatRows=1,colWidths=[52*mm,20*mm,20*mm,18*mm,24*mm,40*mm]); t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),INK),("GRID",(0,0),(-1,-1),.5,LINE),("VALIGN",(0,0),(-1,-1),"TOP"),("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE,PAPER]),("PADDING",(0,0),(-1,-1),3*mm)])); story += [t, Spacer(1,5*mm), Paragraph("Interpretation",s["h2"]), Paragraph("The largest cold-start penalty is preserved: A-01 took 2.9864 seconds rather than the sub-second A-02 and A-03 runs. Even with that untrimmed production latency, all three tasks show large time savings and higher rubric scores. Results demonstrate bounded analytical workflow execution, not autonomous custody or real-capital performance.",s["body"]), PageBreak(), Paragraph("GridPilot transparent paper record", s["h1"])]
    grid_metrics = Table([[
        [Paragraph(f'{grid["record"]["session_win_rate_pct"]}%', s["metric"]), Paragraph("SESSION WIN RATE", s["label"])],
        [Paragraph(f'{grid["record"]["traded_sessions"]} / {grid["window"]["sessions"]}', s["metric"]), Paragraph("TRADED / TESTED SESSIONS", s["label"])],
        [Paragraph(f'{grid["record"]["max_session_drawdown_pct"]}%', s["metric"]), Paragraph("MAX SESSION DRAWDOWN", s["label"])],
        [Paragraph(f'{grid["record"]["net_return_pct"]}%', s["metric"]), Paragraph("PAPER NET RETURN", s["label"])],
    ]], colWidths=[43.5*mm]*4, rowHeights=[24*mm])
    grid_metrics.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),PAPER),("GRID",(0,0),(-1,-1),.5,LINE),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    story += [grid_metrics, Spacer(1,3*mm), Paragraph(f'<b>Window:</b> {grid["window"]["start_utc"]} to {grid["window"]["end_utc"]} · 1h closed BNBUSDT candles · 24h sessions · {grid["record"]["closed_grid_cycles"]} closed cycles · ${grid["record"]["fees_usd"]} modelled pool fees.<br/><b>Policy:</b> 7-level long-only paper grid, daily recenter, adaptive width from the prior 24h move, 5% hard stop, 0.01% fee per leg.', s["body"]), Paragraph("Historical paper test - not realized PnL. The candle source is a reference market, not PancakeSwap execution. The evaluation was added after the historical window, excludes gas, slippage, liquidity impact, MEV and intra-candle ordering, and is not a future-return guarantee.", s["callout"]), Paragraph(f'Public machine-readable record: https://mandate-bnb-agent.vercel.app/evidence/termix/grid-track-record.json<br/>Evidence SHA-256: {grid["evidence_sha256"]}', s["small"]), PageBreak(), Paragraph("Onchain marketplace evidence",s["h1"])]
    for r in rows:
        txs = ", ".join(f'{k}: {v["transaction_hash"]}' for k,v in r["known_transactions"].items())
        story += [Paragraph(f'{r["task_id"]} · ERC-8183 Job #{r["job_id"]} · Agent #{r["agent_id"]}',s["h2"]), Paragraph(f'<b>Status:</b> COMPLETED · <b>Budget:</b> 0.1 test U · <b>Client:</b> {data["client"]}<br/><b>Provider:</b> {data["provider"]}<br/><b>Deliverable:</b> {r["deliverable_url"]}<br/><b>Known transactions:</b> {txs}',s["small"])]
    story += [Paragraph("Methodology",s["h1"]), Paragraph("Both paths received the same frozen JSON identified by the same SHA-256 digest and a task-specific 10-point rubric locked before execution. Human time was measured in the browser from task start to submitted answer and is self-attested. Agent time is a fresh production API round trip recorded only after the backend verified the matching completed job, distinct wallets, funded budget and task category.",s["body"]), Paragraph("Limitations",s["h2"]), Paragraph("The sample contains three controlled tasks and one human operator. Frozen fixtures improve reproducibility but do not represent changing market conditions. Agent and human timing boundaries differ by design. Quality scoring is deterministic rather than expert-panel review. Full lifecycle gas was not aggregated. No conclusion is drawn about population performance, fiat unit economics, custody safety or investment returns. The GridPilot paper record is a separate post-hoc diagnostic and is not part of the paired quality score.",s["body"]), Paragraph("Audit links",s["h2"]), Paragraph("Product: https://mandate-bnb-agent.vercel.app<br/>Interactive report: https://mandate-bnb-agent.vercel.app/evidence/agent-advantage-report.html<br/>Machine-readable summary: https://mandate-bnb-agent.vercel.app/evidence/termix/summary.json<br/>Grid paper record: https://mandate-bnb-agent.vercel.app/evidence/termix/grid-track-record.json<br/>Onchain inventory: https://mandate-bnb-agent.vercel.app/evidence/termix/onchain-hires.json<br/>Submission wallet: 0xD30BbB80c863c9B94622EF92337AaD65148D2EC3",s["small"])]
    doc.build(story,onFirstPage=decorate,onLaterPages=decorate); print(OUTPUT)


if __name__ == "__main__": make_pdf()
