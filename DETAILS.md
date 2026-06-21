# AI Text Editor — Детали реализации

## Архитектура

```
┌────────────────────────────────────────────┐
│          React UI (components/)            │
│   Editor, Settings, History, Logs          │
└─────────────────┬──────────────────────────┘
                  │
┌─────────────────▼──────────────────────────┐
│           Core Engine (core/)              │
│  ┌──────────────────────────────────────┐  │
│  │  Operations (grammar, rewrite, ...)  │  │
│  ├──────────────────────────────────────┤  │
│  │  AI Providers (Ollama, OpenAI, ...)  │  │
│  ├──────────────────────────────────────┤  │
│  │  STT Providers (Web, Whisper, OAI)   │  │
│  ├──────────────────────────────────────┤  │
│  │  Diff Engine                         │  │
│  ├──────────────────────────────────────┤  │
│  │  Document Manager                    │  │
│  ├──────────────────────────────────────┤  │
│  │  History & Logging                   │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

---

## 1. Операции (`core/operations/`)

Операция — это запрос на изменение текста через AI. Все операции наследуют `AIOperation`:

```typescript
abstract class AIOperation {
  abstract type: OperationType
  abstract promptKey: OperationType

  async execute(
    provider: AIProvider,
    text: string,
    context: string,
    settings: ProviderSettings,
    extra: Record<string, string>,
    options: GenerateOptions
  ): Promise<AIOperationResult>

  abstract prepareContext(
    fullText: string,
    selection?: { start: number; end: number }
  ): string
}
```

**Жизненный цикл операции:**

1. `prepareContext()` — контекст вокруг выделения (например, 3 строки до/после)
2. `execute()` → `provider.generate()` — запрос к AI
3. `DiffEngine.computeHunks()` — вычисление диффа оригинал vs. результат
4. Возврат `AIOperationResult` с массивом hunks

**Встроенные операции:**

| Класс | Назначение |
|---|---|
| `GrammarFixOperation` | Грамматика и пунктуация |
| `PoetryGrammarFixOperation` | Только опечатки, без изменения структуры стиха |
| `RewriteOperation` | Рерайт по инструкции пользователя |

### Добавление новой операции

1. Создать `src/core/operations/MyOperation.ts`:

```typescript
export class MyOperation extends AIOperation {
  protected readonly type = 'my-operation' as OperationType
  protected readonly promptKey = 'my-operation' as OperationType

  prepareContext(fullText: string, selection?: { start: number; end: number }): string {
    return ''  // контекст для AI (например, соседние строки)
  }
}
```

2. Зарегистрировать промпт в `PromptRegistry`:

```typescript
this.register('my-operation', {
  systemPrompt: 'Системная инструкция...',
  userPrompt: 'Текст:\n{text}',
})
```

3. Создать экземпляр в `App.tsx` и добавить кнопку.

---

## 2. AI-провайдеры (`core/providers/`)

Провайдер реализует интерфейс `AIProvider`:

```typescript
interface AIProvider {
  type: AIProviderConfig['type']
  label: string
  capabilities: ProviderCapabilities

  configure(config: AIProviderConfig): void
  generate(systemPrompt, prompt, context, settings, options): Promise<AIResponse>
  listModels(): Promise<string[]>
  isAvailable(): Promise<boolean>
}
```

**Встроенные провайдеры:**

- `OllamaProvider` — локальный Ollama
- `OpenAICompatibleProvider` — OpenAI, LM Studio, Together AI, Jan и т.д.

### Добавление нового провайдера

1. Создать `src/core/providers/MyProvider.ts`:

```typescript
export class MyProvider extends BaseAIProvider {
  readonly type = 'my-provider' as const
  readonly label = 'My Provider'

  async generate(systemPrompt, prompt, context, settings): Promise<AIResponse> {
    const res = await fetch('https://api.example.com/chat', {
      method: 'POST',
      body: JSON.stringify({ ... }),
    })
    const data = await res.json()
    const raw = data.choices[0].message.content
    const { cleanText, comment } = this.extractComment(raw)
    return { text: cleanText, comment, raw }
  }
}
```

2. Зарегистрировать в `ProviderRegistry`.
3. Добавить тип в `AIProviderConfig['type']` в `core/types.ts`.

### Формат ответа AI

AI-ответ должен содержать чистый текст, а опциональный комментарий — в специальном теге:

```
[ПЕРЕПИСАННЫЙ ТЕКСТ]
[COMMENT]Что именно изменил[/COMMENT]
```

`BaseAIProvider.extractComment()` разбирает это через regex и возвращает `{ text, comment }`.

---

## 3. STT-подсистема (`core/stt/`, `core/audio/`)

### Интерфейс

```typescript
interface STTSession {
  stop(): Promise<string>  // остановить запись и вернуть транскрипт
}

