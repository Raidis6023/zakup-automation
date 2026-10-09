
export default function WorkspaceDecoration() {
  return (
    <div className="home-decoration" aria-hidden="true">
      <svg viewBox="0 0 560 72" role="presentation">
        <defs>
          <linearGradient
            id="workspaceDecor1"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#078bf2" />
            <stop offset="100%" stopColor="#159bf0" />
          </linearGradient>

          <linearGradient
            id="workspaceDecor2"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#4cb2ef" />
            <stop offset="100%" stopColor="#82c9f3" />
          </linearGradient>

          <linearGradient
            id="workspaceDecor3"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#92d2f4" />
            <stop offset="100%" stopColor="#c7e7f8" />
          </linearGradient>

          <linearGradient
            id="workspaceDecor4"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#9cb8cc" />
            <stop offset="55%" stopColor="#8099ad" />
            <stop offset="100%" stopColor="#657b8d" />
          </linearGradient>
        </defs>

        <path
          d="
            M 15 53
            L 38 18
            Q 41 14 47 14
            L 102 14
            Q 107 14 104 18
            L 78 53
            Q 75 58 69 58
            L 19 58
            Q 12 58 15 53
            Z
          "
          fill="url(#workspaceDecor1)"
        />

        <path
          d="
            M 84 53
            L 108 18
            Q 111 14 117 14
            L 238 14
            Q 243 14 240 18
            L 214 53
            Q 211 58 205 58
            L 88 58
            Q 81 58 84 53
            Z
          "
          fill="url(#workspaceDecor2)"
        />

        <path
          d="
            M 220 53
            L 244 18
            Q 247 14 253 14
            L 410 14
            Q 415 14 412 18
            L 386 53
            Q 383 58 377 58
            L 224 58
            Q 217 58 220 53
            Z
          "
          fill="url(#workspaceDecor3)"
        />

        <path
          d="
            M 392 53
            L 416 18
            Q 419 14 425 14
            L 549 14
            Q 554 14 551 18
            L 525 53
            Q 522 58 516 58
            L 396 58
            Q 389 58 392 53
            Z
          "
          fill="url(#workspaceDecor4)"
        />
      </svg>
    </div>
  );
}
