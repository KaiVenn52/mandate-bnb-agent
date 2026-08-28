from app.grid_track_record import build_grid_track_record


def candle(hour: int, open_price: float, high: float, low: float, close: float):
    opened = 1_700_000_000_000 + hour * 3_600_000
    return [opened, str(open_price), str(high), str(low), str(close), "1", opened + 3_599_999]


def test_grid_track_record_is_labelled_and_reproducible():
    rows = []
    for hour in range(73):
        centre = 700.0
        rows.append(candle(hour, centre, 712.0, 688.0, 702.0))

    result = build_grid_track_record(rows)

    assert result["label"] == "HISTORICAL PAPER TEST · NOT REALIZED PNL"
    assert result["window"]["sessions"] == 2
    assert result["policy"]["hard_stop_pct"] == 5
    assert result["record"]["closed_grid_cycles"] > 0
    assert result["record"]["session_win_rate_pct"] is not None
    assert len(result["evidence_sha256"]) == 64
    assert any("not live" in item.lower() for item in result["limitations"])
