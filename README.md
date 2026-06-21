# AI-Powered Text Editor

A desktop text editor with built-in AI capabilities for text rewriting, grammar correction, and poetry editing. Powered by Electron and React.

## Features

- **Grammar Fix** — Automatically fix grammar and punctuation errors while preserving meaning and formatting
- **Poetry Grammar Fix** — Correct spelling and typos in poems without changing rhythm, meter, or structure
- **Rewrite** — Rewrite selected text according to custom instructions
- **Inline Diff Viewer** — Review changes hunks-by-hunk before applying them to the document
- **Operation History** — Track all edits with timestamps and AI model information
- **Multi-Provider Support** — Works with Ollama, OpenAI-compatible APIs, and other LLM services

## Quick Start

### Prerequisites

- Node.js 18+
- An AI provider running locally or remotely:
  - **Ollama** (local): Download from [ollama.ai](https://ollama.ai), run `ollama pull <model>`, then `ollama serve`
  - **OpenAI-compatible API**: Any API compatible with OpenAI's chat completions format (e.g., Hugging Face, Together AI, LocalAI)

### Installation & Running

```bash
npm install
npm run dev                  # Start dev server (http://localhost:5173)
npm run electron:dev        # Launch Electron app with live reload
npm run build               # Build for production
```

### Configuration

1. Open Settings (gear icon)
2. Select your AI provider type (Ollama, OpenAI-compatible, etc.)
3. Configure the provider URL and API key (if needed)
4. Choose a model from the dropdown
5. Adjust temperature and max tokens as needed

## Usage

### Grammar Fix
1. Write or paste text
2. Optionally select specific text (or leave unselected to fix entire document)
3. Click **Grammar Fix** button
4. Review proposed changes in the inline diff
5. Accept or reject individual changes, or accept/reject all

### Rewrite
1. Select the text you want to rewrite
2. Click **Rewrite** and enter your instruction (e.g., "make this more formal" or "simplify this")
3. Review the proposed changes
4. Accept or reject the changes

### Poetry Fix
1. Select or paste a poem
2. Click **Settings** and enable **Poetry Mode**
3. Click **Grammar Fix**
4. The AI will correct only spelling/typos while preserving line breaks and rhythm

## Inline Diff Controls

- **Accept** — Apply this change to the document immediately
- **Reject** — Discard this change (original text remains)
- **Accept All** — Apply all pending changes at once
- **Reject All** — Discard all pending changes

Once you accept/reject a change, it's applied to the document and removed from the diff view.

## Operation Logs

Click the **Logs** tab at the bottom to see:
- AI provider and model used
- System and user prompts sent
- Raw AI response
- Diff information

## Keyboard Shortcuts

- `Ctrl/Cmd + Shift + G` — Run Grammar Fix
- `Ctrl/Cmd + Shift + R` — Run Rewrite (opens prompt dialog)

## Supported Models

### Ollama
- `gemma4-26b-a4b` — High-quality reasoning and writing
- `qwen3:14b` — Fast, capable general-purpose model
- `qwen2.5:3b` — Lightweight local model
- Any other Ollama model

### OpenAI-Compatible
- OpenAI GPT-4, GPT-3.5-turbo
- Open-source models via HuggingFace, Together AI, LocalAI, etc.

## Troubleshooting

**"Model ran out of tokens while thinking"**
- Increase **Max Tokens** in Settings or disable **Thinking** mode for your model

**"Empty response from Ollama"**
- Ensure the model is loaded: `ollama pull <model-name>`
- Check Ollama is running: `curl http://localhost:11434/api/tags`

**Selection doesn't work**
- Make sure you're not typing in the text field while trying to select — selection is cleared by blur

**CORS errors with remote API**
- Ensure your API provider has CORS enabled for `localhost:5173`
- For local testing, Ollama automatically enables CORS

## Project Structure

```
src/
  core/
    operations/     # Grammar fix, rewrite, poetry fix operations
    providers/      # AI provider implementations
    diff/           # Diff computation engine
    document/       # Document state management
    history/        # Operation history tracking
    logging/        # Request/response logging
    prompts/        # Prompt templates registry
  components/       # React UI components
    Editor/         # Main text editor with inline diff
    Settings/       # Configuration panel
```

## License

MIT
