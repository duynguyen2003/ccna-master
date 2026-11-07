import React from 'react';
import SlidingTabs from '../../ui/SlidingTabs';

const GuestSectionTabs = ({ items, activeSection, onSelect }) => (
  <SlidingTabs
    value={activeSection}
    className="notch-nav-links"
    aria-label="Các phần giới thiệu"
    data-active={Boolean(activeSection)}
  >
    {items.map((item) => {
      const isCurrent = activeSection === item.id;
      return (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={`header-notch-link${isCurrent ? ' active' : ''}`}
          aria-current={isCurrent ? 'page' : undefined}
          onClick={(event) => onSelect(event, item.id)}
        >
          {item.shortLabel ? (
            <>
              <span className="notch-text-full">{item.label}</span>
              <span className="notch-text-short">{item.shortLabel}</span>
            </>
          ) : (
            item.label
          )}
        </a>
      );
    })}
  </SlidingTabs>
);
export default GuestSectionTabs;
