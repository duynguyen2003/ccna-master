import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './header/Navbar';
import TopHeader from './header/TopHeader';
import Footer from './footer/Footer';
import { useAuth } from '../../context/AuthContext';
import LearningResumeBanner from '../learning/LearningResumeBanner';

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
      <a
        className="skip-link"
        href="#main-content"
        onClick={() => document.getElementById('main-content')?.focus()}
      >
        Bỏ qua điều hướng
      </a>
      <TopHeader />
      <div className="layout-body">
        {!isGuestHome && <Navbar />}

        <div className="main-wrapper">
          {pathname !== '/' && <LearningResumeBanner />}
          <main className="main-content" id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>

      {/* Footer nằm ngoài layout-body để span toàn bộ chiều rộng,
          kể cả phần sidebar, không bị navbar che */}
      <Footer />
    </div>
  );
};

export default Layout;
