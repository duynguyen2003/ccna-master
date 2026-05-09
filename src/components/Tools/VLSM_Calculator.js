import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

/* ════════════════════════════════════════════════════
   IP UTILITY FUNCTIONS  –  thuần JavaScript
   ════════════════════════════════════════════════════ */

/**
 * Chuyển IP dạng chuỗi "a.b.c.d" → số nguyên 32-bit (unsigned)
 * Ví dụ: "192.168.1.0" → 3232235776
 */
const ipToLong = (ip) => {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

/**
 * Chuyển số nguyên 32-bit → chuỗi IP "a.b.c.d"
 * Ví dụ: 3232235776 → "192.168.1.0"
 */
const longToIp = (n) =>
  [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');

/**
 * Tạo Subnet Mask 32-bit từ prefix
 * Ví dụ: prefix 24 → 0xFFFFFF00 → "255.255.255.0"
 */
const prefixToMask = (prefix) =>
  prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

/**
 * Validate địa chỉ IPv4
 */
const isValidIPv4 = (ip) => {
  const regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(regex);
  if (!match) return false;
  return match.slice(1).every((octet) => Number(octet) >= 0 && Number(octet) <= 255);
};

/**
 * Tìm số bit host cần thiết (n) sao cho 2^n - 2 >= hostsNeeded
 * Trả về prefix length tương ứng = 32 - n
 */
const findPrefixForHosts = (hostsNeeded) => {
  // Tối thiểu cần 2 bit host (cho /30 = 2 host)
  for (let n = 2; n <= 32; n++) {
    if (Math.pow(2, n) - 2 >= hostsNeeded) {
      return { prefix: 32 - n, hostBits: n, allocatedSize: Math.pow(2, n) };
    }
  }
  return null; // Không hợp lệ
};

/* ════════════════════════════════════════════════════
   VLSM CORE ALGORITHM
   ════════════════════════════════════════════════════ */

/**
 * Thuật toán VLSM:
 * 1. Sắp xếp giảm dần theo số host yêu cầu
 * 2. Tính prefix mới cho từng subnet
 * 3. Cấp phát tuần tự địa chỉ IP (mạng tiếp theo = broadcast trước + 1)
 * 4. Kiểm tra tràn dải mạng gốc
 */
const calculateVLSM = (majorNetwork, majorPrefix, subnets) => {
  // Lấy network address thực sự của dải mạng gốc
  const majorMask = prefixToMask(majorPrefix);
  const majorNetworkInt = (ipToLong(majorNetwork) & majorMask) >>> 0;
  const majorBroadcastInt = (majorNetworkInt | (~majorMask >>> 0)) >>> 0;
  const majorTotalAddresses = Math.pow(2, 32 - majorPrefix);

  // Bước 1: Sắp xếp GIẢM DẦN theo số host cần thiết (nguyên tắc bắt buộc VLSM)
  const sorted = [...subnets]
    .map((s, originalIndex) => ({ ...s, originalIndex }))
    .sort((a, b) => b.hosts - a.hosts);

  const results = [];
  let currentAddress = majorNetworkInt; // Bắt đầu từ đầu dải mạng gốc
  let totalAllocated = 0;

  for (const subnet of sorted) {
    // Bước 2: Tính prefix mới cho số host yêu cầu
    const calc = findPrefixForHosts(subnet.hosts);
    if (!calc) {
      return { error: `Không thể cấp phát cho "${subnet.name}" (${subnet.hosts} hosts) - số host quá lớn.` };
    }

    const { prefix: newPrefix, allocatedSize } = calc;
    const usableHosts = allocatedSize - 2;

    // Bước 3: Cấp phát tuần tự
    const networkAddr = currentAddress;
    const broadcastAddr = (networkAddr + allocatedSize - 1) >>> 0;
    const firstUsable = (networkAddr + 1) >>> 0;
    const lastUsable = (broadcastAddr - 1) >>> 0;

    // Bước 4: Kiểm tra tràn dải mạng gốc
    if (broadcastAddr > majorBroadcastInt) {
      return {
        error: `Không đủ không gian địa chỉ! Khi cấp phát đến "${subnet.name}", địa chỉ broadcast (${longToIp(broadcastAddr)}) đã vượt quá dải mạng gốc ${longToIp(majorNetworkInt)}/${majorPrefix} (broadcast: ${longToIp(majorBroadcastInt)}).`,
        partial: results,
      };
    }

    results.push({
      name: subnet.name,
      hostsNeeded: subnet.hosts,
      allocatedSize: usableHosts,
      networkAddress: longToIp(networkAddr),
      prefix: newPrefix,
      subnetMask: longToIp(prefixToMask(newPrefix)),
      firstUsable: longToIp(firstUsable),
      lastUsable: longToIp(lastUsable),
      broadcastAddress: longToIp(broadcastAddr),
      blockSize: allocatedSize,
    });

    totalAllocated += allocatedSize;
    // Mạng tiếp theo nối tiếp ngay sau broadcast
    currentAddress = (broadcastAddr + 1) >>> 0;
  }

  return {
    results,
    summary: {
      majorNetwork: longToIp(majorNetworkInt),
      majorPrefix,
      majorBroadcast: longToIp(majorBroadcastInt),
      totalAddresses: majorTotalAddresses,
      totalAllocated,
      totalUsed: totalAllocated,
      usagePercent: ((totalAllocated / majorTotalAddresses) * 100).toFixed(1),
      remaining: majorTotalAddresses - totalAllocated,
      remainingRange: totalAllocated < majorTotalAddresses
        ? `${longToIp(currentAddress)} – ${longToIp(majorBroadcastInt)}`
        : 'Không còn',
    },
  };
};

/* ════════════════════════════════════════════════════
   PREFIX OPTIONS  /8 → /30
   ════════════════════════════════════════════════════ */
const prefixOptions = Array.from({ length: 23 }, (_, i) => {
  const p = i + 8;
  return { value: p, label: `/${p}  (${longToIp(prefixToMask(p))})` };
});

/* ════════════════════════════════════════════════════
   REACT COMPONENT
   ════════════════════════════════════════════════════ */

const VLSMCalculator = () => {
  // ── State: Major network ──
  const [majorIp, setMajorIp] = useState('192.168.1.0');
  const [majorPrefix, setMajorPrefix] = useState(24);

  // ── State: Subnet list (dynamic rows) ──
  const [subnets, setSubnets] = useState([
    { id: 1, name: '', hosts: '' },
    { id: 2, name: '', hosts: '' },
  ]);
  let nextId = React.useRef(3);

  // ── State: Results & errors ──
  const [vlsmResult, setVlsmResult] = useState(null);
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  // ── Handlers: Dynamic subnet rows ──
  const addSubnet = () => {
    setSubnets((prev) => [...prev, { id: nextId.current++, name: '', hosts: '' }]);
  };

  const removeSubnet = (id) => {
    if (subnets.length <= 1) return; // Giữ tối thiểu 1 dòng
    setSubnets((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSubnet = (id, field, value) => {
    setSubnets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  // ── Handler: Calculate VLSM ──
  const handleCalculate = useCallback(() => {
    setError('');
    setVlsmResult(null);

    // Validate major IP
    const trimIp = majorIp.trim();
    if (!trimIp || !isValidIPv4(trimIp)) {
      setError('Địa chỉ IP mạng gốc không hợp lệ. Vui lòng nhập đúng định dạng IPv4 (ví dụ: 192.168.1.0).');
      return;
    }

    // Validate subnets
    const parsed = [];
    for (let i = 0; i < subnets.length; i++) {
      const s = subnets[i];
      const name = s.name.trim() || `Subnet ${i + 1}`;
      const hosts = parseInt(s.hosts, 10);
      if (!s.hosts || isNaN(hosts) || hosts < 1) {
        setError(`Dòng "${name}": Số lượng host phải là số dương ≥ 1.`);
        return;
      }
      if (hosts > 16777214) {
        setError(`Dòng "${name}": Số lượng host quá lớn (tối đa 16,777,214 cho /8).`);
        return;
      }
      parsed.push({ name, hosts });
    }

    if (parsed.length === 0) {
      setError('Vui lòng thêm ít nhất 1 mạng con.');
      return;
    }

    // Run VLSM algorithm
    const result = calculateVLSM(trimIp, majorPrefix, parsed);

    if (result.error) {
      setError(result.error);
      if (result.partial && result.partial.length > 0) {
        setVlsmResult({ results: result.partial, summary: null });
      }
      return;
    }

    setVlsmResult(result);
  }, [majorIp, majorPrefix, subnets]);

  // Enter key support
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCalculate();
  };

  /* ════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════ */
  return (
    <div className="vlsm-wrapper">
      {/* ─── Breadcrumb ─── */}
      <nav className="vlsm-breadcrumb">
        <Link to="/" className="vlsm-breadcrumb-link">
          <span className="material-icons-round" style={{ fontSize: 18 }}>home</span>
          Trang chủ
        </Link>
        <span className="material-icons-round vlsm-breadcrumb-sep">chevron_right</span>
        <span className="vlsm-breadcrumb-current">VLSM Calculator</span>
      </nav>

      {/* ─── Header ─── */}
      <header className="vlsm-header">
        <div className="vlsm-header-icon">
          <span className="material-icons-round">account_tree</span>
        </div>
        <h1 className="vlsm-header-title">VLSM Calculator</h1>
        <p className="vlsm-header-desc">Công cụ tính toán mạng con VLSM</p>
      </header>

      {/* ─── Collapsible Guide Toggle ─── */}
      <button className="vlsm-guide-toggle" onClick={() => setShowGuide(!showGuide)}>
        <span className="material-icons-round" style={{ fontSize: 18, color: '#f59e0b' }}>lightbulb</span>
        <span>Click để xem hướng dẫn và quy tắc tính VLSM</span>
        <span className="material-icons-round vlsm-guide-chevron" style={{ transform: showGuide ? 'rotate(180deg)' : 'rotate(0)' }}>
          expand_more
        </span>
      </button>

      {/* ─── Info Cards (2-column dark) - hiện khi click ─── */}
      {showGuide && (
        <div className="vlsm-info-grid">
          {/* Left: VLSM là gì? */}
          <div className="vlsm-info-card">
            <div className="vlsm-info-card-title">
              <span className="material-icons-round">menu_book</span>
              VLSM là gì?
            </div>
            <p className="vlsm-info-card-desc">
              Variable Length Subnet Masking (VLSM) được sử dụng để tối ưu hóa việc phân bổ địa chỉ IP
              bằng cách gán các subnet mask có độ dài khác nhau cho các mạng con dựa trên nhu cầu thực tế.
            </p>
            <ul className="vlsm-info-list">
              <li>
                <span className="material-icons-round vlsm-info-check">check_circle</span>
                Tối ưu hóa không gian địa chỉ IP.
              </li>
              <li>
                <span className="material-icons-round vlsm-info-check">check_circle</span>
                Giảm nhiều địa chỉ IP không sử dụng.
              </li>
              <li>
                <span className="material-icons-round vlsm-info-check">check_circle</span>
                Tăng tính bảo mật thông qua phân đoạn mạng.
              </li>
            </ul>
          </div>

          {/* Right: Hướng dẫn sử dụng */}
          <div className="vlsm-info-card">
            <div className="vlsm-info-card-title">
              <span className="material-icons-round">integration_instructions</span>
              Hướng dẫn sử dụng
            </div>
            <div className="vlsm-steps-list">
              <div className="vlsm-step-item">
                <span className="vlsm-step-num">01</span>
                <div>
                  <strong>Mạng Chính</strong>
                  <p>Nhập địa chỉ IP và Prefix của dải mạng gốc (Major Network).</p>
                </div>
              </div>
              <div className="vlsm-step-item">
                <span className="vlsm-step-num">02</span>
                <div>
                  <strong>Cấu hình Subnets</strong>
                  <p>Thêm các mạng con và chỉ định số lượng host cần thiết cho mỗi mạng.</p>
                </div>
              </div>
              <div className="vlsm-step-item">
                <span className="vlsm-step-num">03</span>
                <div>
                  <strong>Kết quả</strong>
                  <p>Nhấn "Tính toán VLSM" để xem chi tiết phân bổ mạng tối ưu nhất.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Input Area: Two-column layout ─── */}
      <div className="vlsm-input-grid">
        {/* LEFT: Major Network */}
        <section className="vlsm-card vlsm-major-card">
          <div className="vlsm-card-title">
            <span className="material-icons-round">hub</span>
            Mạng Chính
          </div>

          <div className="vlsm-field">
            <label className="vlsm-label">ĐỊA CHỈ IP GỐC</label>
            <input
              type="text"
              className="vlsm-input"
              placeholder="Ví dụ: 192.168.1.0"
              value={majorIp}
              onChange={(e) => setMajorIp(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
          </div>

          <div className="vlsm-field">
            <label className="vlsm-label">PREFIX GỐC</label>
            <select
              className="vlsm-select"
              value={majorPrefix}
              onChange={(e) => setMajorPrefix(Number(e.target.value))}
            >
              {prefixOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="vlsm-major-info">
            <span className="material-icons-round" style={{ fontSize: 16 }}>info_outline</span>
            Dải mạng gốc sẽ được phân bổ cho các mạng con. VLSM cho phép sử dụng không gian địa chỉ hiệu quả.
          </div>
        </section>

        {/* RIGHT: Subnets */}
        <section className="vlsm-card vlsm-subnets-card">
          <div className="vlsm-card-title">
            <span className="material-icons-round">device_hub</span>
            Cấu hình Mạng con
            <button className="vlsm-add-btn" onClick={addSubnet} title="Thêm mạng con">
              <span className="material-icons-round" style={{ fontSize: 18 }}>add</span>
              Thêm
            </button>
          </div>

          <div className="vlsm-subnet-list">
            {subnets.map((s, idx) => (
              <div className="vlsm-subnet-row" key={s.id}>
                <div className="vlsm-subnet-fields">
                  <div className="vlsm-field vlsm-field-name">
                    <label className="vlsm-label">TÊN MẠNG</label>
                    <input
                      type="text"
                      className="vlsm-input"
                      placeholder={`VD: Phòng ${idx + 1}`}
                      value={s.name}
                      onChange={(e) => updateSubnet(s.id, 'name', e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div className="vlsm-field vlsm-field-hosts">
                    <label className="vlsm-label">HOSTS</label>
                    <input
                      type="number"
                      className="vlsm-input vlsm-input-hosts"
                      placeholder="50"
                      min="1"
                      value={s.hosts}
                      onChange={(e) => updateSubnet(s.id, 'hosts', e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                <button
                  className="vlsm-remove-btn"
                  onClick={() => removeSubnet(s.id)}
                  disabled={subnets.length <= 1}
                  title="Xóa mạng con"
                >
                  <span className="material-icons-round">delete_outline</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ─── Error ─── */}
      {error && (
        <div className="vlsm-error">
          <span className="material-icons-round">error_outline</span>
          {error}
        </div>
      )}

      {/* ─── Calculate Button ─── */}
      <div className="vlsm-action-center">
        <button className="vlsm-calc-btn" onClick={handleCalculate} id="btn-vlsm-calculate">
          <span>TÍNH TOÁN VLSM</span>
          <span className="material-icons-round">bolt</span>
        </button>
      </div>

      {/* ─── Results ─── */}
      {vlsmResult && vlsmResult.results && vlsmResult.results.length > 0 && (
        <section className="vlsm-results" id="vlsm-results">
          {/* Results Header */}
          <div className="vlsm-results-header">
            <div className="vlsm-results-header-left">
              <h2>Kết quả Phân bổ mạng</h2>
              <span className="vlsm-results-sub">ALLOCATION MATRIX TABLE</span>
            </div>
          </div>

          {/* Results Table */}
          <div className="vlsm-table-scroll">
            <table className="vlsm-table">
              <thead>
                <tr>
                  <th>Tên mạng</th>
                  <th>Yêu cầu</th>
                  <th>Cấp phát</th>
                  <th>Địa chỉ mạng</th>
                  <th>Subnet Mask</th>
                  <th>Dải IP sử dụng</th>
                  <th>Broadcast</th>
                </tr>
              </thead>
              <tbody>
                {vlsmResult.results.map((row, i) => (
                  <tr key={i}>
                    <td className="vlsm-cell-name">{row.name}</td>
                    <td className="vlsm-cell-hosts">{row.hostsNeeded}</td>
                    <td className="vlsm-cell-alloc">
                      <span className="vlsm-badge">{row.allocatedSize} Hosts</span>
                    </td>
                    <td className="vlsm-cell-mono vlsm-cell-network">{row.networkAddress}</td>
                    <td className="vlsm-cell-mono vlsm-cell-mask">
                      {row.subnetMask} <span className="vlsm-prefix-tag">(/{row.prefix})</span>
                    </td>
                    <td className="vlsm-cell-mono vlsm-cell-range">
                      {row.firstUsable} <span className="vlsm-range-sep">–</span> {row.lastUsable}
                    </td>
                    <td className="vlsm-cell-mono vlsm-cell-bcast">{row.broadcastAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Bar */}
          {vlsmResult.summary && (
            <div className="vlsm-summary-bar">
              <div className="vlsm-summary-item">
                <span className="vlsm-summary-label">TỔNG HOST SỬ DỤNG</span>
                <span className="vlsm-summary-value">
                  {vlsmResult.summary.totalUsed} / {vlsmResult.summary.totalAddresses}
                </span>
              </div>
              <div className="vlsm-summary-item">
                <span className="vlsm-summary-label">HIỆU SUẤT SỬ DỤNG</span>
                <span className="vlsm-summary-value vlsm-summary-percent">
                  {vlsmResult.summary.usagePercent}%
                </span>
              </div>
              <div className="vlsm-summary-item">
                <span className="vlsm-summary-label">DẢI CHỈ CÒN LẠI</span>
                <span className="vlsm-summary-value vlsm-summary-remaining">
                  {vlsmResult.summary.remainingRange}
                </span>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default VLSMCalculator;
