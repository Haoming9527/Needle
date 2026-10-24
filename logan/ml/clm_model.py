"""Experimental Needle CLM router: frozen MLX Qwen3-8B-4bit, original CLM heads.

Only the final linear layers of the released state/action heads are fine-tuned.
This is not full 8B fine-tuning and quantization does not reproduce the reference
BF16 encoder exactly. The model consumes text evidence, not images or audio.
Base: https://huggingface.co/Contrastive-LM/CLM-v0.1-8B (Apache-2.0).
"""
from __future__ import annotations

import argparse
from collections import OrderedDict, defaultdict
import copy
import gc
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import time
from typing import Any

import numpy as np
import torch
from torch import nn
from torch.nn import functional as F

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
ENCODER_ID = "mlx-community/Qwen3-8B-4bit"
ENCODER_REVISION = "545dc4251c05440727734bcd94334791f6ab0192"
BASE_ID = "Contrastive-LM/CLM-v0.1-8B"
BASE_REVISION = "e939398d4556fcd9400c76fa8c5a513202f42b0a"
BASE_SHA256 = "b2b4a8c9c2d39263eff78a351eb909a342ce9b3bf21a3f07c1d1bf15f1c4eda5"
DEFAULT_ENCODER = ROOT / ".needle-cache/qwen3-8b-4bit"
DEFAULT_BASE = ROOT / ".needle-cache/clm/CLM_v0.1-8B.pt"
DEFAULT_OUTPUT = HERE / "models"
DEFAULT_CACHE = HERE / "cache/clm"
ROUTES = ["review_analysis", "product_search", "clarify"]
INSTRUCTIONS = "Choose the route for the selected target product using only this evidence."
ACTIONS = [
    "The selected target product is being reviewed or evaluated. Analyze the product claims and buying attributes.",
    "Find a visible or mentioned target product in unrelated content. The content does not review the selected product.",
    "The target product or usable evidence is missing, unrelated, or ambiguous. Ask for clarification.",
]
SEED = 153
MAX_TOKENS = 128
EXPECTED_CFG = {"hidden_size": 4096, "projection_dim": 512, "width": 1536,
                "depth": 3, "activation": "gelu", "layernorm": True, "residual": False}


