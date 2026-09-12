import { Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setActiveRole } from '../redux/authSlice';
import { getAnyStoredSession, getRoleFromPath, getStoredSession, ROLE_DASHBOARDS } from '../utils/authStorage';

// Protect routes that require auth
export const ProtectedRoute = ({ children, roles }) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const session = roles?.length === 1 ? getStoredSession(roles[0]) : getAnyStoredSession();
  const { token, user } = session;

  useEffect(() => {
    if (user?.role) {
      dispatch(setActiveRole(user.role));
    }
  }, [dispatch, user?.role]);

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

// Redirect already-logged-in users away from auth pages
export const PublicRoute = ({ children }) => {
  const location = useLocation();
  const fromPath = location.state?.from?.pathname;

  if (fromPath) {
    const requestedRole = getRoleFromPath(fromPath);
    const session = getStoredSession(requestedRole);
    if (session.token && session.user) {
      return <Navigate to={fromPath || ROLE_DASHBOARDS[session.user.role] || '/dashboard'} replace />;
    }
  }

  return children;
};
