export interface SearchableContent {
  id: string;
  title: string;
  content: string;
  type: 'heading' | 'paragraph' | 'list' | 'table';
  level?: number;
  parentSection?: string;
}

export interface SearchResult extends SearchableContent {
  score: number;
  matches: string[];
  context: string;
}

export class DocsIndexer {
  private static instance: DocsIndexer;
  private searchIndex: SearchableContent[] = [];

  static getInstance(): DocsIndexer {
    if (!DocsIndexer.instance) DocsIndexer.instance = new DocsIndexer();
    return DocsIndexer.instance;
  }

  extractContent(): SearchableContent[] {
    if (this.searchIndex.length > 0) return this.searchIndex;
    const content: SearchableContent[] = [];
    const headings = document.querySelectorAll('#docs-root h2[id], #docs-root h3[id]');

    headings.forEach((heading) => {
      const id = heading.id;
      const title = heading.textContent?.trim() || '';
      content.push({
        id, title, content: title, type: 'heading',
        level: parseInt(heading.tagName.replace('H', '')),
      });

      let next = heading.nextElementSibling;
      let sectionContent = '';
      while (next && !['H2', 'H3'].includes(next.tagName)) {
        const text = (next.cloneNode(true) as Element).textContent?.trim() || '';
        if (text) {
          sectionContent += text + ' ';
          if (next.tagName === 'P') {
            content.push({ id: `${id}-p-${content.length}`, title, content: text, type: 'paragraph', parentSection: id });
          } else if (next.tagName === 'UL' || next.tagName === 'OL') {
            content.push({ id: `${id}-list-${content.length}`, title, content: text, type: 'list', parentSection: id });
          } else if (next.tagName === 'TABLE') {
            content.push({ id: `${id}-table-${content.length}`, title, content: text, type: 'table', parentSection: id });
          }
        }
        next = next.nextElementSibling;
      }
      if (sectionContent.trim()) {
        content.push({ id: `${id}-full`, title, content: sectionContent.trim(), type: 'paragraph', parentSection: id });
      }
    });
    this.searchIndex = content;
    return content;
  }

  refresh() { this.searchIndex = []; this.extractContent(); }
}

export class SearchEngine {
  private indexer = DocsIndexer.getInstance();

  search(query: string, limit = 10): SearchResult[] {
    if (!query.trim()) return [];
    const content = this.indexer.extractContent();
    const terms = query.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    const results: SearchResult[] = [];

    content.forEach((item) => {
      const titleText = item.title.toLowerCase();
      const contentText = item.content.toLowerCase();
      let score = 0;
      terms.forEach((t) => {
        if (titleText.includes(t)) score += 10;
        const m = (contentText.match(new RegExp(t, 'g')) || []).length;
        score += m * 2;
        if (item.type === 'heading') score += 1;
      });
      if (score > 0) {
        const matches: string[] = [];
        terms.forEach((t) => {
          const found = (titleText + ' ' + contentText).match(new RegExp(`\\b\\w*${t}\\w*\\b`, 'gi')) || [];
          matches.push(...found);
        });
        let bestIdx = -1;
        terms.forEach((t) => {
          const i = contentText.indexOf(t);
          if (i !== -1 && (bestIdx === -1 || i < bestIdx)) bestIdx = i;
        });
        const start = Math.max(0, bestIdx - 75);
        const end = Math.min(item.content.length, start + 150);
        let context = item.content.substring(start, end);
        if (start > 0) context = '...' + context;
        if (end < item.content.length) context = context + '...';
        results.push({ ...item, score, matches: [...new Set(matches)], context });
      }
    });
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
