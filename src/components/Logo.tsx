type LogoProps = {
  className?: string;
  /** "navy" for light backgrounds, "reversed" (white ink) for the navy header */
  variant?: "navy" | "reversed";
};

export function Logo({ className, variant = "navy" }: LogoProps) {
  const ink = variant === "reversed" ? "#ffffff" : "#203863";
  const gold = "#FFC000";

  return (
    <svg
      viewBox="0 0 1000 340"
      className={className}
      role="img"
      aria-label="ACLiSS"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(30,20)">
        {/* A leg */}
        <path d="M 0 300 L 128 8 L 138 8 L 72 300 Z" fill={ink} />

        <clipPath id={`tubeClip-${variant}`}>
          <path d="M 128 8 L 128 235 A 52 52 0 0 0 232 235 L 232 8 Z" />
        </clipPath>

        {/* liquid */}
        <rect
          x="118"
          y="130"
          width="124"
          height="180"
          fill={gold}
          clipPath={`url(#tubeClip-${variant})`}
        />

        {/* bubbles in liquid */}
        <g clipPath={`url(#tubeClip-${variant})`}>
          <circle cx="160" cy="155" r="7" fill="#ffffff" />
          <circle cx="195" cy="180" r="5" fill="#ffffff" />
          <circle cx="170" cy="205" r="9" fill="#ffffff" />
          <circle cx="205" cy="150" r="4" fill="#ffffff" />
          <circle cx="150" cy="190" r="4" fill="#ffffff" />
        </g>

        {/* bubbles above liquid */}
        <g clipPath={`url(#tubeClip-${variant})`}>
          <circle cx="158" cy="80" r="6" fill={gold} />
          <circle cx="182" cy="98" r="4" fill={gold} />
          <circle cx="164" cy="112" r="3" fill={gold} />
        </g>

        {/* tube outline (open top, rounded bottom) */}
        <path
          d="M 128 8 L 128 235 A 52 52 0 0 0 232 235 L 232 8"
          fill="none"
          stroke={ink}
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* rim */}
        <rect x="128" y="42" width="104" height="11" fill={ink} />

        {/* wordmark */}
        <text
          x="270"
          y="270"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="800"
          fontSize="230"
          fill={ink}
          letterSpacing="-2"
        >
          CL
        </text>

        {/* custom "i" (no default dot; flag shape used instead) */}
        <rect x="530" y="195" width="24" height="75" rx="8" fill={ink} />
        <path
          d="M 554 150 L 628 150 L 628 160 L 588 170 L 628 180 L 628 190 L 554 190 Z"
          fill={gold}
        />

        <text
          x="655"
          y="270"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="800"
          fontSize="230"
          fill={ink}
          letterSpacing="-2"
        >
          SS
        </text>
      </g>
    </svg>
  );
}
