import React from 'react';
import Navbar from '../Header/Navbar';
import TopHeader from '../Header/TopHeader';
import Footer from '../Footer/Footer';

const Layout = ({ children }) => {
  return (
    <div className={`layout-container`}>
      <TopHeader />
      <div className="layout-body">
        <Navbar />

        <div className="main-wrapper">
          <main className="main-content">
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