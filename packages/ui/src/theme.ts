export type CatppuccinFlavor = 'latte' | 'frappe' | 'macchiato' | 'mocha';
export type CatppuccinAccent =
  | 'rosewater'
  | 'flamingo'
  | 'pink'
  | 'mauve'
  | 'red'
  | 'maroon'
  | 'peach'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'sky'
  | 'sapphire'
  | 'blue'
  | 'lavender';

export const DEFAULT_THEME_FLAVOR: CatppuccinFlavor = 'mocha';
export const DEFAULT_THEME_ACCENT: CatppuccinAccent = 'mauve';

interface FlavorPalette {
  base: string;
  mantle: string;
  crust: string;
  text: string;
  subtext1: string;
  subtext0: string;
  overlay0: string;
  surface2: string;
  surface1: string;
  surface0: string;
  accents: Record<CatppuccinAccent, string>;
}

export const CATPPUCCIN_FLAVORS: Array<{
  id: CatppuccinFlavor;
  label: string;
  hint: string;
}> = [
  { id: 'latte', label: 'Latte', hint: '浅色拿铁' },
  { id: 'frappe', label: 'Frappé', hint: '雾面浅深' },
  { id: 'macchiato', label: 'Macchiato', hint: '玛奇朵' },
  { id: 'mocha', label: 'Mocha', hint: '摩卡深色' },
];

export const CATPPUCCIN_ACCENTS: Array<{ id: CatppuccinAccent; label: string }> = [
  { id: 'rosewater', label: 'Rosewater' },
  { id: 'flamingo', label: 'Flamingo' },
  { id: 'pink', label: 'Pink' },
  { id: 'mauve', label: 'Mauve' },
  { id: 'red', label: 'Red' },
  { id: 'maroon', label: 'Maroon' },
  { id: 'peach', label: 'Peach' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'green', label: 'Green' },
  { id: 'teal', label: 'Teal' },
  { id: 'sky', label: 'Sky' },
  { id: 'sapphire', label: 'Sapphire' },
  { id: 'blue', label: 'Blue' },
  { id: 'lavender', label: 'Lavender' },
];

const PALETTES: Record<CatppuccinFlavor, FlavorPalette> = {
  latte: {
    base: '#eff1f5',
    mantle: '#e6e9ef',
    crust: '#dce0e8',
    text: '#4c4f69',
    subtext1: '#5c5f77',
    subtext0: '#6c6f85',
    overlay0: '#9ca0b0',
    surface2: '#acb0be',
    surface1: '#bcc0cc',
    surface0: '#ccd0da',
    accents: {
      rosewater: '#dc8a78',
      flamingo: '#dd7878',
      pink: '#ea76cb',
      mauve: '#8839ef',
      red: '#d20f39',
      maroon: '#e64553',
      peach: '#fe640b',
      yellow: '#df8e1d',
      green: '#40a02b',
      teal: '#179299',
      sky: '#04a5e5',
      sapphire: '#209fb5',
      blue: '#1e66f5',
      lavender: '#7287fd',
    },
  },
  frappe: {
    base: '#303446',
    mantle: '#292c3c',
    crust: '#232634',
    text: '#c6d0f5',
    subtext1: '#b5bfe2',
    subtext0: '#a5adce',
    overlay0: '#737994',
    surface2: '#626880',
    surface1: '#51576d',
    surface0: '#414559',
    accents: {
      rosewater: '#f2d5cf',
      flamingo: '#eebebe',
      pink: '#f4b8e4',
      mauve: '#ca9ee6',
      red: '#e78284',
      maroon: '#ea999c',
      peach: '#ef9f76',
      yellow: '#e5c890',
      green: '#a6d189',
      teal: '#81c8be',
      sky: '#99d1db',
      sapphire: '#85c1dc',
      blue: '#8caaee',
      lavender: '#babbf1',
    },
  },
  macchiato: {
    base: '#24273a',
    mantle: '#1e2030',
    crust: '#181926',
    text: '#cad3f5',
    subtext1: '#b8c0e0',
    subtext0: '#a5adcb',
    overlay0: '#6e738d',
    surface2: '#5b6078',
    surface1: '#494d64',
    surface0: '#363a4f',
    accents: {
      rosewater: '#f4dbd6',
      flamingo: '#f0c6c6',
      pink: '#f5bde6',
      mauve: '#c6a0f6',
      red: '#ed8796',
      maroon: '#ee99a0',
      peach: '#f5a97f',
      yellow: '#eed49f',
      green: '#a6da95',
      teal: '#8bd5ca',
      sky: '#91d7e3',
      sapphire: '#7dc4e4',
      blue: '#8aadf4',
      lavender: '#b7bdf8',
    },
  },
  mocha: {
    base: '#1e1e2e',
    mantle: '#181825',
    crust: '#11111b',
    text: '#cdd6f4',
    subtext1: '#bac2de',
    subtext0: '#a6adc8',
    overlay0: '#6c7086',
    surface2: '#585b70',
    surface1: '#45475a',
    surface0: '#313244',
    accents: {
      rosewater: '#f5e0dc',
      flamingo: '#f2cdcd',
      pink: '#f5c2e7',
      mauve: '#cba6f7',
      red: '#f38ba8',
      maroon: '#eba0ac',
      peach: '#fab387',
      yellow: '#f9e2af',
      green: '#a6e3a1',
      teal: '#94e2d5',
      sky: '#89dceb',
      sapphire: '#74c7ec',
      blue: '#89b4fa',
      lavender: '#b4befe',
    },
  },
};

