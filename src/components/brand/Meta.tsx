import React from "react";

/** Archival metadata block: "SOURCE / VIDEO" rows in mono. */
export default function Meta({ rows, className = "" }: { rows: [string, string][]; className?: string }) {
  return (
    <dl className={`meta grid grid-cols-[auto_1fr] gap-x-3 ${className}`}>
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="opacity-60">{k} /</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
