import { getInitials } from '../../utils/helpers';

const Avatar = ({ src, name = '', size = 'md', className = '' }) => {
  const sizeClass = { sm: 'avatar-sm', md: 'avatar-md', lg: 'avatar-lg', xl: 'avatar-xl', '2xl': 'avatar-2xl' }[size] || 'avatar-md';

  if (src) {
    return <img src={src} alt={name} className={`avatar ${sizeClass} ${className}`} />;
  }
  return (
    <div className={`avatar ${sizeClass} ${className}`}>
      {getInitials(name) || '?'}
    </div>
  );
};

export default Avatar;
