"""Needle Small Decision v1: locally fitted heads on a frozen E5-small encoder.

This is head fine-tuning, not full encoder training or CLM-8B fine-tuning.
No generation, image decoding, credentials, or network calls are used at inference.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import sys
import time
from typing import Any

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_recall_fscore_support

MODEL_ID = "intfloat/multilingual-e5-small"
MODEL_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
ROUTES = ["review_analysis", "product_search", "clarify"]
ATTRIBUTES = ["price", "design", "convenience", "performance", "durability", "comfort"]
POLARITIES = ["none", "positive", "negative", "neutral"]
SEED = 153
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENCODER = ROOT / ".needle-cache" / "e5"
DEFAULT_ARTIFACTS = Path(__file__).resolve().parent / "models"
DEFAULT_CACHE = Path(__file__).resolve().parent / "cache"
MAX_TOKENS = 256
BATCH_SIZE = 8
# Fixed descriptions are frozen before reading held-out evaluation fixtures.
ACTION_DESCRIPTIONS = [
    "The selected target product is being reviewed or evaluated. Analyze statements about its price, design, convenience, performance, durability or comfort.",
    "The user wants to find a visible or mentioned target product from unrelated content. Search for the product; the video does not evaluate that target product.",
    "The target product or user's request is ambiguous or missing. Ask a clarifying question before analyzing or searching.",
]


def _hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def _rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _product(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("name") or value.get("id") or "unknown")[:300]
    return str(value or "unknown")[:300]


def _context(text: str, product: Any) -> str:
    return f"Target product: {_product(product)}. Context: {text}"


def _sentences(text: str) -> list[str]:
    # Keep original case and exact quote substrings. Bounded to 32 sentences.
    return [x.strip() for x in re.split(r"(?<=[.!?。！？])\s+|\n+", text) if x.strip()][:32]


def _softmax(logits: np.ndarray) -> np.ndarray:
    logits = logits - np.max(logits, axis=-1, keepdims=True)
    exp = np.exp(logits)
    return exp / exp.sum(axis=-1, keepdims=True)


def _fit_head(x: np.ndarray, y: list[str], c: float) -> dict:
    classes = sorted(set(y))
    if len(classes) == 1:
        return {"classes": classes, "constant": classes[0], "coef": [], "intercept": []}
    fit = LogisticRegression(C=c, max_iter=1500, class_weight="balanced", random_state=SEED)
    fit.fit(x, y)
    return {"classes": fit.classes_.tolist(), "coef": fit.coef_.tolist(), "intercept": fit.intercept_.tolist(), "C": c}


def _probabilities(head: dict, x: np.ndarray) -> np.ndarray:
    if "constant" in head:
        return np.ones((len(x), 1), dtype=np.float32)
    logits = x @ np.asarray(head["coef"], dtype=np.float64).T + np.asarray(head["intercept"])
    if len(head["classes"]) == 2:
        # sklearn's binary logistic head uses one coefficient vector.
        positive = 1 / (1 + np.exp(-np.clip(logits[:, 0], -60, 60)))
        return np.stack([1 - positive, positive], axis=1)
    return _softmax(logits)


def _predictions(head: dict, x: np.ndarray) -> list[str]:
    p = _probabilities(head, x)
    return [head["classes"][i] for i in np.argmax(p, axis=1)]


def _metrics(y: list[str], pred: list[str], labels: list[str]) -> dict:
    return {"n": len(y), "accuracy": float(accuracy_score(y, pred)),
            "macro_f1": float(f1_score(y, pred, labels=labels, average="macro", zero_division=0)),
            "labels": labels, "confusion_matrix": confusion_matrix(y, pred, labels=labels).tolist()}


def _attribute_examples(rows: list[dict]) -> list[dict]:
    examples = []
    for row in rows:
        for sentence in _sentences(row["text"]):
            labels = {attribute: "none" for attribute in ATTRIBUTES}
            for evidence in row.get("attributes", []):
                name, polarity, quote = evidence.get("name"), evidence.get("polarity"), evidence.get("quote", "")
                if name not in ATTRIBUTES or polarity not in POLARITIES[1:] or not quote:
                    continue
                if quote in sentence:
                    previous = labels[name]
                    labels[name] = polarity if previous in ["none", polarity] else "neutral"
            examples.append({"text": sentence, "product": row.get("product"), "labels": labels, "language": row.get("language", "unknown")})
    return examples


class Encoder:
    def __init__(self, model_dir: str | Path = DEFAULT_ENCODER, device: str | None = None):
        self.path = Path(model_dir)
        self.device = device or ("mps" if torch.backends.mps.is_available() else "cpu")
        torch.set_num_threads(2)
        torch.manual_seed(SEED)
        np.random.seed(SEED)
        self.tokenizer = AutoTokenizer.from_pretrained(str(self.path), local_files_only=True, trust_remote_code=False)
        self.model = AutoModel.from_pretrained(str(self.path), local_files_only=True, trust_remote_code=False, use_safetensors=True)
        self.model.eval()
        self.model.requires_grad_(False)
        self.model.to(self.device)
        self.parameters = sum(p.numel() for p in self.model.parameters())

    def encode(self, texts: list[str], prefix: str = "query: ", cache_dir: Path | None = None) -> np.ndarray:
        if not texts:
            return np.empty((0, self.model.config.hidden_size), dtype=np.float32)
        cache_key = hashlib.sha256(json.dumps([MODEL_REVISION, MAX_TOKENS, prefix, texts], ensure_ascii=False).encode()).hexdigest()
        cache_file = cache_dir / f"{cache_key}.npy" if cache_dir else None
        if cache_file and cache_file.exists():
            return np.load(cache_file, allow_pickle=False)
        outputs = []
        for start in range(0, len(texts), BATCH_SIZE):
            if len(texts) > 32 and start % 64 == 0:
                print(f"Embedding {start}/{len(texts)} on {self.device}", file=sys.stderr, flush=True)
            encoded = self.tokenizer([prefix + t for t in texts[start:start + BATCH_SIZE]],
                                     max_length=MAX_TOKENS, truncation=True, padding=True, return_tensors="pt")
            encoded = {k: v.to(self.device) for k, v in encoded.items()}
            with torch.inference_mode():
                hidden = self.model(**encoded).last_hidden_state
                mask = encoded["attention_mask"].unsqueeze(-1).bool()
                pooled = hidden.masked_fill(~mask, 0).sum(1) / mask.sum(1).clamp(min=1)
                pooled = torch.nn.functional.normalize(pooled, p=2, dim=1)
            outputs.append(pooled.float().cpu().numpy())
        value = np.concatenate(outputs)
        if cache_file:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            np.save(cache_file, value, allow_pickle=False)
        return value

    def truncated(self, text: str, product: Any) -> bool:
        return len(self.tokenizer.encode("query: " + _context(text, product), add_special_tokens=True)) > MAX_TOKENS


class NeedleSmallModel:
    """Persistent, local-only runtime. Keep one instance per server process."""
    def __init__(self, model_dir: str | Path = DEFAULT_ENCODER, artifact_dir: str | Path = DEFAULT_ARTIFACTS, device: str | None = None):
        self.encoder = Encoder(model_dir, device)
        self.artifact_dir = Path(artifact_dir)
        self.artifact = json.loads((self.artifact_dir / "small_heads.json").read_text(encoding="utf-8"))
        if self.artifact["encoder_revision"] != MODEL_REVISION:
            raise ValueError("Encoder/head revision mismatch")
        self.action_embeddings = self.encoder.encode(ACTION_DESCRIPTIONS, prefix="passage: ")

    def route(self, text: str, product: Any = "", with_attributes: bool = True) -> dict:
        if not isinstance(text, str) or not text.strip() or len(text) > 24000:
            raise ValueError("text must be 1..24000 characters")
        started = time.perf_counter()
        x = self.encoder.encode([_context(text, product)])
        head = self.artifact["route_head"]
        p = _probabilities(head, x)[0]
        best = int(np.argmax(p))
        ordered = np.sort(p)
        margin = float(ordered[-1] - ordered[-2]) if len(p) > 1 else 1.0
        score = float(p[best])
        raw_route = head["classes"][best]
        abstained = score < self.artifact["route_threshold"] or margin < self.artifact["margin_threshold"]
        route = "clarify" if abstained else raw_route
        result = {"route": route, "raw_route": raw_route, "scores": dict(zip(head["classes"], p.tolist())),
                  "confidence": score, "score_semantics": "uncalibrated classifier score, not purchase probability",
                  "abstained": abstained, "margin": margin, "attributes": [],
                  "model": "needle-small-decision-v1", "encoder": MODEL_ID,
                  "encoder_revision": MODEL_REVISION, "training": "fitted heads; frozen encoder",
                  "truncated": self.encoder.truncated(text, product)}
        if with_attributes and route == "review_analysis":
            result["attributes"] = self.extract_attributes(text, product)
            result["attribute_limitations"] = "Target association is model-inferred, not verified entity grounding; quotes are source sentences."
        result["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 3)
        return result

    def extract_attributes(self, text: str, product: Any) -> list[dict]:
        sentences = _sentences(text)
        x = self.encoder.encode([_context(sentence, product) for sentence in sentences])
        output = []
        for attribute in ATTRIBUTES:
            head = self.artifact["attribute_heads"][attribute]
            probabilities = _probabilities(head, x)
            for sentence, p in zip(sentences, probabilities):
                best = int(np.argmax(p))
                polarity, confidence = head["classes"][best], float(p[best])
                if polarity != "none" and confidence >= self.artifact["attribute_threshold"]:
                    output.append({"name": attribute, "polarity": polarity, "quote": sentence, "score": confidence, "target_grounding": "model_inferred_unverified"})
        return output

    def rank(self, query: str, candidates: list[dict]) -> list[dict]:
        """Pretrained semantic ranking, not a separately fine-tuned retrieval model."""
        if len(candidates) > 100:
            raise ValueError("At most 100 candidates per request")
        if not candidates:
            return []
        ids = [c.get("id") for c in candidates]
        if any(not isinstance(i, str) or not i for i in ids) or len(set(ids)) != len(ids):
            raise ValueError("Candidate IDs must be unique nonempty strings")
        q = self.encoder.encode([query])
        texts = [str(c.get("text") or c.get("description") or c.get("title") or "")[:12000] for c in candidates]
        d = self.encoder.encode(texts, prefix="passage: ")
        scores = (d @ q[0]).tolist()
        return sorted([{"id": i, "semantic_score": float(s), "score_semantics": "cosine similarity, not probability"} for i, s in zip(ids, scores)], key=lambda r: -r["semantic_score"])


def train(args: argparse.Namespace) -> dict:
    started = time.perf_counter()
    train_path, val_path = Path(args.train), Path(args.validation)
    attr_path = Path(args.attributes_train)
    attr_val_path = Path(args.attributes_validation) if args.attributes_validation else attr_path
    rows, valid = _rows(train_path), _rows(val_path)
    for row in rows + valid:
        if row["label"] not in ROUTES:
            raise ValueError("Invalid route label")
    train_fingerprints = {(_product(r.get("product")), r["text"]) for r in rows}
    if any((_product(r.get("product")), r["text"]) in train_fingerprints for r in valid):
        raise ValueError("Exact train/validation contamination")
    encoder = Encoder(args.encoder, args.device)
    cache = Path(args.cache)
    x = encoder.encode([_context(r["text"], r.get("product")) for r in rows], cache_dir=cache)
    xv = encoder.encode([_context(r["text"], r.get("product")) for r in valid], cache_dir=cache)
    y, yv = [r["label"] for r in rows], [r["label"] for r in valid]
    best_head, best_score = None, -1
    trials = []
    for c in [1, 10, 100]:
        head = _fit_head(x, y, c)
        metric = _metrics(yv, _predictions(head, xv), ROUTES)
        trials.append({"C": c, **metric})
        if metric["macro_f1"] > best_score:
            best_head, best_score = head, metric["macro_f1"]
    # Thresholds are fixed design choices, not tuned on held-out data.
    attr_source = _rows(attr_path)
    if args.attributes_validation:
        attribute_rows = _attribute_examples(attr_source)
        attribute_valid = _attribute_examples(_rows(attr_val_path))
        attr_split = "separate supplied attribute validation file"
        attribute_keys = {(_product(r["product"]), r["text"]) for r in attribute_rows}
        if any((_product(r["product"]), r["text"]) in attribute_keys for r in attribute_valid):
            raise ValueError("Exact attribute train/validation contamination")
    else:
        holdout = {"keyboard", "키보드"}
        attribute_rows = _attribute_examples([r for r in attr_source if _product(r.get("product")) not in holdout])
        attribute_valid = _attribute_examples([r for r in attr_source if _product(r.get("product")) in holdout])
        attr_split = "synthetic product holdout: keyboard/키보드 excluded from attribute training; shared templates remain"
        if not attribute_valid or not attribute_rows:
            raise ValueError("Attribute product holdout requires keyboard/키보드 and other products")
    xa = encoder.encode([_context(r["text"], r["product"]) for r in attribute_rows], cache_dir=cache)
    xav = encoder.encode([_context(r["text"], r["product"]) for r in attribute_valid], cache_dir=cache)
    heads, attr_validation = {}, {}
    for attribute in ATTRIBUTES:
        ya = [r["labels"][attribute] for r in attribute_rows]
        yav = [r["labels"][attribute] for r in attribute_valid]
        best, score = None, -1
        for c in [1, 10, 100]:
            candidate = _fit_head(xa, ya, c)
            metric = _metrics(yav, _predictions(candidate, xav), POLARITIES)
            if metric["macro_f1"] > score:
                best, score = candidate, metric["macro_f1"]
        heads[attribute] = best
        attr_validation[attribute] = _metrics(yav, _predictions(best, xav), POLARITIES)
    artifact = {"schema": "needle.small-heads.v1", "encoder": MODEL_ID,
                "encoder_revision": MODEL_REVISION, "seed": SEED,
                "training": "scikit-learn logistic regression heads on frozen normalized E5 embeddings",
                "route_head": best_head, "attribute_heads": heads,
                "route_threshold": 0.45, "margin_threshold": 0.08, "attribute_threshold": 0.65,
                "max_tokens": MAX_TOKENS, "batch_size": BATCH_SIZE,
                "train_hash": _hash_file(train_path), "validation_hash": _hash_file(val_path),
                "attributes_train_hash": _hash_file(attr_path), "attributes_validation_hash": _hash_file(attr_val_path), "attribute_split": attr_split}
    output = Path(args.output)
    _json(output / "small_heads.json", artifact)
    action_emb = encoder.encode(ACTION_DESCRIPTIONS, prefix="passage: ")
    zero_pred = [ROUTES[i] for i in np.argmax(xv @ action_emb.T, axis=1)]
    report = {"seed": SEED, "encoder": MODEL_ID, "revision": MODEL_REVISION,
              "device": encoder.device, "encoder_parameters": encoder.parameters,
              "encoder_trained": False, "route_train_rows": len(rows), "route_validation_rows": len(valid),
              "attribute_train_sentences": len(attribute_rows), "attribute_validation_sentences": len(attribute_valid), "attribute_split": attr_split,
              "route_hyperparameter_trials_validation_only": trials,
              "validation_zero_shot": _metrics(yv, zero_pred, ROUTES),
              "validation_trained_head": _metrics(yv, _predictions(best_head, xv), ROUTES),
              "validation_attributes": attr_validation,
              "training_seconds": round(time.perf_counter()-started, 3),
              "artifact_bytes": (output / "small_heads.json").stat().st_size,
              "encoder_files_bytes": sum(p.stat().st_size for p in Path(args.encoder).rglob("*") if p.is_file() and ".cache" not in p.parts),
              "versions": {p: importlib.metadata.version(p) for p in ["torch", "transformers", "scikit-learn", "numpy", "safetensors"]},
              "evaluation_policy": "No held-out eval file was opened by this training command. Synthetic fixtures are not a real-world benchmark."}
    _json(output / "training_report.json", report)
    return report


def evaluate(args: argparse.Namespace) -> dict:
    started = time.perf_counter()
    model = NeedleSmallModel(args.encoder, args.output, args.device)
    load_seconds = time.perf_counter() - started
    # This is deliberately separate from train(); heads already exist and are frozen.
    rows = _rows(Path(args.evaluation))
    x = model.encoder.encode([_context(r["text"], r.get("product")) for r in rows])
    raw = _predictions(model.artifact["route_head"], x)
    zero = [ROUTES[i] for i in np.argmax(x @ model.action_embeddings.T, axis=1)]
    y = [r["label"] for r in rows]
    probabilities = _probabilities(model.artifact["route_head"], x)
    gated, abstentions = [], []
    for pred, p in zip(raw, probabilities):
        ordered = np.sort(p)
        abstain = float(ordered[-1]) < model.artifact["route_threshold"] or float(ordered[-1]-ordered[-2]) < model.artifact["margin_threshold"]
        abstentions.append(abstain)
        gated.append("clarify" if abstain else pred)
    metrics = {"zero_shot": _metrics(y, zero, ROUTES), "trained_head_raw": _metrics(y, raw, ROUTES), "trained_head_gated": _metrics(y, gated, ROUTES)}
    by_language = {}
    for language in sorted({r.get("language", "unknown") for r in rows}):
        ix = [i for i, r in enumerate(rows) if r.get("language", "unknown") == language]
        by_language[language] = {"zero_shot": _metrics([y[i] for i in ix], [zero[i] for i in ix], ROUTES),
                                 "trained_head": _metrics([y[i] for i in ix], [gated[i] for i in ix], ROUTES)}
    attrs = _attribute_examples(rows)
    xa = model.encoder.encode([_context(r["text"], r["product"]) for r in attrs])
    attr_metrics = {}
    for attribute in ATTRIBUTES:
        gold = [r["labels"][attribute] for r in attrs]
        pred = _predictions(model.artifact["attribute_heads"][attribute], xa)
        attr_metrics[attribute] = _metrics(gold, pred, POLARITIES)
    # Full warm, uncached route calls, one request at a time. Encoding is repeated.
    latency = []
    model.route(rows[0]["text"], rows[0].get("product"), with_attributes=False)
    for row in (rows * 20)[:20]:
        t = time.perf_counter()
        model.route(row["text"], row.get("product"), with_attributes=False)
        latency.append((time.perf_counter()-t)*1000)
    report = {"schema": "needle.evaluation.v1", "evaluation_hash": _hash_file(Path(args.evaluation)),
              "heads_hash": _hash_file(Path(args.output)/"small_heads.json"), "evaluation_is_synthetic": True,
              "route": metrics, "by_language": by_language, "attributes_ungated_sentence_classification": attr_metrics,
              "abstained_requests": sum(abstentions), "non_abstained_coverage": 1-float(np.mean(abstentions)),
              "latency": {"requests": len(latency), "p50_ms": float(np.percentile(latency, 50)), "p95_ms": float(np.percentile(latency, 95)), "raw_ms": latency,
                          "measurement": "warm encoder, uncached, serial route-only requests including tokenization and head; excludes attribute extraction and HM capture"},
              "load_seconds": load_seconds, "device": model.encoder.device,
              "limitations": ["Synthetic examples, not real-video/customer validation", "Classifier scores are not calibrated probabilities", "No apples-to-apples Jev latency comparison", "Only heads trained; E5 encoder frozen; not CLM-8B"]}
    report_path = Path(args.report) if args.report else Path(args.output)/"evaluation_report.json"
    if report_path.exists() and not args.overwrite_report:
        raise FileExistsError("Evaluation report exists. Preserve the first evaluation; pass --overwrite-report only for a clearly disclosed repeat.")
    _json(report_path, report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["train", "evaluate", "predict"])
    parser.add_argument("--encoder", default=str(DEFAULT_ENCODER))
    parser.add_argument("--output", default=str(DEFAULT_ARTIFACTS))
    parser.add_argument("--cache", default=str(DEFAULT_CACHE))
    parser.add_argument("--device", choices=["mps", "cpu"])
    parser.add_argument("--train")
    parser.add_argument("--validation")
    parser.add_argument("--attributes-train")
    parser.add_argument("--attributes-validation")
    parser.add_argument("--evaluation")
    parser.add_argument("--report")
    parser.add_argument("--overwrite-report", action="store_true")
    parser.add_argument("--text")
    parser.add_argument("--product", default="")
    args = parser.parse_args()
    if args.command == "train":
        if not all([args.train, args.validation, args.attributes_train]): parser.error("train requires --train, --validation and --attributes-train")
        result = train(args)
    elif args.command == "evaluate":
        if not args.evaluation: parser.error("evaluate requires --evaluation")
        result = evaluate(args)
    else:
        if not args.text: parser.error("predict requires --text")
        result = NeedleSmallModel(args.encoder,args.output,args.device).route(args.text,args.product)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
