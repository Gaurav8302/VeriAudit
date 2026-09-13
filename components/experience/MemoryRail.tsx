export function MemoryRail({
  titles,
  crowded,
}: {
  titles: readonly string[];
  crowded: boolean;
}) {
  return (
    <aside className={crowded ? "memory crowded" : "memory"} aria-label="Organizational memory">
      <h2>{crowded ? "Memory" : "This engagement"}</h2>
      <ol>
        {titles.map((title, index) => (
          <li key={`${title}-${index}`}>{title}</li>
        ))}
      </ol>
    </aside>
  );
}
