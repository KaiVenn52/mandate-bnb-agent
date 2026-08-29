"""Reproducible historical paper record for GridPilot.

This is deliberately not presented as realized trading performance. It uses
public, closed BNBUSDT hourly candles and a fixed long-only grid policy so a
reviewer can inspect the window, fees, risk and exact evaluation method.
"""

from __future__ import annotations

import hashlib
import json
import math
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any


KLINES_URL = "https://data-api.binance.vision/api/v3/klines?symbol=BNBUSDT&interval=1h"


class TrackRecordDataError(RuntimeError):
    pass


def _fetch_klines(limit: int = 720) -> list[list[Any]]:
    request = urllib.request.Request(f"{KLINES_URL}&limit={limit}", headers={"User-Agent": "MANDATE/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read())
    except (OSError, ValueError, urllib.error.URLError) as exc:
        raise TrackRecordDataError(f"Historical candle read failed: {exc}") from exc
    if not isinstance(payload, list) or len(payload) < 48:
        raise TrackRecordDataError("Historical source returned fewer than 48 hourly candles")
    return payload


def _paper_session(rows: list[list[Any]], capital_usd: float, fee_pct: float, half_width_pct: float) -> dict[str, Any]:
    centre = float(rows[0][1])
    hard_stop = centre * 0.95
    lower = centre * (1 - half_width_pct / 100)
    upper = centre * (1 + half_width_pct / 100)
    step = (upper - lower) / 6
    buy_levels = [lower + step * index for index in range(3)]
    order_notional = capital_usd / 7
    cash = capital_usd
    positions: dict[int, tuple[float, float, int]] = {}
    fees = 0.0
    closed_cycles = 0
    stopped = False
    peak_equity = capital_usd
    max_drawdown = 0.0

    for candle_index, row in enumerate(rows):
        high, low, close = float(row[2]), float(row[3]), float(row[4])
        if low <= hard_stop and positions:
            for units, _, _ in positions.values():
                proceeds = units * hard_stop
                exit_fee = proceeds * fee_pct / 100
                cash += proceeds - exit_fee
                fees += exit_fee
            positions.clear()
            stopped = True
            break

        # A position must survive at least one closed candle before it can win.
        for level_index, (units, target, opened_at) in list(positions.items()):
            if candle_index > opened_at and high >= target:
                proceeds = units * target
                exit_fee = proceeds * fee_pct / 100
                cash += proceeds - exit_fee
                fees += exit_fee
                closed_cycles += 1
                del positions[level_index]

        for level_index, entry in enumerate(buy_levels):
            if level_index not in positions and low <= entry and cash >= order_notional:
                entry_fee = order_notional * fee_pct / 100
                units = (order_notional - entry_fee) / entry
                cash -= order_notional
                fees += entry_fee
                positions[level_index] = (units, entry + step, candle_index)

        equity = cash + sum(units * close for units, _, _ in positions.values())
        peak_equity = max(peak_equity, equity)
        if peak_equity > 0:
            max_drawdown = max(max_drawdown, (peak_equity - equity) / peak_equity * 100)

    final_close = float(rows[-1][4])
    for units, _, _ in positions.values():
        proceeds = units * final_close
        exit_fee = proceeds * fee_pct / 100
        cash += proceeds - exit_fee
        fees += exit_fee

    pnl = cash - capital_usd
    return {
        "net_pnl_usd": round(pnl, 4),
        "net_return_pct": round(pnl / capital_usd * 100, 4),
        "closed_grid_cycles": closed_cycles,
        "max_drawdown_pct": round(max_drawdown, 4),
        "hard_stop_triggered": stopped,
        "fees_usd": round(fees, 4),
    }


def build_grid_track_record(rows: list[list[Any]], capital_usd: float = 5000, fee_pct: float = 0.01) -> dict[str, Any]:
    closed_rows = rows[:-1]  # never score the still-open hourly candle
    sessions: list[list[list[Any]]] = []
    results: list[dict[str, Any]] = []
    adaptive_widths: list[float] = []
    for index in range(24, len(closed_rows) - 23, 24):
        lookback = closed_rows[index - 24:index]
        session = closed_rows[index:index + 24]
        prior_move_pct = abs(float(lookback[-1][4]) / float(lookback[0][1]) - 1) * 100
        half_width = max(1.5, min(4.0, prior_move_pct * 1.4 + 1.0))
        sessions.append(session)
        adaptive_widths.append(half_width)
        results.append(_paper_session(session, capital_usd, fee_pct, half_width))
    traded = [item for item in results if item["closed_grid_cycles"] > 0 or item["hard_stop_triggered"]]
    wins = sum(1 for item in traded if item["net_pnl_usd"] > 0)
    losses = sum(1 for item in traded if item["net_pnl_usd"] <= 0)
    net_pnl = sum(item["net_pnl_usd"] for item in results)
    first_open = int(closed_rows[0][0])
    last_close = int(closed_rows[-1][6])
    payload: dict[str, Any] = {
        "schema": "mandate.grid-paper-record.v1",
        "agent": {"erc8004_id": 1805, "name": "GridPilot"},
        "label": "HISTORICAL PAPER TEST · NOT REALIZED PNL",
        "source": {
            "provider": "Binance Data API",
            "symbol": "BNBUSDT",
            "interval": "1h",
            "url": KLINES_URL,
            "closed_candles": len(closed_rows),
            "fee_source": "PancakeSwap V3 pool 0x172fcD41E0913e95784454622d1c3724f546f849 fee() = 100",
        },
        "window": {
            "start_utc": datetime.fromtimestamp(first_open / 1000, timezone.utc).isoformat(),
            "end_utc": datetime.fromtimestamp(last_close / 1000, timezone.utc).isoformat(),
            "sessions": len(results),
            "session_hours": 24,
        },
        "policy": {
            "capital_usd": capital_usd,
            "grid_levels": 7,
            "adaptive_half_width_pct": {
                "formula": "max(1.5, min(4.0, prior_24h_move_pct * 1.4 + 1.0))",
                "observed_min": round(min(adaptive_widths), 4),
                "observed_max": round(max(adaptive_widths), 4),
            },
            "hard_stop_pct": 5,
            "fee_pct_per_leg": fee_pct,
            "same_candle_round_trips": "not counted",
            "execution": "long-only paper grid; daily recenter; closed candles only",
        },
        "record": {
            "traded_sessions": len(traded),
            "winning_sessions": wins,
            "losing_sessions": losses,
            "session_win_rate_pct": round(wins / len(traded) * 100, 2) if traded else None,
            "net_pnl_usd": round(net_pnl, 2),
            "net_return_pct": round(net_pnl / (capital_usd * max(1, len(results))) * 100, 4),
            "max_session_drawdown_pct": round(max((item["max_drawdown_pct"] for item in results), default=0), 4),
            "hard_stop_sessions": sum(1 for item in results if item["hard_stop_triggered"]),
            "closed_grid_cycles": sum(item["closed_grid_cycles"] for item in results),
            "fees_usd": round(sum(item["fees_usd"] for item in results), 2),
        },
        "risk_exposure": {
            "position_side": "long-only",
            "leverage": 0,
            "capital_base_usd": capital_usd,
            "hard_stop_pct": 5,
            "max_loss_if_hard_stop_usd": round(capital_usd * 0.05, 2),
            "exposure_model": "paper position notional; no borrowed capital",
        },
        "onchain_evidence": {
            "status": "none",
            "chain_id": 56,
            "transaction_count": 0,
            "transactions": [],
            "verification_url": None,
            "note": "No PancakeSwap orders were executed. A real trading record requires provider-owned testnet or mainnet transaction receipts.",
        },
        "limitations": [
            "This is a deterministic historical paper test, not live or realized trading performance.",
            "The candle source is BNBUSDT reference-market data, not PancakeSwap execution data.",
            "The evaluation was added after the historical window and is not a pre-committed forward record.",
            "It excludes slippage, gas, liquidity impact, MEV and intra-candle path ordering.",
            "A session win rate must not be interpreted as a future-return guarantee.",
        ],
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    payload["evidence_sha256"] = hashlib.sha256(canonical.encode()).hexdigest()
    return payload


def run_grid_track_record(days: int = 30) -> dict[str, Any]:
    limit = max(48, min(720, math.ceil(days * 24) + 1))
    return build_grid_track_record(_fetch_klines(limit))
