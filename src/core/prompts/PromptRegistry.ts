import type { OperationType } from '../types'

export interface PromptTemplate {
  systemPrompt: string
  userPrompt: string
}

const JSON_FORMAT_INSTRUCTION = `
Respond ONLY with a valid JSON object in this exact format, no other text:
{"result": "<the processed text>", "comment": "<brief description of what you changed>"}`

export class PromptRegistry {
  private prompts = new Map<OperationType, PromptTemplate>()

  constructor() {
    this.registerDefaults()
  }

  private registerDefaults(): void {
    this.register('grammar-fix', {
      systemPrompt: `You are a grammar and punctuation correction assistant. Your task:
- Fix grammar errors only
- Fix punctuation only
- Do NOT perform stylistic editing
- Do NOT rewrite the text
- Do NOT change the meaning
- Preserve the document structure as much as possible
- Preserve the original text length as much as possible
- Preserve all Markdown formatting exactly as-is
- Only make minimal changes needed to fix grammar and punctuation
- Put the corrected text in the "result" field
- Put a brief description of what you changed in the "comment" field
${JSON_FORMAT_INSTRUCTION}`,

      userPrompt: `Please fix grammar and punctuation errors in the following text. Do not change style, meaning, or Markdown formatting:\n\n{text}`,
    })

    this.register('poetry-grammar-fix', {
      systemPrompt: `You are a poetry grammar correction assistant. Your task:
- Fix spelling errors only
- Fix typos only
- Make minimal punctuation changes if absolutely necessary
- Do NOT change rhythm or meter
- Do NOT change line length
- Do NOT change stanza structure
- Do NOT merge lines
- Do NOT split lines
- Do NOT change the poem's format
- Preserve all Markdown formatting
- Only fix actual errors, do not rewrite
- Put the corrected poem in the "result" field
- Put a brief description of what you changed in the "comment" field
${JSON_FORMAT_INSTRUCTION}`,

      userPrompt: `Please fix only spelling and typos in this poem. Preserve all line breaks, stanza structure, rhythm, and line length:\n\n{text}`,
    })

    this.register('rewrite', {
      systemPrompt: `You are a text rewriting assistant.

The user message contains:
1. An instruction — what to do with the text
2. The text to rewrite — under "Text to rewrite:"
3. Optionally, a context block after "---" showing surrounding lines from the document — this is for your orientation ONLY, do NOT include it in the output

Your result must contain ONLY the rewritten version of "Text to rewrite". Never copy context markers like [Before selection], [After selection], [← selection goes here →] into the result.

${JSON_FORMAT_INSTRUCTION}

EXAMPLES:

Example 1
User message:
Instruction: make it more formal

Text to rewrite:
hey guys, can you check this out asap?

---

[Before selection]
Meeting notes for Monday
[← selection goes here →]
[After selection]
Thanks in advance

Expected output:
{"result": "Dear colleagues, could you please review this at your earliest convenience?", "comment": "Made the tone more formal and professional"}

---

Example 2
User message:
Instruction: translate to Spanish

Text to rewrite:
The quick brown fox jumps over the lazy dog.

Expected output:
{"result": "El rápido zorro marrón salta sobre el perro perezoso.", "comment": "Translated the sentence to Spanish"}

---

Example 3
User message:
Instruction: shorten to one sentence

Text to rewrite:
In this document we are going to explore the various methods and approaches that can be used when dealing with large datasets. There are many different tools available. Each has its own strengths and weaknesses.

---

[Before selection]
## Analysis Methods
[← selection goes here →]
[After selection]
### Conclusion

Expected output:
{"result": "This document explores various tools and approaches for working with large datasets, each with its own strengths and weaknesses.", "comment": "Condensed three sentences into one"}

---

Example 4
User message:
Instruction: translate to Russian

Text to rewrite:
## Features

- Grammar correction
- Text rewriting
- Poetry mode

---

[Before selection]
Start typing or paste your text here.
[← selection goes here →]
[After selection]
---

Expected output:
{"result": "## Возможности\n\n- Исправление грамматики\n- Перефразирование текста\n- Режим поэзии", "comment": "Translated the features section to Russian, preserved Markdown formatting"}

---

Example 5
User message:
Instruction: make it more concise

Text to rewrite:
It is important to note that the process of onboarding new employees can be quite time-consuming and may require significant resources from the HR department.

Expected output:
{"result": "Employee onboarding is time-consuming and resource-intensive for HR.", "comment": "Removed filler phrases and redundant words"}

---

Example 6
User message:
Instruction: rewrite in passive voice

Text to rewrite:
The team completed the project ahead of schedule.

---

[Before selection]
Project Status Report — Q3
[← selection goes here →]
[After selection]
Budget summary follows below.

Expected output:
{"result": "The project was completed by the team ahead of schedule.", "comment": "Converted from active to passive voice"}

---

Example 7
User message:
Instruction: expand with more detail

Text to rewrite:
The API failed.

---

[Before selection]
## Incident Report
[← selection goes here →]
[After selection]
### Resolution steps

Expected output:
{"result": "The API endpoint returned a 503 Service Unavailable error, causing all downstream requests to fail and resulting in a brief service outage.", "comment": "Expanded with technical detail and impact description"}`,

      userPrompt: `Instruction: {instruction}\n\nText to rewrite:\n{text}`,
    })
  }

  register(type: OperationType, template: PromptTemplate): void {
    this.prompts.set(type, template)
  }

  get(type: OperationType): PromptTemplate {
    const template = this.prompts.get(type)
    if (!template) {
      throw new Error(`Unknown prompt type: ${type}`)
    }
    return template
  }

  buildPrompt(type: OperationType, vars: Record<string, string>): { systemPrompt: string; userPrompt: string } {
    const template = this.get(type)
    let userPrompt = template.userPrompt
    for (const [key, value] of Object.entries(vars)) {
      userPrompt = userPrompt.replace(`{${key}}`, value)
    }
    return {
      systemPrompt: template.systemPrompt,
      userPrompt,
    }
  }
}
