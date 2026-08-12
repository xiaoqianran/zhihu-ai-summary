import { useState, useEffect } from 'preact/hooks';
import {
  DEFAULT_MERMAID_SYSTEM_PROMPT,
  DEFAULT_MERMAID_USER_PROMPT,
  DEFAULT_SUMMARY_SYSTEM_PROMPT,
  DEFAULT_SUMMARY_USER_PROMPT,
  normalizeChatCompletionsUrl,
} from '@zhihu-ai-summary/core';
import type { Account, ConfigManager, APIClient } from '@zhihu-ai-summary/core';
import { toast } from './Toast';
import { InputModal } from './InputModal';
import { confirm } from './ConfirmModal';
import {
  CATPPUCCIN_ACCENTS,
  CATPPUCCIN_FLAVORS,
  DEFAULT_THEME_ACCENT,
  DEFAULT_THEME_FLAVOR,
  getAccentColor,
  isCatppuccinAccent,
  isCatppuccinFlavor,
  setTheme,
  type CatppuccinAccent,
  type CatppuccinFlavor,
} from '../theme';
import { useThemeRoot } from '../useThemeRoot';

interface ConfigModalProps {
  configManager: ConfigManager;
  apiClient: APIClient;
  onClose: () => void;
}

type TabType = 'data' | 'accounts' | 'settings';

