import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../Header/Navbar';
import TopHeader from '../Header/TopHeader';
import Footer from '../Footer/Footer';
import { useAuth } from '../../context/AuthContext';

const Layout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const isHomeRoute =
    pathname === '/' ||
    ['/login', '/register', '/forgot-password'].includes(pathname) ||
    pathname.startsWith('/reset-password/');
  const isGuestHome = !isAuthenticated && isHomeRoute;
  const hasGraphPaperBackground = pathname !== '/roadmap' && pathname !== '/lesson';

  return (
    <div
      className={`layout-container${isHomeRoute ? ' layout-container--home' : ''}${isGuestHome ? ' layout-container--guest-home' : ''}${hasGraphPaperBackground ? ' layout-container--graph-paper' : ''}`}
    >
      <TopHeader />
      <div className="layout-body">
        {!isGuestHome && <Navbar />}

        <div className="main-wrapper">
          <main className="main-content">{children}</main>
        </div>
      </div>

      {/* Footer nằm ngoài layout-body để span toàn bộ chiều rộng,
          kể cả phần sidebar, không bị navbar che */}
      <Footer />
    </div>
  );
};

export default Layout;
