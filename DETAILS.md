# AI-Powered Editor — Implementation Details

## Architecture Overview

The editor follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│         React UI (components/)          │
│  (Editor, Settings, History, Logs)      │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│      Core Engine (core/)                │
│  ┌──────────────────────────────────┐   │
│  │ Operations (grammar, rewrite)    │   │
│  ├──────────────────────────────────┤   │
│  │ Providers (Ollama, OpenAI, etc)  │   │
│  ├──────────────────────────────────┤   │
│  │ Diff Engine (hunks computation)  │   │
│  ├──────────────────────────────────┤   │
│  │ Document Manager (state & apply) │   │
│  ├──────────────────────────────────┤   │
│  │ History & Logging (persistence)  │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Core Components

### 1. Operations (`core/operations/`)

An operation is a request to modify text using AI. All operations inherit from `AIOperation`:

```typescript
abstract class AIOperation {
  abstract type: OperationType
  abstract promptKey: OperationType
  
  async execute(
    provider: AIProvider,
    text: string,
    context: string,
    settings: ProviderSettings
  ): Promise<AIOperationResult>
  
  abstract prepareContext(
    fullText: string,
    selection?: { start: number; end: number }
  ): string
}
```

**Operation Lifecycle:**

1. `prepareContext()` — Prepare surrounding context (e.g., 3 lines before/after selection)
2. `execute()` → `provider.generate()` — Call AI to get modified text
3. `DiffEngine.computeHunks()` — Compare original vs. modified to extract changes
4. Return `AIOperationResult` with hunks array

**Built-in Operations:**

- `GrammarFixOperation` — Fix grammar/punctuation on any text
- `PoetryGrammarFixOperation` — Fix only spelling/typos while preserving line breaks
- `RewriteOperation` — Rewrite text according to user instruction

#### Adding a New Operation

1. Create `src/core/operations/MyOperation.ts`:

```typescript
import { AIOperation } from './AIOperation'
import type { OperationType } from '../types'

export class MyOperation extends AIOperation {
  protected readonly type: OperationType = 'my-operation'
  protected readonly promptKey: OperationType = 'my-operation'

  prepareContext(fullText: string, selection?: { start: number; end: number }): string {
    // Return relevant context around the selected/full text
    return fullText
  }

  validateResult(result: AIOperationResult): { valid: boolean; warning?: string } {
    // Optionally validate the AI's response
    return { valid: true }
  }
}
```

2. Register the prompt in `PromptRegistry`:

```typescript
this.register('my-operation', {
  systemPrompt: 'Your system instructions...',
  userPrompt: 'Instruction: {instruction}\n\nText:\n{text}',
})
```

3. Wire it in App.tsx and add a button to trigger it.

### 2. Providers (`core/providers/`)

A provider is an AI service connector. Implements `AIProvider` interface:

```typescript
interface AIProvider {
  type: AIProviderConfig['type']
  label: string
  capabilities: ProviderCapabilities

  configure(config: AIProviderConfig): void
  generate(
    systemPrompt: string,
    prompt: string,
    context: string,
    settings: ProviderSettings
  ): Promise<AIResponse>
  listModels(): Promise<string[]>
  isAvailable(): Promise<boolean>
}
```

**Supported Providers:**

- **OllamaProvider** — Local Ollama instance
- **OpenAICompatibleProvider** — OpenAI-compatible APIs (OpenAI, HuggingFace, LocalAI, etc.)

#### Adding a New Provider

1. Create `src/core/providers/MyProvider.ts`:

```typescript
import { BaseAIProvider } from './AIProvider'
import type { AIProviderConfig, AIResponse, ProviderSettings } from '../types'

export class MyProvider extends BaseAIProvider {
  readonly type = 'my-provider' as const
  readonly label = 'My Provider'
  readonly capabilities = {
    supportsThinking: false,
    supportsStreaming: true,
    maxContextLength: 128000,
  }

  private apiKey: string = ''

  configure(config: AIProviderConfig): void {
    this.apiKey = config.apiKey || ''
  }

  async isAvailable(): Promise<boolean> {
    // Check if service is reachable
    try {
      const res = await fetch('https://api.myprovider.com/health')
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<string[]> {
    const res = await fetch('https://api.myprovider.com/models', {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    })
    const data = await res.json()
    return data.models.map((m: any) => m.id)
  }

  async generate(
    systemPrompt: string,
    prompt: string,
    context: string,
    settings: ProviderSettings
  ): Promise<AIResponse> {
    const body = {
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context ? `${prompt}\n\n---\n\n${context}` : prompt },
      ],
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    }

    const res = await fetch('https://api.myprovider.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`API error: ${res.status} — ${err}`)
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''
    const { cleanText, comment } = this.extractComment(raw)

    return { text: cleanText, comment, raw }
  }
}
```

2. Register it in `ProviderRegistry`:

```typescript
// In core/providers/ProviderRegistry.ts
this.registerProvider(new MyProvider())
```

3. Update `AIProviderConfig['type']` in `core/types.ts` to include your provider.

### 3. Diff Engine (`core/diff/DiffEngine.ts`)

Uses the `diff` library to compute hunks (contiguous blocks of changes).

**Key Methods:**

- `computeHunks(original, modified)` — Returns an array of `DiffHunk` objects
- Each hunk contains: `oldStart`, `oldLines`, `newStart`, `newLines`
- Hunks are used to display +/- diffs and track which changes the user accepts

**Hunk Structure:**

```typescript
interface DiffHunk {
  id: string                    // Unique identifier
  oldStart: number              // Line number in original (1-indexed)
  oldLines: string[]            // Lines being removed
  newStart: number              // Line number in modified
  newLines: string[]            // Lines being added
  accepted: boolean | null      // null = pending, true = accepted, false = rejected
}
```

