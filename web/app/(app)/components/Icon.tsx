interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export default function Icon({ name, size = 18, color = 'currentColor' }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 512 512',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 32,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const paths: Record<string, React.ReactNode> = {
    pulse: <path d="M48 256h112l24-48 48 96 48-160 32 112h144" />,
    today: (
      <>
        <rect x="80" y="96" width="352" height="352" rx="48" />
        <line x1="80" y1="176" x2="432" y2="176" />
        <line x1="160" y1="64" x2="160" y2="112" />
        <line x1="352" y1="64" x2="352" y2="112" />
      </>
    ),
    calendar: (
      <>
        <rect x="80" y="96" width="352" height="352" rx="48" />
        <line x1="80" y1="176" x2="432" y2="176" />
        <line x1="160" y1="64" x2="160" y2="112" />
        <line x1="352" y1="64" x2="352" y2="112" />
        <circle cx="256" cy="280" r="10" fill={color} stroke="none" />
        <circle cx="176" cy="280" r="10" fill={color} stroke="none" />
        <circle cx="336" cy="280" r="10" fill={color} stroke="none" />
      </>
    ),
    list: (
      <>
        <line x1="160" y1="144" x2="448" y2="144" />
        <line x1="160" y1="256" x2="448" y2="256" />
        <line x1="160" y1="368" x2="448" y2="368" />
        <circle cx="80" cy="144" r="16" fill={color} stroke="none" />
        <circle cx="80" cy="256" r="16" fill={color} stroke="none" />
        <circle cx="80" cy="368" r="16" fill={color} stroke="none" />
      </>
    ),
    people: (
      <>
        <circle cx="180" cy="176" r="64" />
        <path d="M60 416c0-66 54-104 120-104s120 38 120 104" />
        <path d="M340 128a64 64 0 0152 104M380 312c54 8 92 44 92 104" />
      </>
    ),
    settings: (
      <>
        <circle cx="256" cy="256" r="56" />
        <path d="M256 80l16 44 46-18 22 42-36 32 36 32-22 42-46-18-16 44h-0l-16-44-46 18-22-42 36-32-36-32 22-42 46 18z" />
      </>
    ),
    'log-out': (
      <>
        <path d="M336 176l80 80-80 80M192 256h224" />
        <path d="M256 432H80a16 16 0 01-16-16V96a16 16 0 0116-16h176" />
      </>
    ),
    time: (
      <>
        <circle cx="256" cy="256" r="192" />
        <path d="M256 144v112l72 48" />
      </>
    ),
    'chevron-down': <path d="M128 192l128 128 128-128" />,
  };

  return <svg {...common}>{paths[name] ?? null}</svg>;
}
