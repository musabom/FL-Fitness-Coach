// FLComponents.jsx — FutureLine Fitness app UI kit
// Pixel-faithful recreations of the real app components (dark navy + teal).

const FL = {
  primary: '#2DD4BF',
  primaryGlow: 'rgba(45,212,191,0.15)',
  primaryFg: '#081025',
  bg: '#0B1630',
  bgEl: '#0F1F3D',
  bgInput: '#0F1F3D',
  bgNav: '#111111',
  fg: '#F0F6FF',
  fgMuted: '#7B95B8',
  fgSubtle: 'rgba(240,246,255,0.55)',
  border: '#1B3260',
  borderSoft: 'rgba(27,50,96,0.5)',
  hairline: 'rgba(240,246,255,0.05)',
  destructive: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
  info: '#3B82F6',
  protein: '#3B82F6',
  carbs: '#F59E0B',
  fat: '#EAB308',
  burn: '#F97316',
};

// ─── Lucide wrapper ──────────────────────────────────────────────
function Ico({ name, size = 20, color = 'currentColor', stroke = 2, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons({ nameAttr: 'data-lucide', icons: window.lucide.icons });
  }, [name]);
  return <i data-lucide={name} style={{ width: size, height: size, color, display: 'inline-flex', ...style }} />;
}

// ─── Buttons ─────────────────────────────────────────────────────
function FLButton({ variant = 'primary', size = 'md', icon, children, onClick, style }) {
  const sizes = {
    sm: { h: 40, px: 16, fs: 13, radius: 12 },
    md: { h: 48, px: 24, fs: 15, radius: 16 },
    lg: { h: 56, px: 32, fs: 18, radius: 16 },
  };
  const s = sizes[size];
  const variants = {
    primary: { bg: FL.primary, fg: FL.primaryFg, border: 'transparent', glow: '0 0 20px rgba(45,212,191,0.25)' },
    outline: { bg: FL.bgEl, fg: FL.fg, border: FL.border, glow: 'none' },
    ghost:   { bg: 'transparent', fg: FL.fg, border: 'transparent', glow: 'none' },
    destructive: { bg: FL.destructive, fg: '#fff', border: 'transparent', glow: 'none' },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} style={{
      height: s.h, padding: `0 ${s.px}px`, borderRadius: s.radius,
      background: v.bg, color: v.fg, border: `1px solid ${v.border}`,
      fontFamily: 'inherit', fontSize: s.fs, fontWeight: 500,
      display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
      boxShadow: v.glow, transition: 'transform 150ms ease, filter 150ms ease',
      ...style,
    }}
    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
      {icon && <Ico name={icon} size={16} />}
      {children}
    </button>
  );
}

// ─── Input ───────────────────────────────────────────────────────
function FLInput({ label, type = 'text', placeholder, value, onChange, defaultValue, trailing, focused, error }) {
  const [isFocus, setFocus] = React.useState(!!focused);
  const inputProps = value !== undefined
    ? { value, onChange: onChange || (() => {}) }
    : { defaultValue };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 500, color: FL.fgMuted, paddingLeft: 4 }}>{label}</label>}
      <div style={{
        height: 56, padding: '0 16px', background: FL.bgInput,
        borderRadius: 16,
        border: `1px solid ${error ? FL.destructive : isFocus ? FL.primary : FL.border}`,
        boxShadow: isFocus ? `0 0 0 3px ${FL.primaryGlow}` : 'none',
        display: 'flex', alignItems: 'center', gap: 8,
        transition: 'all 200ms ease',
      }}>
        <input type={type} placeholder={placeholder} {...inputProps}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: FL.fg, fontFamily: 'inherit', fontSize: 15,
          }} />
        {trailing}
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────
function FLCard({ children, style, padding = 20, glow = false, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: FL.bgEl, borderRadius: 24, padding,
      boxShadow: glow
        ? '0 10px 30px -12px rgba(0,0,0,0.4), 0 0 30px rgba(45,212,191,0.1)'
        : '0 10px 30px -12px rgba(0,0,0,0.4)',
      border: `1px solid ${FL.hairline}`,
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>{children}</div>
  );
}

// ─── Overline + section header ───────────────────────────────────
function FLOverline({ children, color = FL.fgMuted }) {
  return <div style={{
    fontSize: 10, fontWeight: 600, letterSpacing: '0.15em',
    textTransform: 'uppercase', color,
  }}>{children}</div>;
}

// ─── Macro Bar ───────────────────────────────────────────────────
function MacroBar({ label, consumed, planned, unit = 'g', color }) {
  const pct = planned > 0 ? Math.min(100, (consumed / planned) * 100) : 0;
  const net = consumed - planned;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: FL.fg }}>
          {Math.round(consumed)}<span style={{ fontSize: 11, color: FL.fgMuted, margin: '0 2px' }}>/</span>
          {Math.round(planned)}<span style={{ fontSize: 11, color: FL.fgMuted, marginLeft: 2 }}>{unit}</span>
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: net >= 0 ? color : FL.fgMuted }}>
          {net >= 0 ? '+' : ''}{Math.round(net)}{unit}
        </span>
      </div>
      <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, borderRadius: 999,
          transition: 'width 500ms ease',
        }} />
      </div>
      <div style={{ fontSize: 11, color: FL.fgMuted, textAlign: 'right' }}>{label}</div>
    </div>
  );
}