### 4. Document Manager (`core/document/DocumentManager.ts`)

Manages the current document state and applies accepted changes.

**State Flow:**

1. User triggers an operation → `applyOperationResult()` stores it in `activeOperations`
2. User accepts/rejects hunks → `acceptHunk()` / `rejectHunk()`
3. Each accepted hunk is **immediately applied** to the document content
4. When a hunk is accepted:
   - Original text is updated with the new lines
   - Subsequent hunks' line numbers are adjusted for the delta
   - Hunk is removed from the array
5. When no hunks remain → Operation is closed, document is finalized

**Why Immediate Application?**

This avoids the complexity of tracking multiple pending operations. Each accepted change is immediately baked into the document, allowing subsequent operations to work on the updated text.

**Implementation Details:**

```typescript
acceptHunk(operationId: string, hunkId: string): boolean {
  const hunk = op.hunks.find(h => h.id === hunkId)
  
  // Apply to op.originalText
  const lines = op.originalText.split('\n')
  lines.splice(hunk.oldStart - 1, hunk.oldLines.length, ...hunk.newLines)
  op.originalText = lines.join('\n')
  
  // Update full document
  this.content =
    this.content.slice(0, op.contentStart) +
    op.originalText +
    this.content.slice(op.contentStart + /* old length */)
  
  // Adjust subsequent hunks
  const delta = hunk.newLines.length - hunk.oldLines.length
  for (let i = hunkIdx + 1; i < op.hunks.length; i++) {
    op.hunks[i].oldStart += delta
  }
  
  // Remove this hunk
  op.hunks.splice(hunkIdx, 1)
}
```

### 5. History & Logging (`core/history/`, `core/logging/`)

- **HistoryStore** — Tracks all operations (for undo/redo visualization)
- **LogStore** — Tracks all API calls (system prompt, user prompt, raw response)

Both are in-memory stores. For persistence, add file I/O in these modules.

## Data Flow Example: Grammar Fix

```
User selects "He go to store" → clicks "Grammar Fix"
  │
  ├─ prepareContext() → "He go to store" + 3 lines before/after
  │
  ├─ generatePrompt() → 
  │  System: "Fix grammar errors only..."
  │  User: "Please fix grammar in: He go to store"
  │
  ├─ provider.generate() → 
  │  AI response: "He goes to the store.\n[COMMENT]Fixed verb tense[/COMMENT]"
  │
  ├─ extractComment() → 
  │  cleanText: "He goes to the store."
  │  comment: "Fixed verb tense"
  │
  ├─ DiffEngine.computeHunks() →
  │  Hunk 1: 
  │    - "He go to store"
  │    + "He goes to the store"
  │
  ├─ createOperationResult() →
  │  AIOperationResult with hunks array
  │
  └─ User clicks "Accept" →
    documentManager.acceptHunk() →
      Apply hunk to document content →
      Update Document
```

## React Component Hierarchy

```
App
  ├─ Editor
  │   ├─ TextArea (contentEditable div)
  │   └─ InlineDiff (if operation.hunks.length > 0)
  │       └─ Hunk reviewers (accept/reject buttons)
  ├─ Settings
  │   ├─ Provider selector
  │   ├─ Model selector
  │   └─ Parameter controls
  ├─ History
  │   └─ Operation history items
  └─ Logs
      └─ API call logs
```

**State Management:**

- `content` — Full document text
- `activeOperation` — Current operation being reviewed
- `selectionStart` / `selectionEnd` — Current text selection
- `documentManager` — Applies changes to content

## Key Implementation Notes

### Selection Management

Selection is stored as character offsets (start, end) in the full document. This allows:
- Accurate tracking of which part is selected
- Easy integration with AI operations (extract text by indices)
- Proper positioning of inline diff viewers

### Comment Extraction

AI responses are expected to contain:

```
[REWRITTEN TEXT HERE]
[COMMENT]What I changed[/COMMENT]
```

The `BaseAIProvider.extractComment()` method parses this using regex and returns clean text + comment separately.

### Thinking Models (Ollama)

Ollama 0.5+ supports thinking models (like `qwen3:14b`). When `think: true`:
- Model stores reasoning in `response.thinking`
- Final answer in `response.response`
- If `response.response` is empty, model ran out of tokens during thinking

**Fix:** Set `think: false` (default) unless user enables "Thinking" mode in Settings.

### Error Handling

- `provider.generate()` throws descriptive errors (e.g., "Model ran out of tokens while thinking")
- Errors are caught in operation handlers and displayed to user via status bar
- All API calls have 120-second timeout

## Performance Considerations

1. **Diff Computation** — Uses `diff` library which is O(n log n). Fine for documents < 1MB.
2. **Hunk Application** — Linear scan to find and apply hunks. O(hunks × lines).
3. **Selection Tracking** — Offsets are direct, no DOM queries needed.

For large documents (> 100KB), consider batching changes or streaming responses.

## Testing

Run TypeScript checks:

```bash
npm run lint
```

No test suite currently. To add:

1. Create `src/__tests__/` directory
2. Use Jest or Vitest
3. Test operations independently:
   - Mock providers returning fixed responses
   - Test diff computation with known inputs/outputs
   - Test DocumentManager state transitions

## Future Enhancements

1. **Undo/Redo** — Track revisions and allow rewinding
2. **Streaming** — Support real-time token streaming from providers
3. **Batch Operations** — Process multiple selections sequentially
4. **Custom Prompts** — Let users define custom operations
5. **File I/O** — Load/save documents, history persistence
6. **Syntax Highlighting** — Markdown/code support
7. **More Providers** — Anthropic, Gemini, local inference engines
