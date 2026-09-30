// Vertical banknote bundle (3 notes). `size` is the rendered height in px.
function Logo({ size = 28, className = '' }) {
  const height = Math.round(size * 0.9)
  return (
    <svg
      width={Math.round((height * 50) / 71)}
      height={height}
      viewBox="-9 -3 50 71"
      fill="none"
      className={className}
      role="img"
      aria-label="Splitmate logo"
    >
    <defs>
    <linearGradient id="sm-gold" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#F3D67A" />
      <stop offset="0.55" stopColor="#D9A32E" />
      <stop offset="1" stopColor="#A9741A" />
    </linearGradient>
    <radialGradient id="sm-green" cx="16" cy="16" r="13" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#2F6B45" />
      <stop offset="1" stopColor="#1B4A2C" />
    </radialGradient>
    <linearGradient id="sm-paper" x1="0" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#E2EFD6" />
      <stop offset="1" stopColor="#C4DBB0" />
    </linearGradient>
  </defs>
    <g transform="rotate(-7 16 64)">
      <rect x="0.5" y="0.5" width="31" height="63" rx="3" fill="#C9DDB6" stroke="#1F5A34" strokeWidth="1" />
      <rect x="3" y="3" width="26" height="58" rx="1.8" stroke="#1F5A34" strokeWidth="0.35" />
      <circle cx="16" cy="32" r="12" stroke="#3F7A52" strokeWidth="0.3" strokeDasharray="0.5 0.7" />
    </g>
    <g transform="rotate(7 16 64)">
      <rect x="0.5" y="0.5" width="31" height="63" rx="3" fill="#D3E5C4" stroke="#1F5A34" strokeWidth="1" />
      <rect x="3" y="3" width="26" height="58" rx="1.8" stroke="#1F5A34" strokeWidth="0.35" />
      <circle cx="16" cy="32" r="12" stroke="#3F7A52" strokeWidth="0.3" strokeDasharray="0.5 0.7" />
    </g>
    <g>
      <rect x="0.5" y="0.5" width="31" height="63" rx="3" fill="url(#sm-paper)" stroke="#1F5A34" strokeWidth="1" />
      <rect x="3" y="3" width="26" height="58" rx="1.8" stroke="#1F5A34" strokeWidth="0.35" />
      <g stroke="#3F7A52" strokeWidth="0.3" strokeLinecap="round">
        <path d="M5.2 6Q3.9 8 5.2 10T5.2 14T5.2 18T5.2 22T5.2 26T5.2 30T5.2 34T5.2 38T5.2 42T5.2 46T5.2 50T5.2 54T5.2 58" />
        <path d="M26.8 6Q28.1 8 26.8 10T26.8 14T26.8 18T26.8 22T26.8 26T26.8 30T26.8 34T26.8 38T26.8 42T26.8 46T26.8 50T26.8 54T26.8 58" />
      </g>
      <g>
        <circle cx="16" cy="11" r="7" stroke="#3F7A52" strokeWidth="0.3" strokeDasharray="0.5 0.7" />
        <circle cx="16" cy="11" r="4.6" fill="#2C5F3D" />
        <circle cx="16" cy="11" r="3.6" stroke="#E0B23F" strokeWidth="0.5" />
        <circle cx="16" cy="53" r="7" stroke="#3F7A52" strokeWidth="0.3" strokeDasharray="0.5 0.7" />
        <circle cx="16" cy="53" r="4.6" fill="#2C5F3D" />
        <circle cx="16" cy="53" r="3.6" stroke="#E0B23F" strokeWidth="0.5" />
      </g>
      <g fill="#E0B23F" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" textAnchor="middle">
        <text x="16" y="12.6" fontSize="4.6">1</text>
        <text x="16" y="54.6" fontSize="4.6">1</text>
      </g>
      <g fill="#1F5A34" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" textAnchor="middle" fontSize="3.4">
        <text x="7.5" y="9">1</text>
        <text x="24.5" y="9">1</text>
        <text x="7.5" y="59">1</text>
        <text x="24.5" y="59">1</text>
      </g>
      <circle cx="16" cy="32" r="12" stroke="#3F7A52" strokeWidth="0.3" strokeDasharray="0.5 0.7" />
      <g transform="translate(16 32) scale(0.66) translate(-16 -16)">
        <circle cx="16" cy="16" r="15.5" fill="url(#sm-gold)" />
        <circle cx="16" cy="16" r="12.8" fill="url(#sm-green)" />
        <circle cx="16" cy="16" r="11.2" stroke="#E8C55A" strokeWidth="0.5" strokeDasharray="0.6 1.2" strokeLinecap="round" />
        <g stroke="url(#sm-gold)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.8 12.2C20.6 10.3 18.6 9.3 16 9.3C13.4 9.3 11.5 10.5 11.5 12.5C11.5 14.6 13.6 15.4 16 16C18.6 16.6 20.6 17.4 20.6 19.6C20.6 21.7 18.5 22.9 16 22.9C13.3 22.9 11.2 21.7 11.1 19.7" />
          <path d="M16 6.8V25.2" />
        </g>
      </g>
    </g>
    </svg>
  )
}

export default Logo
