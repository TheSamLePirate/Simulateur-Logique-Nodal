import type { ReactNode } from "react";

type EmbeddedMarkdownDocumentProps = {
  markdown: string;
  title: string;
  subtitle: string;
};

type ListBlock = {
  type: "ul" | "ol";
  items: string[];
};

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "hr" }
  | ListBlock;

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  const paragraphBuffer: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    blocks.push({
      type: "paragraph",
      text: paragraphBuffer.join(" ").trim(),
    });
    paragraphBuffer.length = 0;
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph();
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: "code",
        language,
        text: codeLines.join("\n"),
      });
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    const unorderedMatch = trimmed.match(/^-\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const match = lines[index].trim().match(/^-\s+(.*)$/);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const match = lines[index].trim().match(/^\d+\.\s+(.*)$/);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    paragraphBuffer.push(trimmed);
    index += 1;
  }

  flushParagraph();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const regex = /\[.*?\]\(.*?\)|`[^`]+`|\*\*[^*]+\*\*/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);

    if (linkMatch) {
      parts.push(
        <a
          key={`${match.index}-${token}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-sky-300 underline decoration-sky-500/40 underline-offset-2 hover:text-sky-200"
        >
          {linkMatch[1]}
        </a>,
      );
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={`${match.index}-${token}`}
          className="rounded bg-slate-900/90 px-1.5 py-0.5 text-[0.92em] text-cyan-200"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(
        <strong
          key={`${match.index}-${token}`}
          className="font-semibold text-white"
        >
          {token.slice(2, -2)}
        </strong>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function EmbeddedMarkdownDocument({
  markdown,
  title,
  subtitle,
}: EmbeddedMarkdownDocumentProps) {
  const blocks = parseMarkdown(markdown);

  return (
    <div className="flex-1 overflow-hidden bg-slate-950">
      <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] px-8 py-6">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300/80">
          Built-In Guide
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          {subtitle}
        </p>
      </div>

      <div className="h-full overflow-y-auto px-8 py-8">
        <article className="mx-auto flex max-w-4xl flex-col gap-4 pb-24">
          {blocks.map((block, index) => {
            if (block.type === "heading") {
              if (block.level === 1) {
                return (
                  <h1
                    key={index}
                    className="text-3xl font-black tracking-tight text-white"
                  >
                    {block.text}
                  </h1>
                );
              }
              if (block.level === 2) {
                return (
                  <h2
                    key={index}
                    className="mt-6 text-xl font-bold tracking-tight text-sky-100"
                  >
                    {block.text}
                  </h2>
                );
              }
              return (
                <h3 key={index} className="mt-4 text-base font-bold text-slate-100">
                  {block.text}
                </h3>
              );
            }

            if (block.type === "paragraph") {
              return (
                <p key={index} className="leading-7 text-slate-300">
                  {renderInline(block.text)}
                </p>
              );
            }

            if (block.type === "code") {
              return (
                <div
                  key={index}
                  className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950/90"
                >
                  {block.language ? (
                    <div className="border-b border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {block.language}
                    </div>
                  ) : null}
                  <pre className="p-4 text-sm leading-6 text-slate-100">
                    <code>{block.text}</code>
                  </pre>
                </div>
              );
            }

            if (block.type === "hr") {
              return <div key={index} className="my-2 border-t border-slate-800" />;
            }

            const ListTag = block.type === "ol" ? "ol" : "ul";
            return (
              <ListTag
                key={index}
                className={`space-y-2 pl-6 leading-7 text-slate-300 ${
                  block.type === "ol" ? "list-decimal" : "list-disc"
                }`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ListTag>
            );
          })}
        </article>
      </div>
    </div>
  );
}
