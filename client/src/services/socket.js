import { io } from 'socket.io-client';
import { getAnyStoredSession } from '../utils/authStorage';

let socket = null;

export const initSocket = (token) => {
  // Guard on existence, not on `connected`. A socket that is merely mid-
  // reconnect is still the live singleton — replacing it here would orphan the
  // old instance (which keeps its own reconnection timers running) and leave
  // two connections fighting over the same rooms.
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => console.log('🔌 Socket connected'));
  socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));

  return socket;
};

export const getSocket = () => socket;

/**
 * Returns the ONE app-wide socket, creating it from the stored session token if
 * it does not exist yet (e.g. after a full page refresh, where the module-level
 * `socket` variable was reset but the user is still signed in).
 *
 * This is deliberately not a second socket system — it funnels through the same
 * `initSocket` / `socket` singleton used everywhere else.
 *
 * Returns null for signed-out visitors, and callers must handle that.
 */
export const ensureSocket = () => {
  if (socket) {
    // Revive a socket that gave up after exhausting its reconnection attempts,
    // otherwise every later emit() silently buffers forever.
    if (!socket.connected) socket.connect();
    return socket;
  }
  try {
    const { token } = getAnyStoredSession();
    if (!token) return null;
    return initSocket(token);
  } catch {
    return null;
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
