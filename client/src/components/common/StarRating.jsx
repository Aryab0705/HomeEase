import { useRef, useState } from 'react';
import { Star } from 'lucide-react';

const FILL_COLOR = '#f59e0b';
const EMPTY_STROKE = '#cbd5e1';

/**
 * StarRating
 *
 * Two modes:
 *
 *  • Display (default) — renders a read-only rating. Accepts fractional values
 *    (e.g. a provider's 4.25 average) and rounds for display.
 *
 *  • Interactive (`interactive`) — traditional 1-5 picker:
 *      – Starts EMPTY. A value of 0/undefined renders five outlined stars.
 *      – Clicking the Nth star selects exactly N stars.
 *      – Hovering previews N stars; moving the mouse away restores the
 *        selected value.
 *      – Keyboard accessible: each star is a focusable button, and arrow keys
 *        move between values.
 *
 * IMPORTANT: never default `value` to anything but 0 — pre-filling stars is
 * what made every review submit as 5/5.
 */
const StarRating = ({
  value,                 // preferred prop for interactive use
  rating = 0,            // legacy prop name, kept for existing display usages
  max = 5,
  size = 16,
  showNumber = false,
  interactive = false,
  onChange,
  label,                 // accessible group label, e.g. "Work Quality"
  gap = 4,
}) => {
  const [hovered, setHovered] = useState(0);
  const buttonsRef = useRef([]);

  const selected = Number(value ?? rating) || 0;

  // While hovering, preview the hovered count; otherwise show the selection.
  const active = interactive ? (hovered || selected) : selected;

  // Interactive ratings are always whole numbers; display ratings may be
  // fractional (a provider average), so round those for rendering.
  const filledCount = interactive ? active : Math.round(active);

  const commit = (next) => {
    if (!interactive || !onChange) return;
    // Clearing the hover preview is what makes the committed value visible.
    // Without this, a keyboard user keeps seeing the stale preview count set by
    // onFocus, because arrow keys never fire another focus/blur event.
    setHovered(0);
    onChange(next);
  };

  /** Moves the roving tabindex so arrow keys behave like a real radio group. */
  const focusStar = (n) => {
    const btn = buttonsRef.current[n - 1];
    if (btn) btn.focus();
  };

  const handleKeyDown = (e, index) => {
    if (!interactive) return;
    const current = selected || 0;
    let next = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      next = Math.min(max, current + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      next = Math.max(1, current - 1);
    } else if (e.key === 'Home') {
      next = 1;
    } else if (e.key === 'End') {
      next = max;
    } else if (e.key === ' ' || e.key === 'Enter') {
      next = index + 1;
    }

    if (next === null) return;
    e.preventDefault();
    commit(next);
    focusStar(next);
  };

  const stars = Array.from({ length: max }, (_, i) => {
    const isFilled = i < filledCount;

    const star = (
      <Star
        size={size}
        fill={isFilled ? FILL_COLOR : 'none'}
        // A hovered star is always inside `filledCount`, so an unfilled star is
        // never the one under the cursor. Tinting it amber made the whole row
        // read as five stars — exactly the misread this component must avoid.
        stroke={isFilled ? FILL_COLOR : EMPTY_STROKE}
        strokeWidth={2}
        style={{
          display: 'block',
          transition: 'fill 0.12s ease, stroke 0.12s ease, transform 0.12s ease',
          transform: interactive && hovered === i + 1 ? 'scale(1.15)' : 'scale(1)',
        }}
      />
    );

    if (!interactive) {
      return <span key={i} style={{ display: 'block', lineHeight: 0 }}>{star}</span>;
    }

    return (
      <button
        key={i}
        ref={(el) => { buttonsRef.current[i] = el; }}
        type="button"
        role="radio"
        aria-checked={selected === i + 1}
        aria-label={`${i + 1} of ${max} stars`}
        tabIndex={selected === i + 1 || (!selected && i === 0) ? 0 : -1}
        onClick={() => commit(i + 1)}
        onMouseEnter={() => setHovered(i + 1)}
        onFocus={() => setHovered(i + 1)}
        onBlur={() => setHovered(0)}
        onKeyDown={(e) => handleKeyDown(e, i)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          lineHeight: 0,
          cursor: 'pointer',
          borderRadius: 4,
          outlineOffset: 2,
        }}
      >
        {star}
      </button>
    );
  });

  return (
    <div
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={
        label
          ? `${label}: ${selected || 'not rated'}${selected ? ` out of ${max}` : ''}`
          : `${selected || 0} out of ${max} stars`
      }
      onMouseLeave={() => interactive && setHovered(0)}
      style={{ display: 'inline-flex', alignItems: 'center', gap }}
    >
      {stars}
      {showNumber && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-dark)',
            marginLeft: 4,
          }}
        >
          {Number(selected).toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default StarRating;
