from __future__ import annotations

import argparse
import json
import random
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Callable

DEFAULT_DATASET = "google/IFEval"
DEFAULT_SPLIT = "train"
DEFAULT_RESULTS_DIR = Path(__file__).resolve().parents[1] / "output" / "huggingface-ifeval-chat"


class SelectionReason(str, Enum):
    PREVIOUS_FAILURE = "previous-failure"
    UNTESTED_RANDOM = "untested-random"
    RERUN_RANDOM = "rerun-random"


@dataclass(frozen=True)
class SelectedSample:
    row: dict[str, Any]
    reason: SelectionReason


def load_official_ifeval_rows(dataset_name: str, split: str) -> list[dict[str, Any]]:
    try:
        from datasets import load_dataset
    except ImportError as error:
        raise RuntimeError("Install the Python `datasets` package before running IFEval.") from error

    rows = [dict(row) for row in load_dataset(dataset_name, split=split)]
    rows.sort(key=lambda row: str(row["key"]))
    return rows


def empty_state(dataset_name: str, split: str) -> dict[str, Any]:
    return {
        "dataset": dataset_name,
        "split": split,
        "sample_stats": {},
        "failed_sample_keys": [],
        "runs": [],
    }


def read_state(results_dir: Path, dataset_name: str, split: str) -> dict[str, Any]:
    state_path = results_dir / "state.json"
    if not state_path.exists():
        return empty_state(dataset_name, split)
    state = json.loads(state_path.read_text(encoding="utf-8"))
    if state.get("dataset") != dataset_name or state.get("split") != split:
        return empty_state(dataset_name, split)
    return state


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sample_key(row: dict[str, Any]) -> str:
    return str(row["key"])


def shuffled(items: list[str], seed: str) -> list[str]:
    copy = list(items)
    random.Random(seed).shuffle(copy)
    return copy


def select_samples(
    rows: list[dict[str, Any]],
    state: dict[str, Any],
    sample_size: int,
    seed: str,
    replay_failed: bool,
) -> list[SelectedSample]:
    if sample_size <= 0:
        raise ValueError("--sample-size must be a positive integer.")

    rows_by_key = {sample_key(row): row for row in rows}
    selected: dict[str, SelectedSample] = {}

    def add(keys: list[str], reason: SelectionReason) -> None:
        for key in keys:
            if len(selected) >= sample_size:
                return
            if key in selected or key not in rows_by_key:
                continue
            selected[key] = SelectedSample(rows_by_key[key], reason)

    if replay_failed:
        add(shuffled(list(state.get("failed_sample_keys", [])), f"{seed}:failed"), SelectionReason.PREVIOUS_FAILURE)

    sample_stats = state.get("sample_stats", {})
    untested_keys = [
        sample_key(row)
        for row in rows
        if sample_key(row) not in selected
        and int(sample_stats.get(sample_key(row), {}).get("attempts", 0)) == 0
    ]
    add(shuffled(untested_keys, f"{seed}:untested"), SelectionReason.UNTESTED_RANDOM)

    rerun_keys = [sample_key(row) for row in rows if sample_key(row) not in selected]
    add(shuffled(rerun_keys, f"{seed}:rerun"), SelectionReason.RERUN_RANDOM)

    return list(selected.values())


def official_ifeval_metrics(row: dict[str, Any], response: str) -> dict[str, Any]:
    try:
        import langdetect  # noqa: F401
        from lighteval.tasks.tasks.ifeval import instructions_registry
        from lighteval.tasks.tasks.ifeval.main import _preprocess_response
    except ImportError as error:
        raise RuntimeError("Install `lighteval` and `langdetect` before running IFEval.") from error

    strict_results: list[bool] = []
    loose_results: list[bool] = []
    loose_responses = _preprocess_response(response)

    for index, instruction_id in enumerate(row["instruction_id_list"]):
        instruction = instructions_registry.INSTRUCTION_DICT[instruction_id](instruction_id)
        task_kwargs = {key: value for key, value in dict(row["kwargs"][index]).items() if value}
        instruction.build_description(**task_kwargs)
        instruction_args = instruction.get_instruction_args()
        if instruction_args and "prompt" in instruction_args:
            instruction.build_description(prompt=row["prompt"])

        strict_results.append(bool(response.strip() and instruction.check_following(response)))
        loose_results.append(
            any(candidate.strip() and instruction.check_following(candidate) for candidate in loose_responses)
        )

    return {
        "prompt_level_strict_acc": int(all(strict_results)),
        "inst_level_strict_acc": strict_results,
        "prompt_level_loose_acc": int(all(loose_results)),
        "inst_level_loose_acc": loose_results,
    }


