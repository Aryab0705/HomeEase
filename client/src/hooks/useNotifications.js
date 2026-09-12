import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setNotifications, setUnreadCount } from '../redux/notificationSlice';
import API from '../services/api';

/**
 * useNotifications — syncs notifications from server into Redux store.
 * Returns the current notifications and unread count from the store.
 */
export const useNotifications = () => {
  const dispatch = useDispatch();
  // Note: Redux store key is 'notification' (see store.js)
  const { notifications, unreadCount } = useSelector(s => s.notification);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await API.get('/notifications', { params: { limit: 20 } });
        const list  = data.data?.notifications ?? data.data ?? [];
        const count = data.data?.unreadCount ?? 0;
        dispatch(setNotifications(list));
        dispatch(setUnreadCount(count));
      } catch {
        // Silently fail — don't disrupt the UI for notification errors
      }
    };
    fetchNotifications();
  }, [dispatch]);

  return { notifications, unreadCount };
};
