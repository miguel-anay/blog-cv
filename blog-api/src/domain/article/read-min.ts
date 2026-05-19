import type { ArticleBlock, TextNode, ListItemNode } from './types.js';

function extractText(node: TextNode | ListItemNode | ArticleBlock): string {
  if ('text' in node && node.type === 'text') {
    return (node as TextNode).text;
  }
  if ('children' in node) {
    return (node.children as Array<TextNode | ListItemNode>)
      .map((child) => extractText(child))
      .join(' ');
  }
  return '';
}

export class ReadMin {
  static fromBlocks(blocks: ArticleBlock[]): number {
    const fullText = blocks.map((b) => extractText(b)).join(' ');
    const wordCount = fullText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    return Math.max(1, Math.ceil(wordCount / 200));
  }
}