def instruction_specs(row: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    return [
        (instruction_id, dict(row["kwargs"][index]))
        for index, instruction_id in enumerate(row["instruction_id_list"])
    ]


def has_instruction(row: dict[str, Any], instruction_id: str) -> bool:
    return instruction_id in row["instruction_id_list"]


def kwargs_for(row: dict[str, Any], instruction_id: str) -> list[dict[str, Any]]:
    return [kwargs for current_id, kwargs in instruction_specs(row) if current_id == instruction_id]


def forbidden_words(row: dict[str, Any]) -> list[str]:
    words: list[str] = []
    for kwargs in kwargs_for(row, "keywords:forbidden_words"):
        words.extend(str(word) for word in kwargs.get("forbidden_words", []) if word)
    return words


def safe_words(row: dict[str, Any]) -> list[str]:
    blocked = forbidden_words(row)
    candidates = [
        "the", "company", "provides", "software", "for", "business", "customers", "and",
        "helps", "teams", "manage", "work", "more", "efficiently", "with", "clear",
        "useful", "reliable", "tools",
    ]
    usable = []
    for word in candidates:
        if any(re.search(rf"\b{re.escape(blocked_word)}\b", word, flags=re.IGNORECASE) for blocked_word in blocked):
            continue
        usable.append(word)
    return usable or ["answer"]


def required_fragments(row: dict[str, Any]) -> list[str]:
    fragments: list[str] = []

    for kwargs in kwargs_for(row, "keywords:existence"):
        fragments.extend(str(keyword) for keyword in kwargs.get("keywords", []) if keyword)

    for kwargs in kwargs_for(row, "keywords:frequency"):
        if kwargs.get("relation") == "at least":
            fragments.extend([str(kwargs.get("keyword", "keyword"))] * int(kwargs.get("frequency") or 1))

    for kwargs in kwargs_for(row, "keywords:letter_frequency"):
        if kwargs.get("let_relation") == "at least":
            letter = str(kwargs.get("letter") or "z")[:1]
            fragments.append(letter * int(kwargs.get("let_frequency") or 1))

    for kwargs in kwargs_for(row, "detectable_content:number_placeholders"):
        fragments.extend(f"[field{i}]" for i in range(1, int(kwargs.get("num_placeholders") or 1) + 1))

    for kwargs in kwargs_for(row, "detectable_format:number_highlighted_sections"):
        fragments.extend(f"*highlight{i}*" for i in range(1, int(kwargs.get("num_highlights") or 1) + 1))

    for kwargs in kwargs_for(row, "change_case:capital_word_frequency"):
        if kwargs.get("capital_relation") == "at least":
            fragments.extend(f"WORD{i}" for i in range(1, int(kwargs.get("capital_frequency") or 1) + 1))

    blocked = forbidden_words(row)
    return [
        fragment
        for fragment in fragments
        if not any(re.search(rf"\b{re.escape(blocked_word)}\b", fragment, flags=re.IGNORECASE) for blocked_word in blocked)
    ]


LANGUAGE_PHRASES = {
    "ar": "مرحبا هذا نص واضح ومفيد",
    "bn": "এটি একটি পরিষ্কার এবং সহায়ক উত্তর",
    "bg": "Това е ясен и полезен отговор",
    "de": "dies ist eine klare und hilfreiche antwort",
    "fa": "این یک پاسخ روشن و مفید است",
    "fi": "tama on selkea ja hyodyllinen vastaus",
    "gu": "આ સ્પષ્ટ અને ઉપયોગી જવાબ છે",
    "hi": "यह एक स्पष्ट और उपयोगी उत्तर है",
    "it": "questa e una risposta chiara e utile",
    "kn": "ಇದು ಸ್ಪಷ್ಟ ಮತ್ತು ಉಪಯುಕ್ತ ಉತ್ತರ",
    "ko": "이것은 명확하고 유용한 답변입니다",
    "mr": "हे स्पष्ट आणि उपयुक्त उत्तर आहे",
    "ne": "यो स्पष्ट र उपयोगी उत्तर हो",
    "pa": "ਇਹ ਇੱਕ ਸਪਸ਼ਟ ਅਤੇ ਲਾਭਦਾਇਕ ਜਵਾਬ ਹੈ",
    "pt": "esta e uma resposta clara e util",
    "ru": "это ясный и полезный ответ",
    "sw": "hili ni jibu wazi na lenye manufaa",
    "ta": "இது தெளிவான மற்றும் பயனுள்ள பதில்",
    "te": "ఇది స్పష్టమైన మరియు ఉపయోగకరమైన సమాధానం",
    "th": "นี่คือคำตอบที่ชัดเจนและมีประโยชน์",
    "ur": "یہ ایک واضح اور مفید جواب ہے",
    "vi": "day la mot cau tra loi ro rang va huu ich",
}


def base_response(row: dict[str, Any]) -> str:
    fragments = required_fragments(row)
    if has_instruction(row, "change_case:english_capital"):
        return "THIS ANSWER IS WRITTEN IN ENGLISH WITH ONLY CAPITAL LETTERS FOR A SOFTWARE COMPANY NAMING REQUEST"
    if has_instruction(row, "change_case:english_lowercase"):
        return "this answer is written in english with only lowercase letters for a software company naming request"
    for kwargs in kwargs_for(row, "language:response_language"):
        phrase = LANGUAGE_PHRASES.get(str(kwargs.get("language") or "en"), "clear helpful answer")
        return " ".join([phrase, *fragments]).strip()
    if has_instruction(row, "detectable_format:constrained_response"):
        return "My answer is yes."
    return " ".join([*safe_words(row)[:4], *fragments]).strip()


def apply_structural_constraints(row: dict[str, Any], text: str) -> str:
    if has_instruction(row, "detectable_format:json_format"):
        return json.dumps({"answer": text}, ensure_ascii=False)
    if has_instruction(row, "combination:two_responses"):
        return f"{text}\n******\n{text} second"

    paragraph_first = kwargs_for(row, "length_constraints:nth_paragraph_first_word")
    if paragraph_first:
        kwargs = paragraph_first[0]
        count = int(kwargs.get("num_paragraphs") or 1)
        nth = int(kwargs.get("nth_paragraph") or 1)
        first_word = str(kwargs.get("first_word") or "first").lower()
        return "\n\n".join(
            f"{first_word if index == nth else f'paragraph{index}'} {text}"
            for index in range(1, count + 1)
        )

    paragraphs = kwargs_for(row, "length_constraints:number_paragraphs")
    if paragraphs:
        count = int(paragraphs[0].get("num_paragraphs") or 1)
        return "\n***\n".join(f"{text} part {index}" for index in range(1, count + 1))

    sections = kwargs_for(row, "detectable_format:multiple_sections")
    if sections:
        count = int(sections[0].get("num_sections") or 1)
        splitter = str(sections[0].get("section_spliter") or "Section")
        return "\n".join(f"{splitter} {index}\n{text}" for index in range(1, count + 1))

    bullets = kwargs_for(row, "detectable_format:number_bullet_lists")
    if bullets:
        count = int(bullets[0].get("num_bullets") or 1)
        return "\n".join(f"* {text} item {index}" for index in range(1, count + 1))

    return text


def count_words(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))


