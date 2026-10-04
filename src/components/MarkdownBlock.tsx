import ReactMarkdown from "react-markdown";

type Props = {
  content: string;
  className?: string;
};

/** Always Markdown-rendered. react-markdown does not execute raw HTML by default. */
export function MarkdownBlock({ content, className }: Props) {
  return (
    <div className={className ? `markdown-body ${className}` : "markdown-body"}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
