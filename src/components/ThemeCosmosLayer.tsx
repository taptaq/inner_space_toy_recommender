export type ThemeCosmosVariant =
  | "home"
  | "quiz"
  | "matching"
  | "results"
  | "library"
  | "knowledge-hub"
  | "knowledge-detail"
  | "profiles";

export function ThemeCosmosLayer({
  variant,
  className = "",
}: {
  variant: ThemeCosmosVariant;
  className?: string;
}) {
  return (
    <div
      className={[
        "theme-cosmos-layer",
        `theme-cosmos-layer-${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <div className="theme-cosmos-stars theme-cosmos-stars-a" />
      <div className="theme-cosmos-stars theme-cosmos-stars-b" />

      <div className="theme-cosmos-motif theme-cosmos-spiral">
        <span className="theme-cosmos-spiral-arm theme-cosmos-spiral-arm-a" />
        <span className="theme-cosmos-spiral-arm theme-cosmos-spiral-arm-b" />
        <span className="theme-cosmos-spiral-core" />
      </div>

      <div className="theme-cosmos-motif theme-cosmos-nebula">
        <span className="theme-cosmos-nebula-cloud theme-cosmos-nebula-cloud-a" />
        <span className="theme-cosmos-nebula-cloud theme-cosmos-nebula-cloud-b" />
        <span className="theme-cosmos-nebula-pillar" />
      </div>

      <div className="theme-cosmos-motif theme-cosmos-pulsar">
        <span className="theme-cosmos-pulsar-core" />
        <span className="theme-cosmos-pulsar-ring theme-cosmos-pulsar-ring-a" />
        <span className="theme-cosmos-pulsar-ring theme-cosmos-pulsar-ring-b" />
        <span className="theme-cosmos-pulsar-beam theme-cosmos-pulsar-beam-a" />
        <span className="theme-cosmos-pulsar-beam theme-cosmos-pulsar-beam-b" />
      </div>

      <div className="theme-cosmos-motif theme-cosmos-binary">
        <span className="theme-cosmos-binary-star theme-cosmos-binary-star-a" />
        <span className="theme-cosmos-binary-star theme-cosmos-binary-star-b" />
        <span className="theme-cosmos-binary-orbit theme-cosmos-binary-orbit-a" />
        <span className="theme-cosmos-binary-orbit theme-cosmos-binary-orbit-b" />
        <span className="theme-cosmos-binary-bridge" />
      </div>
    </div>
  );
}
