import React from 'react';
import mark from '../../assets/brand/netmaster-mark.png';
import wordmark from '../../assets/brand/netmaster-wordmark.png';
import './BrandLogo.css';

// Both image slices retain the source artwork's alignment and transparent canvas.
const BrandLogo = ({ className = '', inverse = false }) => (
  <span
    className={`brand-logo${inverse ? ' brand-logo--inverse' : ''}${className ? ` ${className}` : ''}`}
    role="img"
    aria-label="NetMaster — Học mạng để đi làm"
  >
    <img className="brand-logo__mark" src={mark} alt="" draggable="false" />
    <img className="brand-logo__wordmark" src={wordmark} alt="" draggable="false" />
  </span>
);

export default BrandLogo;
