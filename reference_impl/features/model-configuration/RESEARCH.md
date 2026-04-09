# Research: Model Configuration Settings

## Prior Art

### Transformers.js (Browser-Based Local Inference)
- **How it works:** Runs ONNX-converted models directly in browser via WASM/WebGPU. 2,000+ compatible models on Hugging Face. Supports 120+ architectures (BERT, GPT-2, LLaMA, Mistral).
- **Quantization:** fp32 (WebGPU default), fp16, q8 (WASM default), q4 (smallest/fastest). Each trades accuracy for size/speed.
- **Progress tracking:** `progress_callback` returns `progress_total` event with loading percentage. `ModelRegistry` API provides `is_pipeline_cached()`, `get_file_metadata()`, `clear_pipeline_cache()`.
- **Caching:** Models auto-cache in IndexedDB after first download. Subsequent loads are fast.
- **Limitations:** Models 500MB–4GB even quantized. Browser heap ~2GB. First load 10–30s. No download resume on interruption. IndexedDB quota varies by browser (~50GB typical).

### LM Studio (Desktop GUI)
- **Discovery:** Built-in model browser connected to Hugging Face Hub. Filters by size, quantization, hardware compatibility.
- **Download UX:** Percentage + progress bar. Shows estimated RAM/VRAM requirements *before* download. Cancel button.
- **Management:** File-system based (GGUF format). Custom directory support. Models load on-demand.
- **Key UX decision:** Hardware requirement hints prevent downloading models that won't run.

### Jan.ai (Desktop, Open Source)
- **Discovery:** Hub icon in left sidebar. Search by name or Hugging Face ID. Shows "Slow on your device" / "Not enough RAM" warnings.
- **Download UX:** Model name + percentage in top bar. Cancel via × button.
- **Management:** Settings > Model Providers. Import local GGUF files. File-system based with UI layer.

### Ollama (CLI/API-First)
- **Discovery:** CLI `ollama list` or third-party GUIs (OllaMan, Gollama).
- **Download UX:** Layer-by-layer console progress. **Automatically resumes** from interruption point (unique advantage).
- **Management:** REST API for pull, push, list, create, delete. Daemon-based — switch instantly between loaded models.

### OpenRouter (Remote API Aggregator)
- **Discovery:** Model browser at openrouter.ai/models. Sort by price, latency, capabilities.
- **Selection:** Provider routing — load balance, cheapest, fastest, or custom ordering. Named presets save model + settings + routing.
- **Switching:** Request-level model specification. Zero download time. ~100ms latency.
- **Limitation:** Internet-dependent. Always costs money. No offline capability.

## Common Patterns

1. **Discovery → Metadata → Download → Cache → Execute:** Universal flow across all local model tools. Always show requirements before download.
2. **Two-tier model sources:** Every tool separates "remote/cloud models" from "local/installed models" in the UI.
3. **Progress is essential:** All tools show download progress. Best implementations show speed, ETA, and offer cancel.
4. **Quantization as user choice:** Present as a quality-vs-speed tradeoff slider or dropdown, not raw technical details.
5. **Hardware-aware warnings:** LM Studio and Jan.ai both warn before download if model likely too large — prevents wasted bandwidth.

## Risks & Edge Cases

- **Browser memory limits:** q4 quantized 7B models are ~4GB. Browser heap typically ~2GB. Need to filter to models that actually fit.
- **Download interruption:** Transformers.js lacks resume capability. Large model downloads on flaky connections will fail.
- **Storage quota:** IndexedDB limits vary. Need graceful handling when cache is full.
- **First-load latency:** 10-30s to load a model into memory. Must show clear loading state in the chat interface.
- **Model switching cost:** Switching local models means reloading into memory (2-10s), unlike instant API switching.
- **Offline gap:** If user starts with cloud models and goes offline, need clear fallback UX to local models.

## Key Takeaways

1. Split the UI into **two tabs**: "Providers" (cloud/API models) and "Local Models" (browser WASM). Different mental models, different UX needs.
2. For local models, show **hardware fit indicators** before download (estimated memory, estimated speed on this device).
3. Download progress needs **percentage, speed, ETA, and cancel** — users are committing hundreds of MB.
4. Model switching in-chat should be a **single-click dropdown**, not buried in settings.
5. Transformers.js `progress_callback` + `ModelRegistry` API give us everything needed for progress UI.
