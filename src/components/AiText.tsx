import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

/**
 * The assistant's answer, formatted — safely.
 *
 * Models write light Markdown (bold, lists, links). This turns the few forms
 * the assistant is told to use into React elements, never into HTML: there is
 * no innerHTML anywhere, so nothing the model writes can run as code. Links
 * become links only when they point inside TechMood (a path starting with /);
 * any other address stays plain text.
 */
export function AiText({ text }: { text: string }) {
  // Horizontal rules and tables are not part of the answer's style: dropped.
  const clean = text.replace(/\r\n/g, '\n').split('\n').filter((line) => !/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)).join('\n');
  const blocks = clean.split(/\n{2,}/).filter((block) => block.trim());
  return (
    <div className="ai-text">
      {blocks.map((block, index) => <Block key={index} block={block} />)}
    </div>
  );
}

function Block({ block }: { block: string }) {
  const lines = block.split('\n').filter((line) => line.trim());
  const bullet = /^\s*(?:[-*•])\s+/;
  const numbered = /^\s*\d+[.)]\s+/;

  if (lines.length && lines.every((line) => bullet.test(line))) {
    return <ul>{lines.map((line, i) => <li key={i}>{inline(line.replace(bullet, ''))}</li>)}</ul>;
  }
  if (lines.length && lines.every((line) => numbered.test(line))) {
    return <ol>{lines.map((line, i) => <li key={i}>{inline(line.replace(numbered, ''))}</li>)}</ol>;
  }

  // A paragraph that starts with a line or two and then lists.
  const firstList = lines.findIndex((line) => bullet.test(line) || numbered.test(line));
  if (firstList > 0 && lines.slice(firstList).every((line) => bullet.test(line) || numbered.test(line))) {
    return (
      <>
        <Block block={lines.slice(0, firstList).join('\n')} />
        <Block block={lines.slice(firstList).join('\n')} />
      </>
    );
  }

  return (
    <p>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {inline(line.replace(/^#{1,6}\s+/, ''), /^#{1,6}\s+/.test(line))}
        </Fragment>
      ))}
    </p>
  );
}

/** **bold**, `code`, and [text](/inside-link). Everything else is text. */
function inline(text: string, strong = false): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1] !== undefined) parts.push(<strong key={key++}>{inline(match[1])}</strong>);
    else if (match[2] !== undefined) parts.push(<code key={key++}>{match[2]}</code>);
    else {
      const [, , , label, href] = match;
      const inside = href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\');
      parts.push(inside ? <Link key={key++} href={href}>{label}</Link> : label);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return strong ? <strong>{parts}</strong> : parts;
}
