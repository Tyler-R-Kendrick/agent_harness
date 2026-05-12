# Agent Chat Dev Evals

This project contains dev-time heuristic evals for agent chat self-improvement.
It is intentionally outside the repo workspaces and outside `verify:agent-browser`.
Do not wire these commands into CI or product regression suites.

## IFEval Sampling

The IFEval runner pulls samples directly from the official `google/IFEval`
dataset and grades responses with Hugging Face LightEval's IFEval instruction
registry. It does not check in or generate IFEval scenarios.

```powershell
python scripts/run-huggingface-ifeval-chat-eval.py --sample-size 15
```

Results are persisted under `output/huggingface-ifeval-chat/`. The sampler
prioritizes official samples that have not run before, replays prior failures
first, and fills any remaining slots with previously run official samples.

Python prerequisites:

```powershell
python -m pip install datasets lighteval langdetect
```

## LangChain OpenEvals

The OpenEvals runner is a separate dev heuristic for common chat trajectory and
multiturn checks. Install this project locally before running it:

```powershell
npm install
npm run eval:openevals
```
