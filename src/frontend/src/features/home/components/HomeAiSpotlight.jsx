import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import './HomeShowcase.css';

export default function HomeAiSpotlight() {
  const [Avatar, setAvatar] = useState(null);
  useEffect(() => {
    let current = true;
    import('@ccna/agent-ui/avatar').then(
      (module) => {
        if (current) setAvatar(() => module.default);
      },
      () => {
        /* The decorative fallback keeps the feature usable if its chunk is unavailable. */
      }
    );
    return () => {
      current = false;
    };
  }, []);
  return (
    <section id="home-ai" className="home-ai-spotlight" aria-labelledby="home-ai-title">
      <div className="home-ai__intro">
        <div className="home-ai__title">
          <span className="home-ai__avatar">
            {Avatar ? (
              <Avatar size={38} greeting decorative />
            ) : (
              <Sparkles size={28} aria-hidden="true" />
            )}
          </span>
          <h2 id="home-ai-title">Trợ lý AI trong từng bài lab</h2>
        </div>
        <p>
          Hỏi ngay khi đang cấu hình. Nhận gợi ý theo thiết bị, mục tiêu và trạng thái bài lab của
          bạn.
        </p>
        <ul>
          {['Gợi ý bước tiếp theo', 'Phân tích kết nối', 'Giải thích cấu hình'].map((label) => (
            <li key={label}>
              <Check size={14} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
        <Link to="/ai-assistant">
          Thực hành cùng AI <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <aside className="home-ai__example" aria-label="Ví dụ giải thích khi học mạng">
        <span className="home-ai__example-label">Ví dụ giải thích</span>
        <h3>Vì sao cần DNS trước khi truy cập web?</h3>
        <div>
          {Avatar && <Avatar size={28} appearance="flower" animate={false} decorative />}
          <p>
            DNS đổi tên miền thành địa chỉ IP. Máy khách dùng địa chỉ đó để tạo kết nối TCP đến máy
            chủ, rồi gửi yêu cầu HTTP.
          </p>
        </div>
      </aside>
    </section>
  );
}
