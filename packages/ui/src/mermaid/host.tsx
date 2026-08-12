import { render } from 'preact';
import { MermaidCard } from './MermaidCard';
import type { MermaidHostSpec } from './document';

export interface MermaidHostOptions {
  onRepair?: (source: string, error: string) => Promise<string>;
}

export function mountMermaidHosts(
  root: HTMLElement,
  hosts: MermaidHostSpec[],
  options: MermaidHostOptions = {}
): () => void {
  const sourceById = new Map(hosts.map((item) => [item.id, item.source]));
  const mounted = new WeakSet<Element>();
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-zhihu-ai-mermaid]'));

  const renderHost = (node: HTMLElement) => {
    if (mounted.has(node)) {
      return;
    }
    const id = node.dataset.zhihuAiMermaid;
    const source = id ? sourceById.get(id) : undefined;
    if (!source) {
      return;
    }
    mounted.add(node);
    const index = hosts.findIndex((item) => item.id === id);
    render(
      <MermaidCard
        source={source}
        title={index >= 0 ? `图 ${index + 1}` : '流程图'}
        onRepair={options.onRepair}
      />,
      node
    );
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          renderHost(entry.target);
          observer.unobserve(entry.target);
        }
      }
    },
    { root: null, threshold: 0.05, rootMargin: '80px' }
  );

  nodes.forEach((node) => {
    observer.observe(node);
  });

  return () => {
    observer.disconnect();
    nodes.forEach((node) => {
      render(null, node);
    });
  };
}
