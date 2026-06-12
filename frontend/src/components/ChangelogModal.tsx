import { CHANGELOG } from '../changelog';

const TYPE_CONFIG = {
  feat:        { label: 'Fitur Baru',   color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  },
  fix:         { label: 'Perbaikan',    color: '#fca5a5', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)'  },
  improvement: { label: 'Peningkatan', color: '#a5b4fc', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)'  },
  refactor:    { label: 'Refactor',     color: '#fde68a', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.25)' },
};

interface Props {
  onClose: () => void;
}

export default function ChangelogModal({ onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#1e1f2e',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px',
        width: '100%', maxWidth: '620px',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-main)' }}>
              📋 Changelog
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Riwayat perubahan Personal Wealth Manager
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: 'var(--color-text-muted)', fontSize: '1.2rem',
            cursor: 'pointer', padding: '0.25rem', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {CHANGELOG.map((entry, i) => (
            <div key={entry.version}>
              {/* Version header */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span style={{
                  fontSize: '1rem', fontWeight: 700,
                  color: i === 0 ? 'var(--color-primary)' : 'var(--color-text-main)',
                }}>
                  v{entry.version}
                </span>
                {i === 0 && (
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.45rem',
                    borderRadius: '999px', background: 'rgba(99,102,241,0.15)',
                    color: 'var(--color-primary)', border: '1px solid rgba(99,102,241,0.3)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>Latest</span>
                )}
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                  {entry.date}
                </span>
              </div>

              {/* Highlights */}
              {entry.highlights && (
                <p style={{
                  margin: '0 0 0.75rem', fontSize: '0.83rem',
                  color: 'var(--color-text-muted)', lineHeight: 1.5,
                  paddingLeft: '0.75rem',
                  borderLeft: '2px solid rgba(99,102,241,0.35)',
                }}>
                  {entry.highlights}
                </p>
              )}

              {/* Changes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {entry.changes.map((c, j) => {
                  const cfg = TYPE_CONFIG[c.type];
                  return (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.83rem' }}>
                      <span style={{
                        flexShrink: 0, fontSize: '0.65rem', fontWeight: 700,
                        padding: '0.15rem 0.45rem', borderRadius: '4px',
                        background: cfg.bg, color: cfg.color,
                        border: `1px solid ${cfg.border}`,
                        marginTop: '0.1rem',
                      }}>
                        {cfg.label}
                      </span>
                      <span style={{ color: 'var(--color-text-main)', lineHeight: 1.5 }}>
                        {c.description}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Divider between versions */}
              {i < CHANGELOG.length - 1 && (
                <div style={{ marginTop: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
