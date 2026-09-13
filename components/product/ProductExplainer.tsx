export function ProductExplainer({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <details className="va-explain">
      <summary>{title}</summary>
      <p>{body}</p>
    </details>
  );
}