export function isCatppuccinFlavor(value: string): value is CatppuccinFlavor {
  return value in PALETTES;
}

export function isCatppuccinAccent(value: string): value is CatppuccinAccent {
  return value in PALETTES.mocha.accents;
}

function hexToRgb(hex: string): string {
  const raw = hex.replace('#', '');
  const n = parseInt(raw, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function getAccentColor(flavor: CatppuccinFlavor, accent: CatppuccinAccent): string {
  return PALETTES[flavor].accents[accent];
}

export function getCatppuccinPalette(flavor: CatppuccinFlavor = getTheme().flavor) {
  return PALETTES[flavor];
}

export function getMermaidThemeOptions() {
  const { flavor, accent } = getTheme();
  const p = PALETTES[flavor];
  const accentHex = p.accents[accent];
  return {
    darkMode: flavor !== 'latte',
    background: p.mantle,
    primaryColor: p.surface0,
    primaryTextColor: p.accents.rosewater,
    primaryBorderColor: accentHex,
    secondaryColor: p.surface1,
    secondaryTextColor: p.text,
    secondaryBorderColor: p.accents.green,
    tertiaryColor: p.base,
    tertiaryTextColor: p.text,
    tertiaryBorderColor: p.accents.mauve,
    lineColor: p.subtext1,
    textColor: p.text,
    mainBkg: p.surface0,
    nodeBorder: accentHex,
    clusterBkg: p.base,
    clusterBorder: p.surface2,
    edgeLabelBackground: p.mantle,
    fontSize: '15px',
    themeCSS: `
      .nodeLabel, .edgeLabel, .label, text { font-size: 15px !important; }
      .edgeLabel rect { fill: ${p.mantle} !important; opacity: .96 !important; }
      .flowchart-link { stroke-width: 2px !important; }
      .cluster rect { rx: 10px; ry: 10px; }
    `,
  };
}

export function buildThemeVars(
  flavor: CatppuccinFlavor = DEFAULT_THEME_FLAVOR,
  accent: CatppuccinAccent = DEFAULT_THEME_ACCENT
): Record<string, string> {
  const p = PALETTES[flavor];
  const accentHex = p.accents[accent];
  const accentRgb = hexToRgb(accentHex);
  const redRgb = hexToRgb(p.accents.red);
  const greenRgb = hexToRgb(p.accents.green);
  const isLight = flavor === 'latte';

  return {
    '--ctp-base': p.base,
    '--ctp-mantle': p.mantle,
    '--ctp-crust': p.crust,
    '--ctp-text': p.text,
    '--ctp-subtext1': p.subtext1,
    '--ctp-subtext0': p.subtext0,
    '--ctp-overlay0': p.overlay0,
    '--ctp-surface2': p.surface2,
    '--ctp-surface1': p.surface1,
    '--ctp-surface0': p.surface0,
    '--ctp-accent': accentHex,
    '--ctp-accent-rgb': accentRgb,
    '--ctp-red': p.accents.red,
    '--ctp-green': p.accents.green,
    '--ctp-yellow': p.accents.yellow,
    '--zhihu-ai-azure': accentHex,
    '--zhihu-ai-azure-deep': accentHex,
    '--zhihu-ai-azure-soft': `rgba(${accentRgb}, ${isLight ? '0.12' : '0.16'})`,
    '--zhihu-ai-ink': p.text,
    '--zhihu-ai-ink-soft': p.subtext1,
    '--zhihu-ai-muted': p.overlay0,
    '--zhihu-ai-paper': p.base,
    '--zhihu-ai-paper-raised': p.mantle,
    '--zhihu-ai-line': p.surface0,
    '--zhihu-ai-line-strong': p.surface1,
    '--zhihu-ai-danger': p.accents.red,
    '--zhihu-ai-danger-soft': `rgba(${redRgb}, 0.14)`,
    '--zhihu-ai-ok': p.accents.green,
    '--zhihu-ai-ok-soft': `rgba(${greenRgb}, 0.14)`,
    '--zhihu-ai-warn': p.accents.yellow,
    '--zhihu-ai-shadow': isLight
      ? '0 16px 40px rgba(76, 79, 105, 0.12), 0 2px 8px rgba(76, 79, 105, 0.06)'
      : '0 20px 50px rgba(17, 17, 27, 0.45), 0 2px 8px rgba(17, 17, 27, 0.35)',
    '--zhihu-ai-primary-color': accentHex,
    '--zhihu-ai-primary-hover-color': accentHex,
    '--zhihu-ai-primary-active-color': accentHex,
    '--zhihu-ai-secondary-color': accentHex,
    '--zhihu-ai-primary-shadow-color': `rgba(${accentRgb}, 0.28)`,
    '--zhihu-ai-primary-shadow-hover-color': `rgba(${accentRgb}, 0.38)`,
    '--zhihu-ai-primary-soft-bg': `rgba(${accentRgb}, 0.14)`,
    '--zhihu-ai-primary-soft-bg-2': `rgba(${accentRgb}, 0.08)`,
    '--zhihu-ai-primary-border-color': `rgba(${accentRgb}, 0.4)`,
    '--zhihu-ai-primary-gradient': `linear-gradient(160deg, ${accentHex}, ${accentHex})`,
    '--zhihu-ai-primary-gradient-soft': `linear-gradient(160deg, rgba(${accentRgb}, 0.16), rgba(${accentRgb}, 0.05))`,
  };
}

export interface ThemeState {
  flavor: CatppuccinFlavor;
  accent: CatppuccinAccent;
}

const listeners = new Set<(state: ThemeState) => void>();
let current: ThemeState = {
  flavor: DEFAULT_THEME_FLAVOR,
  accent: DEFAULT_THEME_ACCENT,
};

export function getTheme(): ThemeState {
  return current;
}

export function subscribeTheme(listener: (state: ThemeState) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function setTheme(flavor: CatppuccinFlavor, accent: CatppuccinAccent): void {
  current = { flavor, accent };
  for (const listener of listeners) {
    listener(current);
  }
}

const DARKREADER_ATTRS = [
  'data-darkreader-inline-bgcolor',
  'data-darkreader-inline-color',
  'data-darkreader-inline-border',
  'data-darkreader-inline-border-top',
  'data-darkreader-inline-border-right',
  'data-darkreader-inline-border-bottom',
  'data-darkreader-inline-border-left',
  'data-darkreader-inline-boxshadow',
  'data-darkreader-inline-bgimage',
  'data-darkreader-inline-stroke',
  'data-darkreader-inline-fill',
  'data-darkreader-inline-outline',
];

function stripDarkReaderAttrs(el: Element): void {
  el.setAttribute('data-darkreader-ignore', '');
  for (const attr of DARKREADER_ATTRS) {
    el.removeAttribute(attr);
  }
  if (el instanceof HTMLElement) {
    const drop: string[] = [];
    for (let i = 0; i < el.style.length; i++) {
      const name = el.style.item(i);
      if (name.startsWith('--darkreader')) {
        drop.push(name);
      }
    }
    drop.forEach((name) => {
      el.style.removeProperty(name);
    });
  }
}

const observed = new WeakSet<HTMLElement>();

export function applyThemeToElement(
  el: HTMLElement,
  flavor: CatppuccinFlavor = current.flavor,
  accent: CatppuccinAccent = current.accent
): void {
  el.classList.add('zhihu-ai-theme-root', 'zhihu-ai-darkreader-lock');
  el.setAttribute('data-catppuccin', flavor);
  el.setAttribute('data-accent', accent);
  el.setAttribute('data-darkreader-ignore', '');
  el.style.setProperty('color-scheme', flavor === 'latte' ? 'only light' : 'only dark');

  const vars = buildThemeVars(flavor, accent);
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }

  stripDarkReaderAttrs(el);
  el.querySelectorAll('*').forEach((node) => {
    stripDarkReaderAttrs(node);
  });

  if (!observed.has(el)) {
    observed.add(el);
    const mo = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof Element) {
          const name = record.attributeName ?? '';
          if (name.startsWith('data-darkreader-inline') || name.startsWith('data-darkreader-scheme')) {
            stripDarkReaderAttrs(record.target);
          }
        }
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            stripDarkReaderAttrs(node);
            node.querySelectorAll?.('*').forEach((child) => {
              stripDarkReaderAttrs(child);
            });
          }
        });
      }
    });
    mo.observe(el, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [...DARKREADER_ATTRS, 'style'],
    });
  }
}

