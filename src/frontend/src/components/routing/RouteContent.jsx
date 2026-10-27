import React, { Component, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import HeartbeatLoader from '../ui/HeartbeatLoader';
import StatusAlert from '../ui/StatusAlert';
import './RouteContent.css';

class RouteErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="route-error-state" aria-label="Không tải được trang">
          <StatusAlert variant="error" message="Không tải được trang. Bạn có thể thử tải lại." />
          <div className="route-error-actions">
            <button type="button" className="ui-button" onClick={() => window.location.reload()}>
              Tải lại trang
            </button>
            <Link to="/" className="ui-button ui-button--secondary">
              Về trang chủ
            </Link>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

export default function RouteContent({ children }) {
  const { pathname } = useLocation();
  return (
    <RouteErrorBoundary key={pathname}>
      <Suspense fallback={<HeartbeatLoader label="Đang tải trang..." />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}