// ─── Mini Stat Pill (burned / deficit / planned) ────────────────
function MiniStatPill({ label, value, unit, color = FL.fg }) {
  return (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,0.03)', border: `1px solid ${FL.hairline}`,
      borderRadius: 16, padding: '12px 10px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 2,
    }}>
      <FLOverline>{label}</FLOverline>
      <span style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{Math.round(value)}</span>
      <span style={{ fontSize: 10, color: FL.fgMuted }}>{unit}</span>
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────
function FLBadge({ children, variant = 'default', style }) {
  const variants = {
    default:     { bg: FL.primary, fg: FL.primaryFg },
    secondary:   { bg: FL.border, fg: FL.fg },
    destructive: { bg: FL.destructive, fg: '#fff' },
    outline:     { bg: 'transparent', fg: FL.fg, border: `1px solid ${FL.border}` },
    tinted:      { bg: 'rgba(45,212,191,0.1)', fg: FL.primary, border: `1px solid rgba(45,212,191,0.2)` },
  };
  const v = variants[variant];
  return <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    background: v.bg, color: v.fg, border: v.border,
    ...style,
  }}>{children}</span>;
}

// ─── Bottom Nav ──────────────────────────────────────────────────
function FLBottomNav({ active, onNav }) {
  const items = [
    { key: 'dashboard', label: 'Home', icon: 'layout-dashboard' },
    { key: 'meals',     label: 'Meals', icon: 'calendar-days' },
    { key: 'workouts',  label: 'Workouts', icon: 'dumbbell' },
    { key: 'progress',  label: 'Progress', icon: 'trending-up' },
    { key: 'shop',      label: 'Shop', icon: 'shopping-cart' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(17,17,17,0.95)', backdropFilter: 'blur(18px)',
      borderTop: `1px solid ${FL.borderSoft}`,
      display: 'flex', zIndex: 50,
    }}>
      {items.map(it => {
        const isActive = active === it.key;
        return (
          <button key={it.key} onClick={() => onNav?.(it.key)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 4px 12px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4, color: isActive ? FL.primary : FL.fgMuted,
            transition: 'color 150ms ease',
          }}>
            <Ico name={it.icon} size={20} />
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.02em' }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── App Header ──────────────────────────────────────────────────
function FLAppHeader({ title, subtitle, notifCount = 0, onSettings }) {
  return (
    <div style={{ padding: '56px 20px 16px', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: -20, left: -30, right: -30, height: 200,
        background: 'radial-gradient(ellipse at top, rgba(45,212,191,0.18), transparent 60%)',
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
        <div>
          <FLOverline>{subtitle}</FLOverline>
          <h1 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: FL.fg }}>{title}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            width: 40, height: 40, borderRadius: 12, background: FL.bgEl,
            border: `1px solid ${FL.border}`, color: FL.fg, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            <Ico name="bell" size={18} />
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16,
                borderRadius: 999, background: FL.destructive, color: '#fff',
                fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '0 4px',
              }}>{notifCount}</span>
            )}
          </button>
          <button onClick={onSettings} style={{
            width: 40, height: 40, borderRadius: 12, background: FL.bgEl,
            border: `1px solid ${FL.border}`, color: FL.fg, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ico name="settings" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Segmented tabs ──────────────────────────────────────────────
function FLTabs({ items, active, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', gap: 4, padding: 4,
      background: FL.bgEl, borderRadius: 16, border: `1px solid ${FL.hairline}`,
    }}>
      {items.map(it => {
        const isActive = active === it.key;
        return (
          <button key={it.key} onClick={() => onChange(it.key)} style={{
            padding: '8px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: isActive ? FL.primary : 'transparent',
            color: isActive ? FL.primaryFg : FL.fgMuted,
            fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
            transition: 'all 200ms ease',
          }}>{it.label}</button>
        );
      })}
    </div>
  );
}

// ─── Coach Message Card (collapsible) ────────────────────────────
function FLCoachCard({ unread = 0, onOpen }) {
  const [open, setOpen] = React.useState(false);
  const highlight = unread > 0 && !open;
  return (
    <div style={{
      borderRadius: 24, overflow: 'hidden',
      background: highlight ? 'rgba(45,212,191,0.05)' : FL.bgEl,
      border: `1px solid ${highlight ? 'rgba(45,212,191,0.4)' : FL.hairline}`,
      transition: 'all 200ms ease',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
        color: FL.fg, textAlign: 'left', fontFamily: 'inherit',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12, background: 'rgba(45,212,191,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          color: FL.primary,
        }}>
          <Ico name="message-circle" size={18} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18,
              borderRadius: 999, background: FL.destructive, color: '#fff',
              fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: '0 4px',
            }}>{unread}</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: highlight ? FL.primary : FL.fg }}>Coach Messages</div>
          <div style={{ fontSize: 12, color: highlight ? 'rgba(45,212,191,0.8)' : FL.fgMuted, marginTop: 2 }}>
            {unread > 0 ? `${unread} new message${unread > 1 ? 's' : ''} from your coach` : 'Chat with your coach'}
          </div>
        </div>
        <Ico name={open ? 'chevron-down' : 'chevron-right'} size={16} color={highlight ? FL.primary : FL.fgMuted} />
      </button>
      {open && (
        <div style={{
          borderTop: `1px solid ${FL.hairline}`, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 240, overflow: 'auto',
        }}>
          <ChatBubble from="coach" text="Great job hitting your protein target yesterday! Keep it up 💪" time="09:12" />
          <ChatBubble from="me"    text="Thanks! Feeling stronger this week." time="09:14" />
          <ChatBubble from="coach" text="Let's add one more leg session on Saturday." time="09:15" />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input placeholder="Reply to your coach..." style={{
              flex: 1, height: 40, padding: '0 14px', borderRadius: 12,
              background: FL.bg, border: `1px solid ${FL.border}`, color: FL.fg,
              fontFamily: 'inherit', fontSize: 13, outline: 'none',
            }} />
            <button style={{
              width: 40, height: 40, borderRadius: 12, border: 'none',
              background: FL.primary, color: FL.primaryFg, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Ico name="send" size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatBubble({ from, text, time }) {
  const isMe = from === 'me';
  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '75%', padding: '9px 12px', borderRadius: 16,
        borderBottomRightRadius: isMe ? 4 : 16,
        borderBottomLeftRadius: isMe ? 16 : 4,
        background: isMe ? FL.primary : FL.bg,
        color: isMe ? FL.primaryFg : FL.fg,
        fontSize: 13, lineHeight: 1.4,
      }}>
        <div>{text}</div>
        <div style={{
          fontSize: 9, opacity: 0.6, marginTop: 2, textAlign: 'right',
        }}>{time}</div>
      </div>
    </div>
  );
}

// ─── Option Card (onboarding) ────────────────────────────────────
function FLOptionCard({ title, description, selected, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
      padding: 18, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 14,
      background: selected ? 'rgba(45,212,191,0.08)' : FL.bgEl,
      border: `1px solid ${selected ? FL.primary : FL.border}`,
      boxShadow: selected ? `0 0 0 3px ${FL.primaryGlow}` : 'none',
      transition: 'all 200ms ease',
    }}>
      {icon && (
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: selected ? FL.primary : FL.bg,
          color: selected ? FL.primaryFg : FL.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Ico name={icon} size={20} /></div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: FL.fg }}>{title}</div>
        <div style={{ fontSize: 12, color: FL.fgMuted, marginTop: 2 }}>{description}</div>
      </div>
      <div style={{
        width: 22, height: 22, borderRadius: 999,
        background: selected ? FL.primary : 'transparent',
        border: selected ? 'none' : `1px solid rgba(123,149,184,0.3)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: FL.primaryFg, fontWeight: 700, fontSize: 11,
      }}>{selected ? '✓' : ''}</div>
    </button>
  );
}

// ─── Exercise / meal row ─────────────────────────────────────────
function FLListRow({ image, title, subtitle, trailing, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: 14,
      background: FL.bgEl, borderRadius: 20, cursor: onClick ? 'pointer' : 'default',
      border: `1px solid ${FL.hairline}`,
    }}>
      {image && (
        <div style={{
          width: 52, height: 52, borderRadius: 14, overflow: 'hidden', flexShrink: 0,
          background: FL.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {typeof image === 'string' ? <img src={image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : image}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: FL.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 12, color: FL.fgMuted, marginTop: 2 }}>{subtitle}</div>
      </div>
      {trailing}
    </div>
  );
}

// ─── Banner / alert ──────────────────────────────────────────────
function FLBanner({ variant = 'info', icon, title, message }) {
  const variants = {
    destructive: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', fg: FL.destructive },
    warning:     { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', fg: FL.warning },
    primary:     { bg: 'rgba(45,212,191,0.08)', border: 'rgba(45,212,191,0.2)', fg: FL.primary },
    info:        { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', fg: FL.info },
  };
  const v = variants[variant];
  return (
    <div style={{
      padding: 14, borderRadius: 16, background: v.bg,
      border: `1px solid ${v.border}`, display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      {icon && <div style={{ color: v.fg, paddingTop: 2 }}><Ico name={icon} size={16} color={v.fg} /></div>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: v.fg }}>{title}</div>
        {message && <div style={{ fontSize: 12, color: FL.fgMuted, marginTop: 2 }}>{message}</div>}
      </div>
    </div>
  );
}

Object.assign(window, {
  FL, Ico,
  FLButton, FLInput, FLCard, FLOverline, FLBadge,
  MacroBar, MiniStatPill, FLBottomNav, FLAppHeader, FLTabs,
  FLCoachCard, FLOptionCard, FLListRow, FLBanner, ChatBubble,
});
