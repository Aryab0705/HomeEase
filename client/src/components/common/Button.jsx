import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const Button = ({
  children, onClick, type = 'button', variant = 'primary',
  size = '', disabled = false, loading = false, icon, className = '', fullWidth = false,
}) => {
  const variantClass = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    outline:   'btn-outline',
    danger:    'btn-danger',
    success:   'btn-success',
  }[variant] || 'btn-primary';

  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      style={fullWidth ? { width: '100%' } : {}}
      whileTap={!disabled && !loading ? { scale: 0.97 } : {}}
    >
      {loading ? <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : icon}
      {children}
    </motion.button>
  );
};

export default Button;