interface SpeechToTextProvider {
  readonly label: string
  readonly type: string
  startSession(lang: string): Promise<STTSession>
  checkAvailability(): Promise<{ available: boolean; error?: string }>
}
```

### Провайдеры

| Класс | Реализация |
|---|---|
| `WebSpeechProvider` | Браузерный `SpeechRecognition` API. Нет зависимостей, требует интернет |
| `LocalWhisperProvider` | Записывает PCM через `AudioRecorder`, отправляет WAV на `POST /transcribe` |
| `OpenAICompatibleSTTProvider` | Записывает PCM, отправляет WAV на `POST /v1/audio/transcriptions` |

Фабрика `createSTTProvider(settings: STTSettings)` создаёт нужный провайдер по конфигурации.

### Запись звука

`AudioRecorder` (`core/audio/recorder.ts`) использует `ScriptProcessorNode` для захвата PCM-фреймов. `encodeWav()` (`core/audio/wavEncoder.ts`) упаковывает их в WAV-файл.

### Dev proxy

`toFetchUrl()` (`core/stt/devProxy.ts`) конвертирует `http://localhost:8000/transcribe` в `/transcribe` в dev-режиме — чтобы запрос шёл через Vite proxy и обходил CORS. В production Electron-сборке (`webSecurity: false`) URL используется напрямую.

### Хук

```typescript
const { status, error, start, stop, cancel } = useSpeechToText(provider, lang)
// status: 'idle' | 'recording' | 'transcribing' | 'error'
```

---

## 4. Diff Engine (`core/diff/DiffEngine.ts`)

Использует библиотеку `diff` для вычисления hunks (блоков изменений).

```typescript
interface DiffHunk {
  id: string
  oldStart: number       // строка в оригинале (1-indexed)
  oldLines: string[]     // строки, которые уходят
  newStart: number
  newLines: string[]     // строки, которые приходят
  accepted: boolean | null  // null = ожидание, true = принят, false = отклонён
}
```

---

## 5. Document Manager (`core/document/DocumentManager.ts`)

Управляет состоянием документа и применяет принятые изменения.

**Поток данных:**

1. Операция завершается → `applyOperationResult()` сохраняет hunks в `activeOperations`
2. Пользователь принимает hunk → `acceptHunk()` немедленно применяет изменение к документу
3. После применения hunk удаляется из массива; номера строк последующих hunks пересчитываются с учётом дельты
4. Когда hunks заканчиваются — операция закрыта

Немедленное применение выбрано сознательно: это упрощает отслеживание состояния и позволяет следующим операциям работать с уже изменённым текстом.

---

## 6. Чанкинг больших текстов

При `chunkSize > 0` и тексте длиннее `chunkSize` символов `TextChunker` разбивает документ на части. Каждый чанк обрабатывается отдельно с передачей контекста из предыдущего (`chunkOverlap` символов). После обработки всех чанков результаты склеиваются и вычисляется единый дифф.

---

## 7. История и логи

- **HistoryStore** — хранит результаты всех операций (тип, время, комментарий AI)
- **LogStore** — хранит полные API-запросы: системный промпт, пользовательский промпт, сырой ответ, дифф

Оба хранилища in-memory. Для персистентности достаточно добавить сериализацию в файл в этих модулях.

---

## 8. Пример потока данных: Grammar Fix

```
Пользователь выделяет "он пошёл в магазин" → нажимает Grammar Fix
  │
  ├─ prepareContext() → текст + 3 строки контекста
  │
  ├─ provider.generate() →
  │  System: "Исправь грамматику, не меняй стиль..."
  │  User:   "Текст: он пошёл в магазин"
  │
  ├─ AI Response: "Он пошёл в магазин.\n[COMMENT]Добавил заглавную[/COMMENT]"
  │
  ├─ extractComment() →
  │  text:    "Он пошёл в магазин."
  │  comment: "Добавил заглавную"
  │
  ├─ DiffEngine.computeHunks() →
  │  Hunk 1:
  │    - "он пошёл в магазин"
  │    + "Он пошёл в магазин."
  │
  └─ Пользователь Accept →
       documentManager.acceptHunk() → обновление документа
```

---

## 9. Развитие проекта

Потенциальные направления:

- **Undo/Redo** — отмена принятых изменений
- **Стриминг** — отображение токенов по мере генерации
- **Файловый I/O** — открытие/сохранение файлов, персистентность истории
- **Кастомные промпты** — редактор промптов прямо в интерфейсе
- **Синтаксическая подсветка** — markdown, код
- **Дополнительные провайдеры** — Anthropic, Gemini и др.
- **AudioWorkletNode** — замена устаревшего `ScriptProcessorNode` в `AudioRecorder`
- **Тесты** — Vitest для операций, diff engine, document manager
