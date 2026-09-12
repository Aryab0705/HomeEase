import { forwardRef } from 'react';

const Input = forwardRef(({ label, error, icon, hint, ...props }, ref) => (
  <div className="form-group">
    {label && <label className="label">{label}</label>}
    <div style={{ position: 'relative' }}>
      {icon && (
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', pointerEvents: 'none' }}>
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={`input ${error ? 'input-error' : ''}`}
        style={icon ? { paddingLeft: 40 } : {}}
        {...props}
      />
    </div>
    {hint  && !error && <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>{hint}</p>}
    {error && <p className="error-text">{error}</p>}
  </div>
));

Input.displayName = 'Input';
export default Input;
