"""
Analyst Review Persistence Store.
Stores analyst verification decisions separately from immutable observation model outputs in data/reviews.json.
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("backend.reviews")

VALID_REVIEW_STATUSES = ("unreviewed", "confirmed", "false_positive", "uncertain")


@dataclass
class ReviewRecord:
    id: str
    observation_id: str
    detection_id: Optional[str]  # None for scene-level review
    status: str                  # unreviewed, confirmed, false_positive, uncertain
    notes: str = ""
    reviewer_name: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "observationId": self.observation_id,
            "detectionId": self.detection_id,
            "status": self.status,
            "notes": self.notes,
            "reviewerName": self.reviewer_name,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


class ReviewStore:
    """Thread-safe persistent store for analyst review records."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self._reviews: Dict[str, ReviewRecord] = {}  # key: review_id or obsId:detId
        self._load()

    def _key(self, observation_id: str, detection_id: Optional[str]) -> str:
        return f"{observation_id}:{detection_id or 'scene'}"

    def _load(self) -> None:
        if not self.file_path.exists():
            self._reviews = {}
            return

        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    rec = ReviewRecord(
                        id=item.get("id", self._key(item["observationId"], item.get("detectionId"))),
                        observation_id=item["observationId"],
                        detection_id=item.get("detectionId"),
                        status=item.get("status", "unreviewed"),
                        notes=item.get("notes", ""),
                        reviewer_name=item.get("reviewerName"),
                        created_at=item.get("createdAt", datetime.now(timezone.utc).isoformat()),
                        updated_at=item.get("updatedAt", datetime.now(timezone.utc).isoformat()),
                    )
                    self._reviews[rec.id] = rec
        except Exception as exc:
            logger.error(f"Failed to load reviews from {self.file_path}: {exc}")
            self._reviews = {}

    def _save(self) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        data = [rec.to_dict() for rec in self._reviews.values()]

        # Atomic file write using staging file
        temp_fd, temp_path = tempfile.mkstemp(dir=self.file_path.parent, prefix="reviews_stage_")
        try:
            with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(temp_path, self.file_path)
        except Exception as exc:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            logger.error(f"Failed to save reviews to {self.file_path}: {exc}")

    def get_review(self, observation_id: str, detection_id: Optional[str] = None) -> Optional[ReviewRecord]:
        key = self._key(observation_id, detection_id)
        return self._reviews.get(key)

    def list_reviews_for_observation(self, observation_id: str) -> List[ReviewRecord]:
        return [r for r in self._reviews.values() if r.observation_id == observation_id]

    def list_all_reviews(self) -> List[ReviewRecord]:
        return list(self._reviews.values())

    def save_review(
        self,
        observation_id: str,
        detection_id: Optional[str],
        status: str,
        notes: str = "",
        reviewer_name: Optional[str] = None,
    ) -> ReviewRecord:
        if status not in VALID_REVIEW_STATUSES:
            raise ValueError(f"Invalid review status: {status}. Must be one of {VALID_REVIEW_STATUSES}.")

        key = self._key(observation_id, detection_id)
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        if key in self._reviews:
            rec = self._reviews[key]
            rec.status = status
            rec.notes = notes
            if reviewer_name:
                rec.reviewer_name = reviewer_name
            rec.updated_at = now
        else:
            rec = ReviewRecord(
                id=key,
                observation_id=observation_id,
                detection_id=detection_id,
                status=status,
                notes=notes,
                reviewer_name=reviewer_name,
                created_at=now,
                updated_at=now,
            )
            self._reviews[key] = rec

        self._save()
        return rec

    def get_summary_counts(self, observation_id: Optional[str] = None) -> Dict[str, int]:
        records = (
            self.list_reviews_for_observation(observation_id)
            if observation_id
            else self.list_all_reviews()
        )
        counts = {"unreviewed": 0, "confirmed": 0, "false_positive": 0, "uncertain": 0}
        for r in records:
            if r.status in counts:
                counts[r.status] += 1
        return counts