export function applyThemeToSelector(selector: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    applyThemeToElement(el, current.flavor, current.accent);
  });
}

export function bindThemeRoot(el: HTMLElement): () => void {
  applyThemeToElement(el, current.flavor, current.accent);
  return subscribeTheme((state) => {
    applyThemeToElement(el, state.flavor, state.accent);
  });
}

export async function loadThemeFromConfig(configManager: {
  get: (key: 'UI_THEME_FLAVOR' | 'UI_THEME_ACCENT', fallback: string) => Promise<string | undefined>;
}): Promise<ThemeState> {
  const storedFlavor = (await configManager.get('UI_THEME_FLAVOR', DEFAULT_THEME_FLAVOR)) ?? DEFAULT_THEME_FLAVOR;
  const storedAccent = (await configManager.get('UI_THEME_ACCENT', DEFAULT_THEME_ACCENT)) ?? DEFAULT_THEME_ACCENT;
  const flavor = isCatppuccinFlavor(storedFlavor) ? storedFlavor : DEFAULT_THEME_FLAVOR;
  const accent = isCatppuccinAccent(storedAccent) ? storedAccent : DEFAULT_THEME_ACCENT;
  setTheme(flavor, accent);
  applyThemeToSelector('.zhihu-ai-theme-root');
  return { flavor, accent };
}
