import { STATUS_LABELS } from '../../utils/helpers';

const StatusBadge = ({ status }) => {
  if (!status) return null;
  return (
    <span className={`badge status-${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
};

export default StatusBadge;