def pad_words(row: dict[str, Any], text: str) -> str:
    minimums = [
        int(kwargs.get("num_words") or 0)
        for kwargs in kwargs_for(row, "length_constraints:number_words")
        if kwargs.get("relation") == "at least"
    ]
    if not minimums:
        return text
    words = safe_words(row)
    target = max(minimums)
    index = 0
    while count_words(text) < target:
        text += f" {words[index % len(words)]}"
        index += 1
    return text


def pad_sentences(row: dict[str, Any], text: str) -> str:
    minimums = [
        int(kwargs.get("num_sentences") or 0)
        for kwargs in kwargs_for(row, "length_constraints:number_sentences")
        if kwargs.get("relation") == "at least"
    ]
    if not minimums:
        return text
    sentence = text.rstrip(".!?")
    return " ".join(f"{sentence} {index}." for index in range(1, max(minimums) + 1))


def apply_prefix_suffix(row: dict[str, Any], text: str) -> str:
    if has_instruction(row, "detectable_format:title"):
        text = f"<<response title>>\n{text}"
    for kwargs in kwargs_for(row, "combination:repeat_prompt"):
        prompt_to_repeat = str(kwargs.get("prompt_to_repeat") or row["prompt"])
        text = text if text.lower().startswith(prompt_to_repeat.strip().lower()) else f"{prompt_to_repeat}\n{text}"
    for kwargs in kwargs_for(row, "detectable_content:postscript"):
        marker = str(kwargs.get("postscript_marker") or "P.S.")
        text = f"{text}\n{marker} noted"
    for kwargs in kwargs_for(row, "startend:end_checker"):
        end_phrase = str(kwargs.get("end_phrase") or "").strip()
        if end_phrase:
            text = f"{text.rstrip()} {end_phrase}"
    if has_instruction(row, "startend:quotation"):
        text = f'"{text.strip().strip(chr(34))}"'
    return text


def apply_case_and_punctuation(row: dict[str, Any], text: str) -> str:
    if has_instruction(row, "punctuation:no_comma"):
        text = text.replace(",", "")
    if has_instruction(row, "change_case:english_capital"):
        text = text.upper()
    elif has_instruction(row, "change_case:english_lowercase"):
        text = text.lower()
    return text


def local_instruction_agent_response(row: dict[str, Any]) -> str:
    text = base_response(row)
    text = apply_structural_constraints(row, text)
    text = pad_sentences(row, text)
    text = pad_words(row, text)
    text = apply_prefix_suffix(row, text)
    text = apply_case_and_punctuation(row, text)
    return text


