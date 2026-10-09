import json

import pytest

from backend import model_card


def test_debris_metrics_come_from_the_logged_confusion_matrix():
    parsed = model_card.parse_log(model_card.LOG_PATH.read_text(encoding="utf-8"))
    counts = parsed["debrisCounts"]
    assert counts == {"truePositivePixels": 335, "predictedPixels": 903, "referencePixels": 381}
    metrics = parsed["metrics"]
    assert metrics["precision"] == pytest.approx(335 / 903, abs=1e-4)
    assert metrics["recall"] == pytest.approx(335 / 381, abs=1e-4)
    assert metrics["iou"] == pytest.approx(335 / (903 + 381 - 335), abs=1e-4)
    assert metrics["f1"] == pytest.approx(0.52, abs=0.005)
    assert parsed["logCheckpoint"].endswith("trained_models/best_model_marine_debris.pth")
    assert not parsed["logCheckpoint"].startswith("C:")


def test_model_card_json_is_current():
    stored = json.loads(model_card.MODEL_CARD_PATH.read_text(encoding="utf-8"))
    assert stored == model_card.build_model_card()
    assert stored["isPlaceholder"] is False