def file_hash(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            value.update(chunk)
    return value.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def read_rows(path: Path) -> list[dict]:
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not rows or any(r.get("label") not in ROUTES or not isinstance(r.get("text"), str) for r in rows):
        raise ValueError("Dataset must contain nonempty text rows with supported route labels")
    return rows


def product_name(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("name") or value.get("id") or "unknown"
    return str(value or "unknown")[:300]


def state_text(text: str, product: Any = "") -> str:
    return f"Target product: {product_name(product)}\nEvidence: {text.strip()}\n\n{INSTRUCTIONS}"


def selected_training_rows(rows: list[dict], per_cell: int = 20) -> list[dict]:
    """Deterministic language/label subset, without reading validation or eval."""
    groups: dict[tuple, list] = defaultdict(list)
    for row in rows:
        groups[(row.get("language", "unknown"), row["label"])].append(row)
    selected = []
    for key in sorted(groups):
        # Hash ordering spreads selection across templates and products reproducibly.
        pool = sorted(groups[key], key=lambda r: hashlib.sha256(
            f"{SEED}:{r.get('id', '')}:{r['text']}".encode()).hexdigest())
        selected.extend(pool[:per_cell] if per_cell else pool)
    return selected


class MLXEncoder:
    """Batch-one last-token pooling with bounded RAM and resumable disk caches."""
    def __init__(self, model_dir: str | Path = DEFAULT_ENCODER, max_tokens: int = MAX_TOKENS,
                 cache_dir: str | Path | None = DEFAULT_CACHE, memory_cache: int = 128):
        if max_tokens not in (128, 256):
            raise ValueError("This laptop experiment supports max_tokens 128 or 256")
        self.path, self.max_tokens = Path(model_dir), max_tokens
        self.cache_dir = Path(cache_dir) if cache_dir else None
        self.memory_cache_size = memory_cache
        self.memory: OrderedDict[str, np.ndarray] = OrderedDict()
        self.model = self.tokenizer = None
        self.stats = {"encoded": 0, "disk_hits": 0, "memory_hits": 0,
                      "truncated": 0, "encoder_ms": [], "peak_mlx_bytes": 0,
                      "encoder_load_seconds": 0.0}

    def load(self) -> None:
        if self.model is not None:
            return
        if not (self.path / "model.safetensors").is_file():
            raise FileNotFoundError(f"Download pinned encoder {ENCODER_ID}@{ENCODER_REVISION} to {self.path}")
        config = json.loads((self.path / "config.json").read_text(encoding="utf-8"))
        if config.get("model_type") != "qwen3" or config.get("hidden_size") != 4096 or config.get("quantization", {}).get("bits") != 4:
            raise ValueError("Expected Qwen3-8B 4096-dimensional 4-bit MLX encoder")
        import mlx.core as mx
        from mlx_lm import load
        started = time.perf_counter()
        # This is a local directory: load never resolves a remote model identifier.
        self.model, self.tokenizer = load(str(self.path), tokenizer_config={"trust_remote_code": False})
        self.model.eval()
        mx.eval(self.model.parameters())
        self.stats["encoder_load_seconds"] += time.perf_counter() - started

    def token_count(self, text: str) -> int:
        if self.tokenizer is None:
            from transformers import AutoTokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(str(self.path), local_files_only=True,
                                                          trust_remote_code=False)
        return len(self.tokenizer.encode(text, add_special_tokens=False))

    def close(self) -> None:
        self.model = self.tokenizer = None
        self.memory.clear()
        gc.collect()
        try:
            import mlx.core as mx
            mx.clear_cache()
        except ImportError:
            pass

    def _key(self, text: str, role: str) -> str:
        return hashlib.sha256(json.dumps([ENCODER_ID, ENCODER_REVISION, self.max_tokens,
                                         "last-token-l2-no-special-v1", role, text], ensure_ascii=False).encode()).hexdigest()

    def encode_one(self, text: str, role: str = "state", use_cache: bool = True) -> np.ndarray:
        if role not in ("state", "action"):
            raise ValueError("role must be state or action")
        key = self._key(text, role)
        path = self.cache_dir / (key + ".npy") if self.cache_dir else None
        if use_cache and key in self.memory:
            self.stats["memory_hits"] += 1
            self.memory.move_to_end(key)
            return self.memory[key].copy()
        if use_cache and path and path.exists():
            value = np.load(path, allow_pickle=False)
            if value.shape != (4096,) or not np.isfinite(value).all():
                raise ValueError(f"Invalid cached embedding: {path}")
            self.stats["disk_hits"] += 1
        else:
            self.load()
            import mlx.core as mx
            started = time.perf_counter()
            ids = self.tokenizer.encode(text, add_special_tokens=False)
            if not ids:
                ids = self.tokenizer.encode(" ", add_special_tokens=False)
            cap = self.max_tokens - 1
            self.stats["truncated"] += int(len(ids) > cap)
            ids = ids[-cap:] if role == "state" else ids[:cap]
            # No padding at batch size one. Qwen3Model returns final-RMSNorm hidden
            # states; the outer Model would allocate vocabulary logits unnecessarily.
            hidden = self.model.model(mx.array([ids], dtype=mx.int32))
            pooled = hidden[0, -1].astype(mx.float32)
            pooled = pooled / mx.maximum(mx.linalg.norm(pooled), 1e-12)
            mx.eval(pooled)
            value = np.array(pooled, dtype=np.float32)
            del hidden, pooled
            self.stats["encoder_ms"].append((time.perf_counter() - started) * 1000)
            self.stats["encoded"] += 1
            self.stats["peak_mlx_bytes"] = max(self.stats["peak_mlx_bytes"], int(mx.get_peak_memory()))
            if path and use_cache:
                path.parent.mkdir(parents=True, exist_ok=True)
                temporary = path.with_suffix(".tmp")
                with temporary.open("wb") as handle:
                    np.save(handle, value, allow_pickle=False)
                temporary.replace(path)
            mx.clear_cache()
        if use_cache and self.memory_cache_size:
            self.memory[key] = value.copy()
            self.memory.move_to_end(key)
            while len(self.memory) > self.memory_cache_size:
                self.memory.popitem(last=False)
        return value

    def encode(self, texts: list[str], role: str = "state", use_cache: bool = True,
               progress: bool = False) -> np.ndarray:
        values = []
        for i, text in enumerate(texts):
            values.append(self.encode_one(text, role, use_cache))
            if progress and (i % 5 == 0 or i + 1 == len(texts)):
                print(f"[clm encode {role}] {i + 1}/{len(texts)}; new={self.stats['encoded']}; disk_hits={self.stats['disk_hits']}", flush=True)
        return np.stack(values) if values else np.empty((0, 4096), dtype=np.float32)


class ProjectionHead(nn.Module):
    """Exact released width1536/depth3/GELU/LayerNorm/nonresidual architecture."""
    def __init__(self):
        super().__init__()
        self.inp = nn.Linear(4096, 1536)
        self.hidden = nn.ModuleList([nn.Linear(1536, 1536)])
        self.norms = nn.ModuleList([nn.LayerNorm(1536)])
        self.out = nn.Linear(1536, 512)
        self.act = nn.GELU()

    def features(self, value: torch.Tensor) -> torch.Tensor:
        value = self.act(self.inp(value))
        return self.act(self.norms[0](self.hidden[0](value)))

    def forward(self, value: torch.Tensor) -> torch.Tensor:
        return F.normalize(self.out(self.features(value)), dim=-1)


class CLMHeads(nn.Module):
    def __init__(self, base: str | Path = DEFAULT_BASE):
        super().__init__()
        self.path = Path(base)
        self.base_sha256 = file_hash(self.path)
        if self.base_sha256 != BASE_SHA256:
            raise ValueError("Released CLM base checkpoint SHA256 mismatch")
        # weights_only rejects arbitrary pickle globals; never relax this flag.
        ck = torch.load(self.path, map_location="cpu", weights_only=True)
        cfg = ck["cfg"]
        for key, expected in EXPECTED_CFG.items():
            if cfg.get(key, ck.get(key)) != expected:
                raise ValueError(f"Unexpected CLM head architecture for {key}")
        self.state_head, self.action_head = ProjectionHead(), ProjectionHead()
        self.state_head.load_state_dict(ck["state_head"], strict=True)
        self.action_head.load_state_dict(ck["action_head"], strict=True)
        self.register_buffer("scale", torch.as_tensor(ck["logit_scale"]).float().exp().clamp(max=100.0))
        self.requires_grad_(False)
        self.eval()

    @torch.inference_mode()
    def logits(self, states: np.ndarray, actions: np.ndarray) -> torch.Tensor:
        return self.scale * (self.state_head(torch.from_numpy(states)) @ self.action_head(torch.from_numpy(actions)).T)

    def load_partial(self, artifact_dir: Path, apply_unpromoted: bool = False) -> dict:
        from safetensors.torch import load_file
        metadata = json.loads((artifact_dir / "clm_partial_head.json").read_text(encoding="utf-8"))
        if metadata["base_sha256"] != self.base_sha256 or metadata["encoder_revision"] != ENCODER_REVISION:
            raise ValueError("CLM base/encoder mismatch; refusing incompatible fine-tuned layers")
        weights_path = artifact_dir / "clm_partial_head.safetensors"
        if file_hash(weights_path) != metadata["weights_sha256"]:
            raise ValueError("CLM partial-head checksum mismatch")
        tensors = load_file(str(weights_path), device="cpu")
        expected = {f"{head}.out.{part}" for head in ("state_head", "action_head") for part in ("weight", "bias")}
        if set(tensors) != expected:
            raise ValueError("Unexpected partial-head tensor names")
        if metadata.get("promoted", False) or apply_unpromoted:
            self.load_state_dict(tensors, strict=False)
        return metadata


def metrics(labels: list[str], predictions: list[str]) -> dict:
    matrix = np.zeros((len(ROUTES), len(ROUTES)), dtype=np.int64)
    for gold, predicted in zip(labels, predictions):
        matrix[ROUTES.index(gold), ROUTES.index(predicted)] += 1
    f1 = []
    for i in range(len(ROUTES)):
        denominator = matrix[i].sum() + matrix[:, i].sum()
        f1.append(2 * matrix[i, i] / denominator if denominator else 0)
    return {"n": len(labels), "accuracy": float(np.trace(matrix) / len(labels)),
            "macro_f1": float(np.mean(f1)), "labels": ROUTES, "confusion_matrix": matrix.tolist()}


def predictions(logits: torch.Tensor) -> list[str]:
    return [ROUTES[i] for i in logits.argmax(dim=1).tolist()]


def gated_predictions(logits: torch.Tensor, threshold: float = 0.55, margin_threshold: float = 0.1) -> list[str]:
    probabilities = logits.softmax(dim=1).numpy()
    output = []
    for p in probabilities:
        ordered = np.sort(p)
        output.append("clarify" if ordered[-1] < threshold or ordered[-1] - ordered[-2] < margin_threshold else ROUTES[int(np.argmax(p))])
    return output


class NeedleCLMModel:
    """Persistent local router. Attributes remain the separate Needle small model."""
    def __init__(self, model_dir: str | Path = DEFAULT_ENCODER, base: str | Path = DEFAULT_BASE,
                 artifact_dir: str | Path = DEFAULT_OUTPUT, tuned: bool = True,
                 cache_dir: str | Path | None = None, max_tokens: int = MAX_TOKENS):
        torch.set_num_threads(1)
        self.heads = CLMHeads(base)
        self.metadata = self.heads.load_partial(Path(artifact_dir)) if tuned else None
        if self.metadata:
            max_tokens = self.metadata["max_tokens"]
        self.encoder = MLXEncoder(model_dir, max_tokens, cache_dir)
        self.actions = self.encoder.encode(ACTIONS, "action")
        with torch.inference_mode():
            self.projected_actions = self.heads.action_head(torch.from_numpy(self.actions))
        self.tuned = bool(tuned and self.metadata and self.metadata.get("promoted", False))

    def route(self, text: str, product: Any = "", use_cache: bool = True, with_attributes: bool = False) -> dict:
        if not isinstance(text, str) or not text.strip() or len(text) > 24000:
            raise ValueError("text must be 1..24000 characters")
        started = time.perf_counter()
        context = state_text(text, product)
        tokens = self.encoder.token_count(context)
        if tokens > self.encoder.max_tokens - 1:
            # Training preserves the original tail-truncation recipe. Serving must
            # not silently remove the leading target product from longer evidence.
            return {"route": "clarify", "raw_route": None, "scores": {}, "confidence": 0.0,
                    "margin": 0.0, "abstained": True, "reason": "context_truncated",
                    "truncated": True, "input_tokens": tokens, "attributes": [],
                    "model": "needle-clm-partial-head-v1" if self.tuned else "clm-original-heads-qwen3-4bit",
                    "encoder": ENCODER_ID, "encoder_revision": ENCODER_REVISION,
                    "score_semantics": "No model decision: context exceeds validated token limit",
                    "max_tokens": self.encoder.max_tokens,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000, 3)}
        value = self.encoder.encode_one(context, "state", use_cache)
        with torch.inference_mode():
            logits = self.heads.scale * (self.heads.state_head(torch.from_numpy(value[None, :])) @ self.projected_actions.T)
            probs = logits.softmax(dim=-1)[0].numpy()
        raw = ROUTES[int(np.argmax(probs))]
        sorted_scores = np.sort(probs)
        margin = float(sorted_scores[-1] - sorted_scores[-2])
        abstained = float(sorted_scores[-1]) < 0.55 or margin < 0.1
        result = {"route": "clarify" if abstained else raw, "raw_route": raw,
                  "scores": dict(zip(ROUTES, probs.tolist())), "confidence": float(sorted_scores[-1]),
                  "margin": margin, "abstained": abstained, "attributes": [],
                  "model": "needle-clm-partial-head-v1" if self.tuned else "clm-original-heads-qwen3-4bit",
                  "encoder": ENCODER_ID, "encoder_revision": ENCODER_REVISION,
                  "training": "final state/action projection layers only; frozen quantized 8B backbone" if self.tuned else "released CLM heads; no task fine-tuning",
                  "score_semantics": "uncalibrated candidate-relative score, not purchase probability",
                  "max_tokens": self.encoder.max_tokens, "truncated": False, "input_tokens": tokens,
                  "elapsed_ms": round((time.perf_counter() - started) * 1000, 3)}
        if with_attributes:
            result["attribute_status"] = "CLM router does not extract attributes; use the separate small model on review_analysis"
        return result


def versions() -> dict:
    values = {"python": platform.python_version(), "machine": platform.machine(), "platform": platform.platform()}
    for package in ("torch", "mlx", "mlx-lm", "numpy", "transformers", "safetensors"):
        try:
            values[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            pass
    return values


def train(args: argparse.Namespace) -> dict:
    started = time.perf_counter()
    torch.set_num_threads(1)
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    training_all, validation = read_rows(Path(args.train)), read_rows(Path(args.validation))
    rows = selected_training_rows(training_all, args.per_cell)
    train_keys = {(r["text"], product_name(r.get("product"))) for r in rows}
    if any((r["text"], product_name(r.get("product"))) in train_keys for r in validation):
        raise ValueError("Exact train/validation contamination")
    encoder = MLXEncoder(args.encoder, args.max_tokens, args.cache)
    try:
        x = encoder.encode([state_text(r["text"], r.get("product")) for r in rows], progress=True)
        xv = encoder.encode([state_text(r["text"], r.get("product")) for r in validation], progress=True)
        actions = encoder.encode(ACTIONS, "action", progress=True)
        validation_truncated = [encoder.token_count(state_text(r["text"], r.get("product"))) > args.max_tokens - 1 for r in validation]
        encoding_stats = copy.deepcopy(encoder.stats)
    finally:
        encoder.close()
    heads = CLMHeads(args.base)
    labels, labels_v = [r["label"] for r in rows], [r["label"] for r in validation]
    targets = torch.tensor([ROUTES.index(y) for y in labels], dtype=torch.long)
    zero = heads.logits(xv, actions)
    zero_metrics = metrics(labels_v, predictions(zero))
    # Cached pre-output features preserve the frozen encoder and the frozen prefix
    # of the original projection heads. Only the two final Linear layers get grads.
    with torch.no_grad():
        sx = heads.state_head.features(torch.from_numpy(x))
        sv = heads.state_head.features(torch.from_numpy(xv))
        av = heads.action_head.features(torch.from_numpy(actions))
    for head in (heads.state_head, heads.action_head):
        head.out.requires_grad_(True)
    parameters = [p for p in heads.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(parameters, lr=args.learning_rate, weight_decay=1e-3)
    # Preserve released baseline as the deployment incumbent. The best trained
    # candidate is saved for inspection even if it never beats that incumbent.
    baseline_score = zero_metrics["macro_f1"]
    best_score, best_epoch, best_weights, history = -1.0, 0, None, []
    for epoch in range(1, args.epochs + 1):
        optimizer.zero_grad(set_to_none=True)
        logits = heads.scale * (F.normalize(heads.state_head.out(sx), dim=-1) @ F.normalize(heads.action_head.out(av), dim=-1).T)
        loss = F.cross_entropy(logits, targets, label_smoothing=0.05)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(parameters, 1.0)
        optimizer.step()
        with torch.no_grad():
            val_logits = heads.scale * (F.normalize(heads.state_head.out(sv), dim=-1) @ F.normalize(heads.action_head.out(av), dim=-1).T)
        metric = metrics(labels_v, predictions(val_logits))
        history.append({"epoch": epoch, "loss": float(loss.detach()), "validation_macro_f1": metric["macro_f1"], "validation_accuracy": metric["accuracy"]})
        if metric["macro_f1"] > best_score:
            best_score, best_epoch = metric["macro_f1"], epoch
            best_weights = {name: tensor.detach().clone().contiguous() for name, tensor in heads.state_dict().items() if ".out." in name}
        if epoch % 10 == 0 or epoch == 1:
            print(f"[clm train] epoch={epoch} loss={float(loss.detach()):.5f} val_macro_f1={metric['macro_f1']:.4f}", flush=True)
    heads.load_state_dict(best_weights, strict=False)
    heads.requires_grad_(False)
    tuned = heads.logits(xv, actions)
    promoted = best_score > baseline_score
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    from safetensors.torch import save_file
    weights_path = output / "clm_partial_head.safetensors"
    save_file(best_weights, str(weights_path), metadata={"format": "needle.clm.partial.v1", "base_sha256": heads.base_sha256})
    if weights_path.stat().st_size > 7_000_000:
        raise ValueError("Partial-head artifact unexpectedly exceeds 7 MB")
    metadata = {"schema": "needle.clm.partial.v1", "base_model": BASE_ID, "base_revision": BASE_REVISION,
                "base_sha256": heads.base_sha256, "encoder": ENCODER_ID, "encoder_revision": ENCODER_REVISION,
                "encoder_quantization": "4-bit community MLX conversion; reference BF16 parity not established",
                "weights_sha256": file_hash(weights_path), "weights_bytes": weights_path.stat().st_size,
                "trainable_parameters": sum(p.numel() for p in parameters), "trained_layers": sorted(best_weights),
                "frozen_components": ["Qwen3-8B-4bit", "head input/hidden/layernorm", "logit_scale"],
                "max_tokens": args.max_tokens, "instructions": INSTRUCTIONS, "actions": ACTIONS, "routes": ROUTES,
                "seed": SEED, "training_rows": len(rows), "available_training_rows": len(training_all),
                "training_subset": "SHA256 deterministic ordering per language and class, first per_cell rows",
                "per_cell": args.per_cell, "training_ids": [r.get("id") for r in rows],
                "training_hash": file_hash(Path(args.train)), "validation_hash": file_hash(Path(args.validation)),
                "validation_rows": len(validation), "best_epoch": best_epoch, "maximum_epochs": args.epochs,
                "promoted": promoted, "selected_model": "fine_tuned_partial_heads" if promoted else "original_heads",
                "baseline_validation_macro_f1": baseline_score, "candidate_validation_macro_f1": best_score,
                "selected_epoch": best_epoch if promoted else 0,
                "learning_rate": args.learning_rate, "label_smoothing": 0.05, "weight_decay": 0.001,
                "selection": "best candidate by validation macro-F1/earliest tie; deploy candidate only if strictly better than released baseline; held-out evaluation never read",
                "route_threshold": 0.55, "margin_threshold": 0.1,
                "data_is_synthetic": True, "versions": versions()}
    write_json(output / "clm_partial_head.json", metadata)
    serving_predictions = gated_predictions(tuned if promoted else zero)
    serving_predictions = ["clarify" if truncated else label for label, truncated in zip(serving_predictions, validation_truncated)]
    report = {"schema": "needle.clm.training.v1", "validation_before": zero_metrics,
              "validation_after": metrics(labels_v, predictions(tuned)),
              "validation_after_gated": metrics(labels_v, gated_predictions(tuned)),
              "validation_serving_selected": metrics(labels_v, serving_predictions),
              "validation_context_truncated": sum(validation_truncated),
              "promoted": promoted, "deployment_selected": metadata["selected_model"],
              "best_epoch": best_epoch, "history": history, "encoding": encoding_stats,
              "total_seconds": time.perf_counter() - started, "artifact": metadata,
              "limitations": ["Synthetic development data", "Only final projection layers trained", "Quantized encoder differs from original reference", "No Jev comparison"]}
    write_json(Path(args.report) if args.report else output / "clm_training_report.json", report)
    return report


def latency_summary(values: list[float], description: str) -> dict:
    return {"n": len(values), "p50_ms": float(np.percentile(values, 50)),
            "p95_ms": float(np.percentile(values, 95)), "raw_ms": values, "measurement": description}


def evaluate(args: argparse.Namespace) -> dict:
    output = Path(args.output)
    report_path = Path(args.report) if args.report else output / "clm_evaluation_report.json"
    if report_path.exists() and not args.overwrite_report:
        raise FileExistsError("Preserve first held-out evaluation. Explicit --overwrite-report is required for a disclosed repeat.")
    rows = read_rows(Path(args.evaluation))  # Only evaluate reads this held-out file.
    started = time.perf_counter()
    model = NeedleCLMModel(args.encoder, args.base, args.output, cache_dir=args.cache)
    load_seconds = time.perf_counter() - started
    try:
        values = model.encoder.encode([state_text(r["text"], r.get("product")) for r in rows], progress=True)
        original = CLMHeads(args.base)
        before = original.logits(values, model.actions)
        candidate = CLMHeads(args.base)
        candidate.load_partial(output, apply_unpromoted=True)
        after = candidate.logits(values, model.actions)
        labels = [r["label"] for r in rows]
        truncated = [model.encoder.token_count(state_text(r["text"], r.get("product"))) > model.encoder.max_tokens - 1 for r in rows]
        serving = gated_predictions(after if model.tuned else before)
        serving = ["clarify" if cut else label for label, cut in zip(serving, truncated)]
        by_language = {}
        for language in sorted({r.get("language", "unknown") for r in rows}):
            ix = [i for i, r in enumerate(rows) if r.get("language", "unknown") == language]
            by_language[language] = {"before": metrics([labels[i] for i in ix], predictions(before[ix])),
                                     "after": metrics([labels[i] for i in ix], predictions(after[ix]))}
        # One warm-up call excluded, then serial full tokenization/encoder/head calls.
        eligible = [row for row, cut in zip(rows, truncated) if not cut]
        if not eligible:
            raise ValueError("No nontruncated held-out contexts available for an honest encoder latency benchmark")
        first = eligible[0]
        model.route(first["text"], first.get("product"), use_cache=False)
        uncached, cached = [], []
        for row in (eligible * args.benchmark_samples)[:args.benchmark_samples]:
            tick = time.perf_counter()
            model.route(row["text"], row.get("product"), use_cache=False)
            uncached.append((time.perf_counter() - tick) * 1000)
        model.route(first["text"], first.get("product"), use_cache=True)
        for _ in range(args.benchmark_samples):
            tick = time.perf_counter()
            model.route(first["text"], first.get("product"), use_cache=True)
            cached.append((time.perf_counter() - tick) * 1000)
        report = {"schema": "needle.clm.evaluation.v1", "evaluation_hash": file_hash(Path(args.evaluation)),
                  "weights_sha256": model.metadata["weights_sha256"], "evaluation_is_synthetic": True,
                  "zero_shot_original_heads": metrics(labels, predictions(before)),
                  "fine_tuned_partial_heads": metrics(labels, predictions(after)),
                  "fine_tuned_gated": metrics(labels, gated_predictions(after)), "by_language": by_language,
                  "selected_serving": metrics(labels, serving), "deployment_selected": model.metadata["selected_model"],
                  "promoted_on_validation": model.tuned, "context_limit_abstentions": sum(truncated),
                  "warm_uncached": latency_summary(uncached, "Warm model, serial batch-one requests including tokenizer, 8B encoder, heads; actions cached; input/result caches bypassed"),
                  "memory_cache_hit": latency_summary(cached, "Repeated identical state embedding served from RAM; heads still executed; excludes disk/network"),
                  "head_and_action_initialization_seconds": load_seconds,
                  "encoder_load_seconds": model.encoder.stats["encoder_load_seconds"],
                  "initialization_note": "Encoder loads lazily; head/action initialization can use cached embeddings and must not be described as cold 8B load latency",
                  "encoder_stats": model.encoder.stats, "versions": versions(),
                  "benchmark_eligible_rows": len(eligible), "benchmark_excluded_truncated_rows": sum(truncated),
                  "max_tokens": model.encoder.max_tokens,
                  "limitations": ["60-example synthetic holdout is not customer/video validation", "Scores are uncalibrated and candidate-relative", "No direct image/audio processing", "Quantized MLX backbone; not reference BF16 parity", "Published Jev speedups cannot be inferred from this run"]}
        write_json(report_path, report)
        return report
    finally:
        model.encoder.close()


def encode(args: argparse.Namespace) -> dict:
    # Does not read evaluation: useful for resumable precomputation before fitting.
    encoder = MLXEncoder(args.encoder, args.max_tokens, args.cache)
    try:
        rows = selected_training_rows(read_rows(Path(args.train)), args.per_cell)
        rows += read_rows(Path(args.validation))
        encoder.encode([state_text(r["text"], r.get("product")) for r in rows], progress=True)
        encoder.encode(ACTIONS, "action", progress=True)
        return encoder.stats
    finally:
        encoder.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["train", "evaluate", "encode", "predict"])
    parser.add_argument("--encoder", default=str(DEFAULT_ENCODER))
    parser.add_argument("--base", default=str(DEFAULT_BASE))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--cache", default=str(DEFAULT_CACHE))
    parser.add_argument("--train", default=str(HERE / "data/train.jsonl"))
    parser.add_argument("--validation", default=str(HERE / "data/validation.jsonl"))
    parser.add_argument("--evaluation", default=str(HERE / "data/eval_handwritten.jsonl"))
    parser.add_argument("--max-tokens", type=int, choices=[128, 256], default=MAX_TOKENS)
    parser.add_argument("--per-cell", type=int, default=20, help="Rows per language and label; zero uses all")
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--benchmark-samples", type=int, default=20)
    parser.add_argument("--report")
    parser.add_argument("--overwrite-report", action="store_true")
    parser.add_argument("--text")
    parser.add_argument("--product", default="")
    args = parser.parse_args()
    if args.per_cell < 0 or args.epochs < 1 or args.benchmark_samples < 1:
        parser.error("Invalid count parameter")
    if args.command == "train":
        result = train(args)
    elif args.command == "evaluate":
        result = evaluate(args)
    elif args.command == "encode":
        result = encode(args)
    else:
        if not args.text:
            parser.error("predict requires --text")
        model = NeedleCLMModel(args.encoder, args.base, args.output, cache_dir=args.cache)
        try:
            result = model.route(args.text, args.product)
        finally:
            model.encoder.close()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
