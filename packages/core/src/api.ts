import {
  DEFAULT_SUMMARY_SYSTEM_PROMPT,
  DEFAULT_SUMMARY_USER_PROMPT,
  type ConfigManager,
} from './config';
import type { ExtractedContent, ArticleContent, QuestionContent, AnswerContent } from './extractor';

const CONTENT_LIMIT = 3000;

export function normalizeChatCompletionsUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  let parsed: URL | null = null;
  try {
    parsed = new URL(trimmed);
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return trimmed.replace(/\/+$/, '');
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString();
}

export interface APIResponse {
  success: boolean;
  message: string;
}

export class APIClient {
  private apiKey: string = '';
  private apiUrl: string = 'https://api.openai.com/v1/chat/completions';
  private model: string = 'gpt-4o-mini';

  // Expose model property for UI components
  get modelName(): string {
    return this.model;
  }

  constructor(private configManager: ConfigManager) {
    this.loadCurrentAccount();
  }

  async loadCurrentAccount(): Promise<void> {
    const accounts = (await this.configManager.get('AI_ACCOUNTS', [])) ?? [];
    const currentAccountId = (await this.configManager.get('CURRENT_ACCOUNT_ID', '')) ?? '';

    if (accounts.length === 0) {
      this.apiKey = '';
      this.apiUrl = 'https://api.openai.com/v1/chat/completions';
      this.model = 'gpt-4o-mini';
    } else {
      const currentAccount = accounts.find((acc) => acc.id === currentAccountId) || accounts[0];
      if (currentAccount) {
        this.apiKey = currentAccount.apiKey;
        this.apiUrl = currentAccount.apiUrl;
        this.model = currentAccount.model;
        if (!currentAccountId) {
          await this.configManager.set('CURRENT_ACCOUNT_ID', currentAccount.id);
        }
      }
    }
  }

  private buildSourceBlock(content: ExtractedContent): { text: string; vars: Record<string, string> } {
    if (content.type === 'article') {
      const article = content as ArticleContent;
      const title = article.title;
      const body = article.content.substring(0, CONTENT_LIMIT);
      return {
        text: `【知乎文章】\n标题：${title}\n\n内容：${body}`,
        vars: { title, content: body, author: '', question: title, questionDesc: '' },
      };
    }
    if (content.type === 'question') {
      const question = content as QuestionContent;
      const title = question.title;
      const body = question.content.substring(0, CONTENT_LIMIT);
      return {
        text: `【知乎问题】\n问题：${title}\n\n描述：${body}`,
        vars: { title, content: body, author: '', question: title, questionDesc: body },
      };
    }
    const answer = content as AnswerContent;
    const body = answer.content.substring(0, CONTENT_LIMIT);
    return {
      text: `【知乎回答】\n问题：${answer.questionTitle}\n问题描述：${answer.questionDesc}\n作者：${answer.author}\n\n内容：${body}`,
      vars: {
        title: answer.questionTitle,
        content: body,
        author: answer.author,
        question: answer.questionTitle,
        questionDesc: answer.questionDesc,
      },
    };
  }

  private applyPromptTemplate(template: string, vars: Record<string, string>): string | null {
    if (!/\{\{\w+\}\}/.test(template)) {
      return null;
    }
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? '');
  }

  private async generatePrompt(content: ExtractedContent): Promise<string> {
    const stored = (await this.configManager.get('SUMMARY_USER_PROMPT', DEFAULT_SUMMARY_USER_PROMPT)) ?? DEFAULT_SUMMARY_USER_PROMPT;
    const instruction = stored.trim() || DEFAULT_SUMMARY_USER_PROMPT;
    const source = this.buildSourceBlock(content);
    const templated = this.applyPromptTemplate(instruction, source.vars);
    if (templated !== null) {
      return templated;
    }
    return `${source.text}\n\n要求：${instruction}`;
  }

  private async buildMessages(content: ExtractedContent): Promise<Array<{ role: 'system' | 'user'; content: string }>> {
    const storedSystem = (await this.configManager.get('SUMMARY_SYSTEM_PROMPT', DEFAULT_SUMMARY_SYSTEM_PROMPT)) ?? DEFAULT_SUMMARY_SYSTEM_PROMPT;
    const systemPrompt = storedSystem.trim();
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: await this.generatePrompt(content) });
    return messages;
  }

  async testConnection(apiKey: string, apiUrl: string, model: string): Promise<APIResponse> {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: '今天北京天气怎么样？' }],
          max_tokens: 200,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      await response.json();
      return { success: true, message: '连接成功！API配置正确。' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: errorMessage.includes('Failed to fetch')
          ? '连接失败：无法访问API接口，请检查网络连接和接口地址'
          : `连接失败：${errorMessage}`,
      };
    }
  }

  async streamCall(
    content: ExtractedContent,
    onChunk: (text: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (!this.apiKey) {
      onError(new Error('请先配置OpenAI API Key！点击右下角设置按钮进行配置。'));
      return;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: await this.buildMessages(content),
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) {break;}

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.delta?.content || '';
              if (text) {
                onChunk(text);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      onComplete();
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      onError(typedError);
    }
  }
}
