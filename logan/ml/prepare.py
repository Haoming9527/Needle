"""Download pinned, public base weights. No model repository code is executed."""
import argparse
from pathlib import Path
from huggingface_hub import snapshot_download,hf_hub_download
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--clm',action='store_true');args=p.parse_args()
# Keep large public base models and a local venv outside Git commits.
exclude=ROOT/'.git/info/exclude'
if exclude.exists():
 s=exclude.read_text()
 for pattern in ['.needle-cache/','.needle-ml/']:
  if pattern not in s:s+='\n'+pattern
 exclude.write_text(s+'\n')
snapshot_download('intfloat/multilingual-e5-small',revision='614241f622f53c4eeff9890bdc4f31cfecc418b3',allow_patterns=['config.json','model.safetensors','tokenizer.json','tokenizer_config.json','special_tokens_map.json','sentencepiece.bpe.model'],local_dir=ROOT/'.needle-cache/e5')
if args.clm:
 snapshot_download('mlx-community/Qwen3-8B-4bit',revision='545dc4251c05440727734bcd94334791f6ab0192',allow_patterns=['*.json','*.safetensors','*.txt'],local_dir=ROOT/'.needle-cache/qwen3-8b-4bit')
 hf_hub_download('Contrastive-LM/CLM-v0.1-8B','CLM_v0.1-8B.pt',revision='e939398d4556fcd9400c76fa8c5a513202f42b0a',local_dir=ROOT/'.needle-cache/clm')
print('Pinned base weights ready. Trained Needle heads are in logan/ml/models.')
