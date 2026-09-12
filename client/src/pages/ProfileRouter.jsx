import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Profile from './Profile';

const ProfileRouter = () => {
  const { user } = useSelector(state => state.auth);
  if (user?.role === 'provider') return <Navigate to="/provider/profile" replace />;
  return <Profile />;
};

export default ProfileRouter;
