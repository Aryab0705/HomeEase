/**
 * AppLayout — shared shell for all authenticated pages.
 *
 * Usage:
 *   <AppLayout>
 *     <h1>My Page</h1>
 *     ...content...
 *   </AppLayout>
 *
 * Renders: Navbar (sticky top) → flex row → Sidebar | <main> with children.
 * The <main> already has the correct flex-grow + min-width:0 + padding so
 * individual pages do NOT need to repeat those styles.
 */
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const AppLayout = ({ children, noPadding = false }) => (
  <div className="page-wrapper">
    <Navbar />
    <div className="layout-body">
      <Sidebar />
      <main
        className="layout-main"
        style={noPadding ? { padding: 0 } : undefined}
      >
        {children}
      </main>
    </div>
  </div>
);

export default AppLayout;