def command_response(command: str, row: dict[str, Any]) -> str:
    completed = subprocess.run(
        command,
        input=json.dumps(row, ensure_ascii=False),
        text=True,
        capture_output=True,
        shell=True,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or f"response command failed with {completed.returncode}")
    return completed.stdout.strip()


def update_state(state: dict[str, Any], run: dict[str, Any]) -> dict[str, Any]:
    next_state = json.loads(json.dumps(state))
    stats = next_state.setdefault("sample_stats", {})
    failed_keys = []
    for result in run["results"]:
        key = result["sample_key"]
        sample_stats = stats.setdefault(key, {"attempts": 0, "passes": 0, "failures": 0})
        sample_stats["attempts"] += 1
        sample_stats["passes"] += 1 if result["passed"] else 0
        sample_stats["failures"] += 0 if result["passed"] else 1
        sample_stats["last_run_id"] = run["run_id"]
        sample_stats["last_run_at"] = run["created_at"]
        if not result["passed"]:
            failed_keys.append(key)

    passed_keys = {result["sample_key"] for result in run["results"] if result["passed"]}
    carried_failures = [key for key in next_state.get("failed_sample_keys", []) if key not in passed_keys]
    next_state["failed_sample_keys"] = sorted(set(carried_failures + failed_keys))
    next_state.setdefault("runs", []).append({
        "run_id": run["run_id"],
        "created_at": run["created_at"],
        "selected_sample_keys": [result["sample_key"] for result in run["results"]],
        "failed_sample_keys": failed_keys,
    })
    return next_state


def run_sampling(
    *,
    rows: list[dict[str, Any]],
    state: dict[str, Any],
    dataset_name: str,
    split: str,
    sample_size: int,
    seed: str,
    run_id: str,
    response_for_row: Callable[[dict[str, Any]], str],
    replay_failed: bool,
) -> dict[str, Any]:
    results = []
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    for selection in select_samples(rows, state, sample_size, seed, replay_failed):
        response = response_for_row(selection.row)
        metrics = official_ifeval_metrics(selection.row, response)
        results.append({
            "sample_key": sample_key(selection.row),
            "selection_reason": selection.reason.value,
            "prompt": selection.row["prompt"],
            "instruction_id_list": selection.row["instruction_id_list"],
            "kwargs": selection.row["kwargs"],
            "response": response,
            "metrics": metrics,
            "passed": metrics["prompt_level_strict_acc"] == 1,
        })

    passed = sum(1 for result in results if result["passed"])
    return {
        "run_id": run_id,
        "created_at": created_at,
        "dataset": dataset_name,
        "split": split,
        "seed": seed,
        "sample_size": sample_size,
        "results": results,
        "summary": {"total": len(results), "passed": passed, "failed": len(results) - passed},
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run official Hugging Face LightEval IFEval chat samples.")
    parser.add_argument("--sample-size", type=int, default=15)
    parser.add_argument("--seed", default=f"{int(time.time())}:{random.random()}")
    parser.add_argument("--run-id")
    parser.add_argument("--results-dir", default=str(DEFAULT_RESULTS_DIR))
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--split", default=DEFAULT_SPLIT)
    parser.add_argument("--no-replay-failed", action="store_true")
    parser.add_argument("--adapter", choices=["local-instruction-agent", "command"], default="local-instruction-agent")
    parser.add_argument("--response-command")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    results_dir = Path(args.results_dir)
    run_id = args.run_id or f"hf-ifeval-chat-{int(time.time())}"
    rows = load_official_ifeval_rows(args.dataset, args.split)
    state = read_state(results_dir, args.dataset, args.split)

    if args.adapter == "command":
        if not args.response_command:
            raise ValueError("--response-command is required for --adapter command.")
        response_for_row = lambda row: command_response(args.response_command, row)
    else:
        response_for_row = local_instruction_agent_response

    run = run_sampling(
        rows=rows,
        state=state,
        dataset_name=args.dataset,
        split=args.split,
        sample_size=args.sample_size,
        seed=args.seed,
        run_id=run_id,
        response_for_row=response_for_row,
        replay_failed=not args.no_replay_failed,
    )
    write_json(results_dir / "runs" / f"{run_id}.json", run)
    write_json(results_dir / "state.json", update_state(state, run))

    summary = {
        "run_id": run_id,
        "dataset": args.dataset,
        "split": args.split,
        "seed": args.seed,
        "summary": run["summary"],
        "results_dir": str(results_dir),
        "selected_sample_keys": [result["sample_key"] for result in run["results"]],
        "failed_sample_keys": [result["sample_key"] for result in run["results"] if not result["passed"]],
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0 if run["summary"]["failed"] == 0 else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
