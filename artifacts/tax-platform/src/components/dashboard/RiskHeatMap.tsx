import React from "react";

interface Risk {
  id: string;
  severity?: string | null;
  category?: string | null;
  status?: string | null;
}

const LIKELIHOOD = ["Rare", "Possible", "Frequent"];
const IMPACT = ["Minor", "Moderate", "Severe"];

export default function RiskHeatmap({ risks }: { risks: Risk[] }) {
  const getLikelihood = (category?: string | null) => {
    switch (category) {
      case "VAT":
      case "PAYE":
      case "Withholding Tax":
        return 2;
      case "Revenue":
      case "Expense":
        return 1;
      default:
        return 0;
    }
  };

  const getImpact = (severity?: string | null) => {
    if (severity === "high") return 2;
    if (severity === "medium") return 1;
    return 0;
  };

  const grid = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  risks.forEach((r) => {
    if (r.status === "resolved") return;

    const li = getLikelihood(r.category);
    const im = getImpact(r.severity);

    grid[im][li]++;
  });

  const max = Math.max(...grid.flat(), 1);

  const getColor = (count: number) => {
    if (count === 0) return "bg-gray-50 text-gray-400";

    const intensity = count / max;

    if (intensity > 0.7) return "bg-red-200 text-red-800";
    if (intensity > 0.4) return "bg-red-100 text-red-700";

    return "bg-rose-50 text-rose-600";
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 text-xs mb-2">
        <div></div>
        {LIKELIHOOD.map((l) => (
          <div
            key={l}
            className="text-center text-muted-foreground font-medium"
          >
            {l}
          </div>
        ))}

        {[2, 1, 0].map((im) => (
          <React.Fragment key={im}>
            <div className="flex items-center justify-end pr-2 text-muted-foreground">
              {IMPACT[im]}
            </div>

            {[0, 1, 2].map((li) => {
              const count = grid[im][li];

              return (
                <div
                  key={li}
                  className={`h-16 rounded-lg flex flex-col items-center justify-center border ${getColor(count)}`}
                >
                  <span className="text-lg font-semibold">{count}</span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-2 text-center">
        Likelihood → &nbsp;&nbsp;&nbsp; Impact ↑
      </p>
    </div>
  );
}
