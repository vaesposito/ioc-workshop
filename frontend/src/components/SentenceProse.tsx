export function splitProseSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((paragraph) =>
      paragraph
        .split(/(?<=[.!?])\s+(?=[A-Z“"'])/)
        .map((part) => part.trim())
        .filter(Boolean),
    );
}

export function SentenceProse({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const sentences = splitProseSentences(text);
  if (sentences.length === 0) {
    return null;
  }
  if (sentences.length === 1) {
    return <p className={className}>{sentences[0]}</p>;
  }
  return (
    <div className={className}>
      {sentences.map((sentence, index) => (
        <p key={`${index}-${sentence.slice(0, 32)}`} className={index === 0 ? undefined : "mt-3"}>
          {sentence}
        </p>
      ))}
    </div>
  );
}
