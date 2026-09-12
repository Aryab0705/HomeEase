import { createContext, useState, useEffect } from 'react';

const SidebarContext = createContext({ open: false, toggle: () => {} });

export const SidebarProvider = ({ children }) => {
  // Default open on desktop (≥768px), closed on mobile
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });

  // Close automatically on small screens when resizing down
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggle = () => setOpen(prev => !prev);

  return (
    <SidebarContext.Provider value={{ open, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
};

export default SidebarContext;