export function ConfigModal({ configManager, apiClient, onClose }: ConfigModalProps) {
  // 从环境变量获取平台信息
  const appName = import.meta.env.VITE_APP_NAME;
  const version = import.meta.env.VITE_APP_VERSION;
  const author = import.meta.env.VITE_APP_AUTHOR;
  const homepage = import.meta.env.VITE_APP_HOMEPAGE;

  const [activeTab, setActiveTab] = useState<TabType>('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string>('');
  const [autoSummarize, setAutoSummarize] = useState(false);
  const [minAnswerLength, setMinAnswerLength] = useState(200);
  const [cacheSize, setCacheSize] = useState(100);
  const [cacheCount, setCacheCount] = useState(0);
  const [cacheStorageSize, setCacheStorageSize] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SUMMARY_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState(DEFAULT_SUMMARY_USER_PROMPT);
  const [mermaidSystemPrompt, setMermaidSystemPrompt] = useState(DEFAULT_MERMAID_SYSTEM_PROMPT);
  const [mermaidUserPrompt, setMermaidUserPrompt] = useState(DEFAULT_MERMAID_USER_PROMPT);
  const [themeFlavor, setThemeFlavor] = useState<CatppuccinFlavor>(DEFAULT_THEME_FLAVOR);
  const [themeAccent, setThemeAccent] = useState<CatppuccinAccent>(DEFAULT_THEME_ACCENT);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const modalRef = useThemeRoot<HTMLDivElement>();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [copyingAccountId, setCopyingAccountId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadConfig();
    // 定期刷新缓存条数和占用空间
    const timer = setInterval(async () => {
      const count = await configManager.getCacheCount();
      const size = await configManager.getCacheStorageSize();
      setCacheCount(count);
      setCacheStorageSize(size);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const loadConfig = async () => {
    const accs = await configManager.get('AI_ACCOUNTS', []);
    const currentId = await configManager.get('CURRENT_ACCOUNT_ID', '');
    const autoSum = await configManager.get('AUTO_SUMMARIZE', false);
    const minLen = await configManager.get('MIN_ANSWER_LENGTH', 200);
    const cachedSize = await configManager.get('SUMMARY_CACHE_SIZE', 100);
    const cachedCount = await configManager.getCacheCount();
    const storageSize = await configManager.getCacheStorageSize();
    const storedSystemPrompt = await configManager.get('SUMMARY_SYSTEM_PROMPT', DEFAULT_SUMMARY_SYSTEM_PROMPT);
    const storedUserPrompt = await configManager.get('SUMMARY_USER_PROMPT', DEFAULT_SUMMARY_USER_PROMPT);
    const storedMermaidSystem = await configManager.get('MERMAID_SYSTEM_PROMPT', DEFAULT_MERMAID_SYSTEM_PROMPT);
    const storedMermaidUser = await configManager.get('MERMAID_USER_PROMPT', DEFAULT_MERMAID_USER_PROMPT);

    setAccounts(accs);
    setCurrentAccountId(currentId);
    setAutoSummarize(autoSum);
    setMinAnswerLength(minLen);
    setCacheSize(cachedSize);
    setCacheCount(cachedCount);
    setCacheStorageSize(storageSize);
    setSystemPrompt(storedSystemPrompt ?? DEFAULT_SUMMARY_SYSTEM_PROMPT);
    setUserPrompt(storedUserPrompt ?? DEFAULT_SUMMARY_USER_PROMPT);
    setMermaidSystemPrompt(storedMermaidSystem ?? DEFAULT_MERMAID_SYSTEM_PROMPT);
    setMermaidUserPrompt(storedMermaidUser ?? DEFAULT_MERMAID_USER_PROMPT);

    const storedFlavor = await configManager.get('UI_THEME_FLAVOR', DEFAULT_THEME_FLAVOR);
    const storedAccent = await configManager.get('UI_THEME_ACCENT', DEFAULT_THEME_ACCENT);
    const flavor = isCatppuccinFlavor(storedFlavor ?? '') ? storedFlavor as CatppuccinFlavor : DEFAULT_THEME_FLAVOR;
    const accent = isCatppuccinAccent(storedAccent ?? '') ? storedAccent as CatppuccinAccent : DEFAULT_THEME_ACCENT;
    setThemeFlavor(flavor);
    setThemeAccent(accent);
    setTheme(flavor, accent);
  };

  const handleSelectAccount = async (accountId: string) => {
    try {
      const account = accounts.find(acc => acc.id === accountId);
      const ok = await configManager.set('CURRENT_ACCOUNT_ID', accountId);
      if (!ok) {
        toast.error('切换账号失败：配置保存失败');
        return;
      }
      await apiClient.loadCurrentAccount();
      setCurrentAccountId(accountId);
      if (account) {
        toast.success(`已切换到账号：${account.name}`);
      }
    } catch (error) {
      console.error('切换账号失败:', error);
      toast.error('切换账号失败');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const ok = await confirm({
        title: '删除账号',
        message: '确定要删除这个账号吗？',
        confirmText: '删除',
        cancelText: '取消',
        danger: true,
      });

      if (!ok) {
        return;
      }

      const filteredAccounts = accounts.filter(acc => acc.id !== accountId);
      const saved = await configManager.set('AI_ACCOUNTS', filteredAccounts);
      if (!saved) {
        toast.error('删除账号失败：配置保存失败');
        return;
      }

      if (accountId === currentAccountId) {
        const newCurrentId = filteredAccounts[0]?.id || '';
        const savedCurrent = await configManager.set('CURRENT_ACCOUNT_ID', newCurrentId);
        if (!savedCurrent) {
          toast.error('删除账号成功，但切换默认账号失败');
        }
        await apiClient.loadCurrentAccount();
        setCurrentAccountId(newCurrentId);
      }

      setAccounts(filteredAccounts);
      toast.success('账号已删除');
    } catch (error) {
      console.error('删除账号失败:', error);
      toast.error('删除账号失败');
    }
  };

  const handleSaveSettings = async () => {
    try {
      const nextSystemPrompt = systemPrompt.trim();
      const nextUserPrompt = userPrompt.trim() || DEFAULT_SUMMARY_USER_PROMPT;
      const nextMermaidSystem = mermaidSystemPrompt.trim() || DEFAULT_MERMAID_SYSTEM_PROMPT;
      const nextMermaidUser = mermaidUserPrompt.trim() || DEFAULT_MERMAID_USER_PROMPT;
      const ok1 = await configManager.set('AUTO_SUMMARIZE', autoSummarize);
      const ok2 = await configManager.set('MIN_ANSWER_LENGTH', minAnswerLength);
      const ok3 = await configManager.set('SUMMARY_CACHE_SIZE', cacheSize);
      const ok4 = await configManager.set('SUMMARY_SYSTEM_PROMPT', nextSystemPrompt);
      const ok5 = await configManager.set('SUMMARY_USER_PROMPT', nextUserPrompt);
      const ok6 = await configManager.set('UI_THEME_FLAVOR', themeFlavor);
      const ok7 = await configManager.set('UI_THEME_ACCENT', themeAccent);
      const ok8 = await configManager.set('MERMAID_SYSTEM_PROMPT', nextMermaidSystem);
      const ok9 = await configManager.set('MERMAID_USER_PROMPT', nextMermaidUser);
      if (!ok1 || !ok2 || !ok3 || !ok4 || !ok5 || !ok6 || !ok7 || !ok8 || !ok9) {
        toast.error('设置保存失败');
        return;
      }
      setTheme(themeFlavor, themeAccent);
      setMermaidSystemPrompt(nextMermaidSystem);
      setMermaidUserPrompt(nextMermaidUser);
      setSystemPrompt(nextSystemPrompt);
      setUserPrompt(nextUserPrompt);
      toast.success('设置已保存！');
    } catch (error) {
      console.error('设置保存失败:', error);
      toast.error('设置保存失败');
    }
  };

  const handleExportConfig = async () => {
    try {
      const configJson = await configManager.exportConfig();

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(configJson);
        toast.success('配置已复制到剪贴板！');
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = configJson;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('配置已复制到剪贴板！');
      }
    } catch (error) {
      console.error('复制配置失败:', error);
      toast.error('复制配置失败');
    }
  };

  const handleImportConfig = async (configJson: string) => {
    try {
      const config = JSON.parse(configJson);

      if (!config.AI_ACCOUNTS || !Array.isArray(config.AI_ACCOUNTS)) {
        throw new Error('配置格式错误：缺少有效的账号列表');
      }

      for (const account of config.AI_ACCOUNTS) {
        if (!account.id || !account.name || !account.apiUrl || !account.apiKey || !account.model) {
          throw new Error('配置格式错误：账号信息不完整');
        }
      }

      const ok = await confirm({
        title: '导入配置',
        message: '导入配置将覆盖现有设置，确定要继续吗？',
        confirmText: '继续导入',
        cancelText: '取消',
        danger: true,
      });

      if (ok) {
        const success = await configManager.importConfig(configJson);

        if (success) {
          await apiClient.loadCurrentAccount();
          await loadConfig();
          toast.success('配置导入成功！');
        } else {
          toast.error('配置导入失败');
        }
      }
    } catch (error) {
      console.error('导入配置失败:', error);
      toast.error('配置格式错误，请检查JSON格式是否正确');
    }
  };

  const handleKeyDownActivate = (e: KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  return (
    <>
      <div className="zhihu-ai-modal">
        <button
          type="button"
          className="zhihu-ai-modal-overlay"
          aria-label="关闭弹窗"
          onClick={onClose}
        />
        <div ref={modalRef} className="zhihu-ai-modal-content" role="dialog" aria-modal="true" aria-label={appName} tabIndex={-1}>
          <div className="zhihu-ai-modal-header">
            <div className="zhihu-ai-modal-title">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3.2l.86 4.18L17 8.2l-4.14.82L12 13.2l-.86-4.18L7 8.2l4.14-.82L12 3.2z" fill="currentColor" />
                <path d="M18.2 13.6l.4 1.96 1.96.4-1.96.4-.4 1.96-.4-1.96-1.96-.4 1.96-.4.4-1.96z" fill="currentColor" opacity="0.7" />
              </svg>
              <div className="zhihu-ai-brand-copy">
                <div className="zhihu-ai-brand-name">{appName}</div>
                <div className="zhihu-ai-brand-meta">
                  <span>作者 {author}</span>
                  <span aria-hidden="true">·</span>
                  <a
                    href={homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    v{version}
                  </a>
                </div>
              </div>
            </div>
            <button type="button" className="zhihu-ai-modal-close" onClick={onClose} aria-label="关闭">×</button>
          </div>

          <div className="zhihu-ai-modal-body">
            <div className="zhihu-ai-tabs">
              <button
                type="button"
                className={`zhihu-ai-tab ${activeTab === 'data' ? 'active' : ''}`}
                onClick={() => setActiveTab('data')}
                onKeyDown={(e) => handleKeyDownActivate(e as unknown as KeyboardEvent, () => setActiveTab('data'))}
              >
                配置
              </button>
              <button
                type="button"
                className={`zhihu-ai-tab ${activeTab === 'accounts' ? 'active' : ''}`}
                onClick={() => setActiveTab('accounts')}
                onKeyDown={(e) => handleKeyDownActivate(e as unknown as KeyboardEvent, () => setActiveTab('accounts'))}
              >
                账号
              </button>
              <button
                type="button"
                className={`zhihu-ai-tab ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
                onKeyDown={(e) => handleKeyDownActivate(e as unknown as KeyboardEvent, () => setActiveTab('settings'))}
              >
                设置
              </button>
            </div>

            {activeTab === 'accounts' && (
              <div className="zhihu-ai-tab-content active">
                <div className="zhihu-ai-account-list">
                  {accounts.length === 0 ? (
                    <div className="zhihu-ai-empty">
                      还没有账号。先添加一个，再开始总结。
                    </div>
                  ) : (
                    accounts.map(account => (
                      <div
                        key={account.id}
                        className={`zhihu-ai-account-item ${account.id === currentAccountId ? 'active' : ''}`}
                      >
                        <button
                          type="button"
                          className="zhihu-ai-account-select"
                          onClick={() => handleSelectAccount(account.id)}
                          onKeyDown={(e) => handleKeyDownActivate(e as unknown as KeyboardEvent, () => handleSelectAccount(account.id))}
                        >
                          <div className="zhihu-ai-account-info">
                            <div className="zhihu-ai-account-name">{account.name}</div>
                            <div className="zhihu-ai-account-detail">
                              {account.model} • {account.apiUrl.length > 40 ? account.apiUrl.substring(0, 40) + '...' : account.apiUrl}
                            </div>
                          </div>
                        </button>
                        <div className="zhihu-ai-account-actions">
                          <button
                            type="button"
                            className="zhihu-ai-account-btn zhihu-ai-account-btn-copy"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCopyingAccountId(account.id);
                              setShowAccountForm(true);
                            }}
                          >
                            复制
                          </button>
                          <button
                            type="button"
                            className="zhihu-ai-account-btn zhihu-ai-account-btn-edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAccountId(account.id);
                              setShowAccountForm(true);
                            }}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="zhihu-ai-account-btn zhihu-ai-account-btn-delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAccount(account.id);
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  className="zhihu-ai-add-account-btn"
                  onClick={() => {
                    setEditingAccountId(null);
                    setCopyingAccountId(null);
                    setShowAccountForm(true);
                  }}
                >
                  + 添加新账号
                </button>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="zhihu-ai-tab-content active">
                <div className="zhihu-ai-config-panel">
                  <div className="zhihu-ai-config-item">
                    <div className="zhihu-ai-config-label">导入导出配置</div>
                    <div className="zhihu-ai-config-btn-group">
                      <button
                        type="button"
                        className="zhihu-ai-config-btn-half zhihu-ai-config-btn-secondary"
                        onClick={handleExportConfig}
                      >
                        复制配置
                      </button>
                      <button
                        type="button"
                        className="zhihu-ai-config-btn-half zhihu-ai-config-btn-warning"
                        onClick={() => setShowImportModal(true)}
                      >
                        导入配置
                      </button>
                    </div>
                    <div className="zhihu-ai-settings-hint">
                      导入会覆盖当前账号与设置，请先确认。
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="zhihu-ai-tab-content active">
                <div className="zhihu-ai-config-panel zhihu-ai-settings-stack">
                  <div className="zhihu-ai-settings-grid">
                    <div className="zhihu-ai-settings-card">
                      <div className="zhihu-ai-settings-card-title">自动总结</div>
                      <div className="zhihu-ai-config-item">
                        <label className="zhihu-ai-check-row">
                          <input
                            type="checkbox"
                            checked={autoSummarize}
                            onChange={(e) => setAutoSummarize((e.target as HTMLInputElement).checked)}
                          />
                          <span>打开后自动总结</span>
                        </label>
                        <div className="zhihu-ai-field-hint">
                          页面就绪后，自动梳理文章与回答；总结完成后会接着跑图梳理。
                        </div>
                      </div>
                      <div className="zhihu-ai-config-item is-flush">
                        <label className="zhihu-ai-config-label" htmlFor="zhihu-ai-min-length">回答最少字数</label>
                        <input
                          id="zhihu-ai-min-length"
                          type="number"
                          className="zhihu-ai-config-input"
                          value={minAnswerLength}
                          min="0"
                          placeholder="200"
                          onInput={(e) => setMinAnswerLength(parseInt((e.target as HTMLInputElement).value) || 200)}
                        />
                        <div className="zhihu-ai-field-hint">
                          短于这个字数的回答不会自动总结。
                        </div>
                      </div>
                    </div>
                    <div className="zhihu-ai-settings-card">
                      <div className="zhihu-ai-settings-card-title">缓存</div>
                      <div className="zhihu-ai-config-item">
                        <div className="zhihu-ai-settings-hint">
                          同一篇内容再次打开时，直接显示上次结果。
                        </div>
                      </div>
                      <div className="zhihu-ai-config-item">
                        <label className="zhihu-ai-config-label" htmlFor="zhihu-ai-cache-size">最大条数</label>
                        <input
                          id="zhihu-ai-cache-size"
                          type="number"
                          className="zhihu-ai-config-input"
                          value={cacheSize}
                          min="0"
                          max="1000"
                          onInput={(e) => setCacheSize(parseInt((e.target as HTMLInputElement).value) || 100)}
                        />
                      </div>
                      <div className="zhihu-ai-config-item">
                        <div className="zhihu-ai-settings-hint">
                          已缓存 {cacheCount} 条 · {cacheStorageSize}
                        </div>
                      </div>
                      <div className="zhihu-ai-config-item is-flush">
                        <button
                          type="button"
                          className="zhihu-ai-config-btn-warning"
                          onClick={async () => {
                            const ok = await confirm({
                              title: '清空缓存',
                              message: `确定要清空所有已缓存的 ${cacheCount} 条总结结果吗？`,
                              confirmText: '清空',
                              cancelText: '取消',
                              danger: true,
                            });
                            if (ok) {
                              await configManager.clearCache();
                              setCacheCount(0);
                              setCacheStorageSize('0 B');
                              toast.success('缓存已清空');
                            }
                          }}
                        >
                          清空缓存
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="zhihu-ai-settings-card">
                    <div className="zhihu-ai-settings-card-title">外观 · Catppuccin</div>
                    <div className="zhihu-ai-config-item">
                      <div className="zhihu-ai-config-label">口味</div>
                      <div className="zhihu-ai-flavor-grid">
                        {CATPPUCCIN_FLAVORS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`zhihu-ai-flavor-chip${themeFlavor === item.id ? ' is-active' : ''}`}
                            onClick={() => {
                              setThemeFlavor(item.id);
                              setTheme(item.id, themeAccent);
                            }}
                          >
                            <strong>{item.label}</strong>
                            <span>{item.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="zhihu-ai-config-item is-flush">
                      <div className="zhihu-ai-config-label">强调色</div>
                      <div className="zhihu-ai-accent-grid">
                        {CATPPUCCIN_ACCENTS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`zhihu-ai-accent-dot${themeAccent === item.id ? ' is-active' : ''}`}
                            title={item.label}
                            aria-label={item.label}
                            style={{ background: getAccentColor(themeFlavor, item.id) }}
                            onClick={() => {
                              setThemeAccent(item.id);
                              setTheme(themeFlavor, item.id);
                            }}
                          />
                        ))}
                      </div>
                      <div className="zhihu-ai-field-hint">
                        选中 {themeAccent}。外观只作用于本扩展，不受 Dark Reader 或知乎日夜间切换影响。
                      </div>
                    </div>
                  </div>

                  <div className="zhihu-ai-settings-card">
                    <div className="zhihu-ai-prompt-head">
                      <div className="zhihu-ai-settings-card-title">提示词</div>
                      <button
                        type="button"
                        className="zhihu-ai-prompt-reset"
                        onClick={() => {
                          setSystemPrompt(DEFAULT_SUMMARY_SYSTEM_PROMPT);
                          setUserPrompt(DEFAULT_SUMMARY_USER_PROMPT);
                        }}
                      >
                        恢复默认
                      </button>
                    </div>
                    <div className="zhihu-ai-config-item">
                      <label className="zhihu-ai-config-label" htmlFor="zhihu-ai-system-prompt">系统提示词</label>
                      <textarea
                        id="zhihu-ai-system-prompt"
                        className="zhihu-ai-config-textarea"
                        value={systemPrompt}
                        rows={3}
                        placeholder={DEFAULT_SUMMARY_SYSTEM_PROMPT}
                        onInput={(e) => setSystemPrompt((e.target as HTMLTextAreaElement).value)}
                      />
                    </div>
                    <div className="zhihu-ai-config-item is-flush">
                      <label className="zhihu-ai-config-label" htmlFor="zhihu-ai-user-prompt">用户要求</label>
                      <textarea
                        id="zhihu-ai-user-prompt"
                        className="zhihu-ai-config-textarea"
                        value={userPrompt}
                        rows={5}
                        placeholder={DEFAULT_SUMMARY_USER_PROMPT}
                        onInput={(e) => setUserPrompt((e.target as HTMLTextAreaElement).value)}
                      />
                      <div className="zhihu-ai-field-hint">
                        默认只要「梳理内容」。正文会自动附在后面。完整模板可用
                        {' '}
                        <code>{'{{title}}'}</code>
                        {' '}
                        <code>{'{{content}}'}</code>
                        {' '}
                        <code>{'{{author}}'}</code>
                        {' '}
                        <code>{'{{question}}'}</code>
                        {' '}
                        <code>{'{{questionDesc}}'}</code>
                        。
                      </div>
                    </div>
                  </div>

                  <div className="zhihu-ai-settings-card">
                    <div className="zhihu-ai-prompt-head">
                      <div className="zhihu-ai-settings-card-title">图梳理提示词</div>
                      <button
                        type="button"
                        className="zhihu-ai-prompt-reset"
                        onClick={() => {
                          setMermaidSystemPrompt(DEFAULT_MERMAID_SYSTEM_PROMPT);
                          setMermaidUserPrompt(DEFAULT_MERMAID_USER_PROMPT);
                        }}
                      >
                        恢复默认
                      </button>
                    </div>
                    <div className="zhihu-ai-config-item">
                      <label className="zhihu-ai-config-label" htmlFor="zhihu-ai-mermaid-system-prompt">系统提示词</label>
                      <textarea
                        id="zhihu-ai-mermaid-system-prompt"
                        className="zhihu-ai-config-textarea"
                        value={mermaidSystemPrompt}
                        rows={3}
                        placeholder={DEFAULT_MERMAID_SYSTEM_PROMPT}
                        onInput={(e) => setMermaidSystemPrompt((e.target as HTMLTextAreaElement).value)}
                      />
                    </div>
                    <div className="zhihu-ai-config-item is-flush">
                      <label className="zhihu-ai-config-label" htmlFor="zhihu-ai-mermaid-user-prompt">用户要求</label>
                      <textarea
                        id="zhihu-ai-mermaid-user-prompt"
                        className="zhihu-ai-config-textarea"
                        value={mermaidUserPrompt}
                        rows={4}
                        placeholder={DEFAULT_MERMAID_USER_PROMPT}
                        onInput={(e) => setMermaidUserPrompt((e.target as HTMLTextAreaElement).value)}
                      />
                      <div className="zhihu-ai-field-hint">
                        用于「图梳理」。请让模型把图放进 mermaid 代码块。
                      </div>
                    </div>
                  </div>

                  <div className="zhihu-ai-config-item is-flush">
                    <button type="button" className="zhihu-ai-config-save" onClick={handleSaveSettings}>
                      保存设置
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {showAccountForm && (
        <AccountFormModal
          configManager={configManager}
          apiClient={apiClient}
          accounts={accounts}
          editingAccountId={editingAccountId}
          copyingAccountId={copyingAccountId}
          onClose={() => {
            setShowAccountForm(false);
            setEditingAccountId(null);
            setCopyingAccountId(null);
          }}
          onSave={async () => {
            await loadConfig();
            setShowAccountForm(false);
            setEditingAccountId(null);
            setCopyingAccountId(null);
          }}
        />
      )}

      {showImportModal && (
        <InputModal
          title="导入配置"
          placeholder="请粘贴配置 JSON..."
          multiline={true}
          rows={15}
          onConfirm={(value) => {
            setShowImportModal(false);
            handleImportConfig(value);
          }}
          onCancel={() => setShowImportModal(false)}
        />
      )}
    </>
  );
}

interface AccountFormModalProps {
  configManager: ConfigManager;
  apiClient: APIClient;
  accounts: Account[];
  editingAccountId: string | null;
  copyingAccountId: string | null;
  onClose: () => void;
  onSave: () => Promise<void>;
}

function AccountFormModal({
  configManager,
  apiClient,
  accounts,
  editingAccountId,
  copyingAccountId,
  onClose,
  onSave,
}: AccountFormModalProps) {
  const formModalRef = useThemeRoot<HTMLDivElement>();
  const sourceAccount = copyingAccountId
    ? accounts.find(acc => acc.id === copyingAccountId)
    : editingAccountId
      ? accounts.find(acc => acc.id === editingAccountId)
      : null;

  const [formData, setFormData] = useState({
    name: copyingAccountId && sourceAccount ? `${sourceAccount.name} (副本)` : sourceAccount?.name || '',
    apiUrl: sourceAccount?.apiUrl || '',
    apiKey: sourceAccount?.apiKey || '',
    model: sourceAccount?.model || '',
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const normalizeApiUrlInForm = () => {
    const normalized = normalizeChatCompletionsUrl(formData.apiUrl);
    if (normalized && normalized !== formData.apiUrl) {
      setFormData((prev) => ({ ...prev, apiUrl: normalized }));
    }
  };

  const handleTest = async () => {
    normalizeApiUrlInForm();
    const apiUrl = normalizeChatCompletionsUrl(formData.apiUrl);

    if (!apiUrl || !formData.apiKey || !formData.model) {
      setTestResult({ success: false, message: '请填写完整信息' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const result = await apiClient.testConnection(formData.apiKey, apiUrl, formData.model);

    setTesting(false);
    setTestResult(result);
  };

  const handleSave = async () => {
    const apiUrl = normalizeChatCompletionsUrl(formData.apiUrl);
    if (!apiUrl || !formData.apiKey || !formData.model) {
      toast.warning('请填写完整的账号信息');
      return;
    }

    const allAccounts = await configManager.get('AI_ACCOUNTS', []) as Account[];

    if (editingAccountId) {
      const index = allAccounts.findIndex(acc => acc.id === editingAccountId);
      if (index !== -1) {
        allAccounts[index] = {
          id: editingAccountId,
          name: formData.name || formData.apiUrl,
          apiUrl,
          apiKey: formData.apiKey,
          model: formData.model,
        };
      }
    } else {
      const newAccount: Account = {
        id: Date.now().toString(),
        name: formData.name || formData.apiUrl,
        apiUrl,
        apiKey: formData.apiKey,
        model: formData.model,
      };
      allAccounts.push(newAccount);

      if (!editingAccountId) {
        await configManager.set('CURRENT_ACCOUNT_ID', newAccount.id);
      }
    }

    await configManager.set('AI_ACCOUNTS', allAccounts);
    await apiClient.loadCurrentAccount();
    await onSave();
  };

  const title = copyingAccountId ? '复制账号' : editingAccountId ? '编辑账号' : '添加账号';
  const saveButtonText = editingAccountId ? '保存修改' : '添加账号';

  return (
    <div className="zhihu-ai-modal" style={{ zIndex: 10001 }}>
      <button
        type="button"
        className="zhihu-ai-modal-overlay"
        aria-label="关闭弹窗"
        onClick={onClose}
      />
      <div
        ref={formModalRef}
        className="zhihu-ai-modal-content"
        style={{ maxWidth: '500px' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="zhihu-ai-modal-header">
          <div className="zhihu-ai-modal-title">{title}</div>
          <button type="button" className="zhihu-ai-modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="zhihu-ai-modal-body">
          <div className="zhihu-ai-config-panel">
            <div className="zhihu-ai-config-item">
              <label className="zhihu-ai-config-label" htmlFor="zhihu-ai-account-api-url">API接口地址:</label>
              <input
                id="zhihu-ai-account-api-url"
                type="text"
                className="zhihu-ai-config-input"
                value={formData.apiUrl}
                placeholder="https://api.openai.com/v1/chat/completions"
                onInput={(e) => setFormData({ ...formData, apiUrl: (e.target as HTMLInputElement).value })}
                onBlur={normalizeApiUrlInForm}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {['/v1/chat/completions', '/v1/completions'].map((suffix) => (
                  <button
                    key={suffix}
                    type="button"
                    onClick={() => {
                      const base = formData.apiUrl.trim().replace(/\/+$/, '');
                      setFormData((prev) => ({ ...prev, apiUrl: base + suffix }));
                    }}
                    style={{
                      padding: '2px 8px',
                      fontSize: '12px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '4px',
                      background: '#f5f5f5',
                      cursor: 'pointer',
                      color: '#666',
                    }}
                  >
                    {suffix}
                  </button>
                ))}
              </div>
            </div>
            <div className="zhihu-ai-config-item">
              <label className="zhihu-ai-config-label" htmlFor="zhihu-ai-account-name">备注名称:</label>
              <input
                id="zhihu-ai-account-name"
                type="text"
                className="zhihu-ai-config-input"
                value={formData.name}
                placeholder="ChatGPT 账号1"
                onInput={(e) => setFormData({ ...formData, name: (e.target as HTMLInputElement).value })}
              />
            </div>
            <div className="zhihu-ai-config-item">
              <label className="zhihu-ai-config-label" htmlFor="zhihu-ai-account-api-key">API Key:</label>
              <input
                id="zhihu-ai-account-api-key"
                type="password"
                className="zhihu-ai-config-input"
                value={formData.apiKey}
                placeholder="sk-..."
                onInput={(e) => setFormData({ ...formData, apiKey: (e.target as HTMLInputElement).value })}
              />
            </div>
            <div className="zhihu-ai-config-item">
              <label className="zhihu-ai-config-label" htmlFor="zhihu-ai-account-model">模型名称:</label>
              <input
                id="zhihu-ai-account-model"
                type="text"
                className="zhihu-ai-config-input"
                value={formData.model}
                placeholder="gpt-4o-mini"
                onInput={(e) => setFormData({ ...formData, model: (e.target as HTMLInputElement).value })}
              />
            </div>
            {testResult && (
              <div className={`zhihu-ai-test-result ${testResult.success ? 'success' : 'error'}`}>
                {testResult.success ? '✓' : '✗'} {testResult.message}
              </div>
            )}
            {testing && (
              <div className="zhihu-ai-test-result is-pending">
                正在测试连接...
              </div>
            )}
            <div className="zhihu-ai-config-btn-group">
              <button
                type="button"
                className="zhihu-ai-config-btn-half zhihu-ai-config-test zhihu-ai-config-btn-secondary"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
              <button
                type="button"
                className="zhihu-ai-config-btn-half zhihu-ai-config-save"
                onClick={handleSave}
              >
                {saveButtonText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
