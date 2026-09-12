import { motion } from 'framer-motion';

const shimmer = {
  animate: { backgroundPosition: ['200% 0', '-200% 0'] },
  transition: { duration: 1.5, repeat: Infinity, ease: 'linear' },
};

const base = {
  background: 'linear-gradient(90deg, var(--primary) 25%, var(--secondary) 50%, var(--primary) 75%)',
  backgroundSize: '200% 100%',
  borderRadius: 8,
};

export const SkeletonLine = ({ width = '100%', height = 16, style = {} }) => (
  <motion.div {...shimmer} style={{ ...base, width, height, ...style }} />
);

export const SkeletonAvatar = ({ size = 48 }) => (
  <motion.div {...shimmer} style={{ ...base, width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />
);

export const SkeletonCard = ({ rows = 3 }) => (
  <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
    <SkeletonLine height={20} width="60%" />
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonLine key={i} height={14} width={i === rows - 1 ? '40%' : '100%'} />
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonLine key={c} height={14} width={c === 0 ? '80%' : '60%'} />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonProviderCard = () => (
  <div className="card" style={{ padding: 20, display: 'flex', gap: 14 }}>
    <SkeletonAvatar size={52} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SkeletonLine height={18} width="50%" />
      <SkeletonLine height={13} width="70%" />
      <SkeletonLine height={13} width="35%" />
    </div>
  </div>
);

export default SkeletonCard;
