/**
 * The behavioural fingerprint, drawn.
 *
 * One axis per scored feature, and the radius is how far this submission sits
 * from the student's own baseline in cohort-spread units, divided by the
 * saturation point. A vertex touching the bold ring is a feature that on its
 * own is already enough to max the layer score.
 *
 * Two deliberate restraints:
 *
 * The radius is the magnitude of z, not z itself. A radar axis cannot run
 * negative without putting zero somewhere in the middle, and a chart where
 * "nothing unusual happened" draws a fat mid-size blob is a chart that
 * invents alarm. Direction is printed next to each axis label instead, where
 * it cannot be misread.
 *
 * The saturation point is worked out from the data rather than written in
 * here. The score is min(1, rms(z) / Z), so whenever the score has not
 * saturated, Z is exactly rms(z) / score. Copying the backend's constant into
 * this file would mean the chart silently stops matching the score the day
 * somebody retunes it.
 */
import type { FeatureDeviation } from "../api/types";

/* Readable names. Anything not listed falls back to the raw feature name, so
   adding a feature to the backend never blanks a label here. */
const SHORT: Record<string, string> = {
  blank_line_ratio: "blank lines",
  avg_line_length: "line length",
  max_block_depth: "nesting depth",
  comment_density: "comments",
};

/* Only used when the score has saturated and Z cannot be recovered from it.
   Kept equal to the backend's Z_SATURATION, and the chart says out loud when
   it has fallen back to this rather than measured it. */
const ASSUMED_SATURATION = 3;

const SIZE = 440;
const HEIGHT = 330;
const CX = SIZE / 2;
const CY = 158;
const R = 104;

function rootMeanSquare(values: number[]) {
  if (values.length === 0) return 0;
  const sum = values.reduce((total, v) => total + v * v, 0);
  return Math.sqrt(sum / values.length);
}

export function FingerprintRadar({
  features,
  score,
  floored = [],
}: {
  features: FeatureDeviation[];
  score: number | undefined;
  floored?: string[];
}) {
  // Two axes draw a line, not a shape. Below three there is nothing to see
  // that the table does not already say better.
  if (features.length < 3) return null;

  const zs = features.map((f) => f.zScore);
  const rms = rootMeanSquare(zs);

  // Recoverable only while the score is strictly inside its range: at 1 the
  // min() has thrown the information away, and at 0 there is nothing to
  // divide by.
  const derivable = typeof score === "number" && score > 0 && score < 1 && rms > 0;
  const saturation = derivable ? rms / (score as number) : ASSUMED_SATURATION;

  const ratios = features.map((f) => Math.abs(f.zScore) / saturation);

  // Let the shape run past the saturation ring rather than clipping it. A
  // clipped polygon turns "three times past the line" into "exactly at the
  // line", which is the one reading this chart must never produce.
  const reach = Math.max(1, ...ratios);

  const angleFor = (i: number) => (i / features.length) * Math.PI * 2 - Math.PI / 2;
  const pointAt = (i: number, radius: number) => {
    const a = angleFor(i);
    return [CX + Math.cos(a) * R * (radius / reach), CY + Math.sin(a) * R * (radius / reach)];
  };

  const polygon = features
    .map((_, i) => pointAt(i, ratios[i]).map((n) => n.toFixed(1)).join(","))
    .join(" ");

  const ringAt = (radius: number) =>
    features
      .map((_, i) => pointAt(i, radius).map((n) => n.toFixed(1)).join(","))
      .join(" ");

  return (
    <figure className="radar">
      <svg
        viewBox={`0 0 ${SIZE} ${HEIGHT}`}
        role="img"
        aria-label={`Behavioural fingerprint across ${features.length} features, root mean square z of ${rms.toFixed(2)}`}
      >
        {/* the half-way ring, unlabelled, purely to give the eye a scale */}
        <polygon className="radar-ring" points={ringAt(0.5)} />

        {/* saturation. Bold, because this is the only ring that means
            something: a vertex on it has maxed the layer by itself. */}
        <polygon className="radar-ring radar-sat" points={ringAt(1)} />

        {features.map((f, i) => {
          const [ex, ey] = pointAt(i, reach);
          const isFloored = floored.includes(f.feature);
          return (
            <line
              key={`spoke-${f.feature}`}
              className={isFloored ? "radar-spoke radar-floored" : "radar-spoke"}
              x1={CX}
              y1={CY}
              x2={ex}
              y2={ey}
            />
          );
        })}

        <polygon className="radar-shape" points={polygon} />

        {features.map((f, i) => {
          const [x, y] = pointAt(i, ratios[i]);
          return (
            <circle
              key={`dot-${f.feature}`}
              className={f.zScore >= 0 ? "radar-dot up" : "radar-dot down"}
              cx={x}
              cy={y}
              r={4}
            />
          );
        })}

        {features.map((f, i) => {
          const a = angleFor(i);
          const [lx, ly] = [CX + Math.cos(a) * (R + 22), CY + Math.sin(a) * (R + 22)];
          const cos = Math.cos(a);
          const anchor = cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle";
          const isFloored = floored.includes(f.feature);
          return (
            <g key={`label-${f.feature}`}>
              <text className="radar-label" x={lx} y={ly} textAnchor={anchor}>
                {SHORT[f.feature] ?? f.feature}
                {isFloored ? " *" : ""}
              </text>
              <text
                className={f.zScore >= 0 ? "radar-z up" : "radar-z down"}
                x={lx}
                y={ly + 13}
                textAnchor={anchor}
              >
                {f.zScore >= 0 ? "+" : "−"}
                {Math.abs(f.zScore).toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption>
        <p>
          Distance from this student's own usual, in units of how much students
          in this cohort differ from one another. A plus sign is above their
          usual, a minus sign below. The bold ring is where one feature alone
          saturates the layer.
        </p>
        <p className="radar-sums">
          Root mean square of the {features.length} z-scores ={" "}
          <span className="strong">{rms.toFixed(3)}</span>
          {". "}
          {derivable ? (
            <>
              {rms.toFixed(3)} ÷ {saturation.toFixed(2)} ={" "}
              <span className="strong">{(rms / saturation).toFixed(3)}</span>, the layer
              score above. The saturation point is read back from that score, not
              copied into this page.
            </>
          ) : (
            <>
              The layer score is {typeof score === "number" ? score.toFixed(3) : "not recorded"},
              so the saturation point cannot be recovered from it and the rings
              assume {ASSUMED_SATURATION}.
            </>
          )}
        </p>
        {floored.length > 0 ? (
          <p className="radar-warn">
            * {floored.join(", ")}: nothing in this cohort varied in this feature,
            so its z-score was divided by a floor value rather than by a measured
            spread. Read that axis as a weaker signal than the others.
          </p>
        ) : null}
        <p className="radar-warn">
          The area enclosed is not a quantity. It changes with the order of the
          axes, which is the backend's order and nothing more.
        </p>
      </figcaption>
    </figure>
  );
}
