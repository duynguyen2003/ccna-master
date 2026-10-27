import AppIcon from '../../../components/ui/AppIcon';
import React, { useState, useCallback } from 'react';
import '../styles/SubnetCalculator.css';
import { Link } from 'react-router-dom';
import DropdownSelect from '../../../components/ui/DropdownSelect';

/* ═══════════════════════════════════════════
   UTILITY FUNCTIONS  –  pure subnet math
   ═══════════════════════════════════════════ */

/** Parse dotted-decimal string → 32-bit unsigned integer */
const ipToInt = (ip) => {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

/** 32-bit unsigned integer → dotted-decimal string */
const intToIp = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');

/** Build a 32-bit subnet mask from a CIDR prefix length */
const prefixToMask = (prefix) => (prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0);

/** Convert 32-bit integer to binary string with dots every 8 bits */
const intToBinaryStr = (n) => {
  const bin = n.toString(2).padStart(32, '0');
  return `${bin.slice(0, 8)}.${bin.slice(8, 16)}.${bin.slice(16, 24)}.${bin.slice(24, 32)}`;
};

/** Validate an IPv4 address string */
const isValidIPv4 = (ip) => {
  const regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(regex);
  if (!match) return false;
  return match.slice(1).every((octet) => {
    const n = Number(octet);
    return n >= 0 && n <= 255;
  });
};

/** Calculate all subnet details from an IP + prefix */
const calculateSubnet = (ip, prefix) => {
  const ipInt = ipToInt(ip);
  const mask = prefixToMask(prefix);
  const wildcard = ~mask >>> 0;
  const network = (ipInt & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;

  let usableFirst, usableLast, totalUsable;
  if (prefix >= 31) {
    // /31 point-to-point or /32 host route
    usableFirst = network;
    usableLast = broadcast;
    totalUsable = prefix === 32 ? 1 : 2;
  } else {
    usableFirst = network + 1;
    usableLast = broadcast - 1;
    totalUsable = Math.pow(2, 32 - prefix) - 2;
  }

  return {
    networkAddress: intToIp(network),
    broadcastAddress: intToIp(broadcast),
    usableFirst: intToIp(usableFirst),
    usableLast: intToIp(usableLast),
    totalUsable,
    subnetMask: intToIp(mask),
    subnetMaskBinary: intToBinaryStr(mask),
    wildcardMask: intToIp(wildcard),
    prefix,
  };
};

/** Generate list of sub-subnets when splitting a network */
const generateSubnets = (networkIp, originalPrefix, newPrefix) => {
  if (newPrefix <= originalPrefix) return [];
  const baseNetwork = ipToInt(networkIp) & prefixToMask(originalPrefix);
  const count = Math.pow(2, newPrefix - originalPrefix);
  const subnetSize = Math.pow(2, 32 - newPrefix);

  const subnets = [];
  for (let i = 0; i < count; i++) {
    const net = (baseNetwork + i * subnetSize) >>> 0;
    const bcast = (net + subnetSize - 1) >>> 0;
    let first, last;
    if (newPrefix >= 31) {
      first = net;
      last = bcast;
    } else {
      first = net + 1;
      last = bcast - 1;
    }
    subnets.push({
      id: i + 1,
      network: intToIp(net),
      usableFirst: intToIp(first),
      usableLast: intToIp(last),
      broadcast: intToIp(bcast),
    });
  }
  return subnets;
};

/* ═══════════════════════════════════════════
   PREFIX OPTIONS  /8  →  /32
   ═══════════════════════════════════════════ */
const prefixOptions = Array.from({ length: 25 }, (_, i) => {
  const p = i + 8;
  return { value: p, label: `/${p} – ${intToIp(prefixToMask(p))}` };
});

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */

const SubnetCalculator = () => {
  const [ipAddress, setIpAddress] = useState('');
  const [prefix, setPrefix] = useState(24);
  const [subPrefix, setSubPrefix] = useState(26);
  const [result, setResult] = useState(null);
  const [subnets, setSubnets] = useState([]);
  const [error, setError] = useState('');
  const [showSubnets, setShowSubnets] = useState(false);

  const handleCalculate = useCallback(() => {
    // Validate
    const trimmedIp = ipAddress.trim();
    if (!trimmedIp) {
      setError('Vui lòng nhập địa chỉ IP.');
      setResult(null);
      setSubnets([]);
      return;
    }
    if (!isValidIPv4(trimmedIp)) {
      setError('Địa chỉ IP không hợp lệ. Vui lòng nhập đúng định dạng IPv4 (ví dụ: 192.168.1.0).');
      setResult(null);
      setSubnets([]);
      return;
    }
    setError('');

    // Calculate main result
    const data = calculateSubnet(trimmedIp, prefix);
    setResult(data);

    // Generate subdivision list
    if (subPrefix > prefix) {
      const subList = generateSubnets(data.networkAddress, prefix, subPrefix);
      setSubnets(subList);
      setShowSubnets(true);
    } else {
      setSubnets([]);
      setShowSubnets(false);
    }
  }, [ipAddress, prefix, subPrefix]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCalculate();
  };

  // Ensure subPrefix > prefix for valid subdivision
  const subPrefixOptions = Array.from({ length: 32 - prefix }, (_, i) => {
    const p = prefix + 1 + i;
    return { value: p, label: `/${p} – ${intToIp(prefixToMask(p))}` };
  });

  return (
    <div className="subnet-calc-wrapper">
      {/* ─── Breadcrumb ─── */}
      <nav className="subnet-breadcrumb">
        <Link to="/" className="subnet-breadcrumb-link">
          <AppIcon name={'home'} className="app-icon" style={{ fontSize: 18 }} />
          Trang chủ
        </Link>
        <AppIcon name={'chevron_right'} className="app-icon subnet-breadcrumb-sep" />
        <span className="subnet-breadcrumb-current">Trình tính toán Subnet</span>
      </nav>

      {/* ─── Header ─── */}
      <header className="subnet-header">
        <div className="subnet-header-icon">
          <AppIcon name={'calculate'} className="app-icon" />
        </div>
        <h1 className="subnet-header-title">Trình tính toán Subnet CCNA</h1>
        <p className="subnet-header-desc">Công cụ hỗ trợ học tập CCNA miễn phí cho cộng đồng.</p>
      </header>

      {/* ─── Input Card ─── */}
      <section className="subnet-input-card">
        <div className="subnet-input-row">
          {/* IP Input */}
          <div className="subnet-field">
            <label className="subnet-label" htmlFor="subnet-ip">
              ĐỊA CHỈ IP
            </label>
            <div className="subnet-input-wrap">
              <AppIcon name={'language'} className="app-icon subnet-input-icon" />
              <input
                id="subnet-ip"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'subnet-error' : undefined}
                type="text"
                className={`subnet-input ${error ? 'has-error' : ''}`}
                placeholder="Ví dụ: 192.168.1.0"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Prefix Select */}
          <div className="subnet-field">
            <label className="subnet-label" htmlFor="subnet-prefix">
              SUBNET MASK / PREFIX
            </label>
            <DropdownSelect
              id="subnet-prefix"
              className="subnet-select"
              value={prefix}
              onChange={(e) => {
                const newPrefix = Number(e.target.value);
                setPrefix(newPrefix);
                if (subPrefix <= newPrefix) setSubPrefix(newPrefix + 2 <= 32 ? newPrefix + 2 : 32);
              }}
            >
              {prefixOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </DropdownSelect>
          </div>

          {/* Sub-prefix Select (subdivision) */}
          <div className="subnet-field">
            <label className="subnet-label" htmlFor="subnet-sub-prefix">
              CHIA NHỎ THÀNH
            </label>
            <DropdownSelect
              id="subnet-sub-prefix"
              className="subnet-select"
              value={subPrefix}
              onChange={(e) => setSubPrefix(Number(e.target.value))}
            >
              {subPrefixOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </DropdownSelect>
          </div>

          {/* Calculate Button */}
          <div className="subnet-field subnet-field-btn">
            <label className="subnet-label">&nbsp;</label>
            <button className="subnet-btn" onClick={handleCalculate} id="btn-subnet-calculate">
              <AppIcon name={'equalizer'} className="app-icon" />
              Tính toán
            </button>
          </div>
        </div>

        {error && (
          <div className="subnet-error" id="subnet-error" role="alert">
            <AppIcon name={'error_outline'} className="app-icon" />
            {error}
          </div>
        )}
      </section>

      {/* ─── Results ─── */}
      {result && (
        <section className="subnet-results" id="subnet-results">
          {/* Detail Table */}
          <div className="subnet-result-card">
            <div className="subnet-result-card-header">
              <AppIcon name={'info'} className="app-icon" />
              KẾT QUẢ CHI TIẾT
            </div>
            <table className="subnet-table detail-table">
              <tbody>
                <tr>
                  <td className="label-cell">
                    <AppIcon name={'router'} className="app-icon row-icon" />
                    Network Address
                  </td>
                  <td className="value-cell highlight">{result.networkAddress}</td>
                </tr>
                <tr>
                  <td className="label-cell">
                    <AppIcon name={'cell_tower'} className="app-icon row-icon" />
                    Broadcast Address
                  </td>
                  <td className="value-cell">{result.broadcastAddress}</td>
                </tr>
                <tr>
                  <td className="label-cell">
                    <AppIcon name={'swap_horiz'} className="app-icon row-icon" />
                    Usable Host Range
                  </td>
                  <td className="value-cell">
                    <span className="highlight">{result.usableFirst}</span>
                    <span className="range-sep"> — </span>
                    <span className="highlight">{result.usableLast}</span>
                  </td>
                </tr>
                <tr>
                  <td className="label-cell">
                    <AppIcon name={'devices'} className="app-icon row-icon" />
                    Total Usable Hosts
                  </td>
                  <td className="value-cell">
                    <span className="host-count">{result.totalUsable.toLocaleString()}</span>
                  </td>
                </tr>
                <tr>
                  <td className="label-cell">
                    <AppIcon name={'grid_on'} className="app-icon row-icon" />
                    Subnet Mask
                  </td>
                  <td className="value-cell">
                    <div>{result.subnetMask}</div>
                    <div className="binary-str">{result.subnetMaskBinary}</div>
                  </td>
                </tr>
                <tr>
                  <td className="label-cell">
                    <AppIcon name={'flip'} className="app-icon row-icon" />
                    Wildcard Mask
                  </td>
                  <td className="value-cell">{result.wildcardMask}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Subnet List Table */}
          {showSubnets && subnets.length > 0 && (
            <div className="subnet-result-card">
              <div className="subnet-result-card-header">
                <AppIcon name={'view_list'} className="app-icon" />
                DANH SÁCH SUBNET KHẢ DỤNG (/{subPrefix} VÍ DỤ)
              </div>
              <div className="subnet-table-scroll">
                <table className="subnet-table list-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Network Address</th>
                      <th>Usable Range</th>
                      <th>Broadcast</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subnets.map((s) => (
                      <tr key={s.id}>
                        <td className="id-cell">#{s.id}</td>
                        <td className="highlight">{s.network}</td>
                        <td>
                          <span className="highlight">{s.usableFirst}</span>
                          <span className="range-sep"> — </span>
                          <span className="highlight">{s.usableLast}</span>
                        </td>
                        <td className="broadcast-cell">{s.broadcast}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default SubnetCalculator;
