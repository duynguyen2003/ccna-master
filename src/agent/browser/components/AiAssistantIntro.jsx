import React, { useRef } from 'react';
import DroidAvatar from './DroidAvatar';
import '../styles/AiAssistantIntro.css';

export default function AiAssistantIntro({ backAction, labAction, lessonAction }) {
  const greeting = useRef(null);
  return (
    <section className="ai-assistant-intro" aria-label="Giới thiệu Trợ lý AI">
      <nav className="ai-intro__back" aria-label="Quay lại trang chủ">
        {backAction}
      </nav>
      <div className="ai-intro__conversation">
        <figure className="ai-intro__character">
          <button
            type="button"
            className="ai-intro__avatar-button"
            aria-label="Đọc lời chào của Trợ lý AI"
            onClick={() => greeting.current?.focus({ preventScroll: true })}
          >
            <DroidAvatar size={104} greeting decorative />
          </button>
          <figcaption>
            <strong>Trợ lý AI</strong>
            <span>Đồng hành trong bài lab</span>
          </figcaption>
        </figure>
        <article
          className="ai-intro__greeting"
          aria-labelledby="ai-intro-title"
          tabIndex={-1}
          ref={greeting}
        >
          <span className="ai-intro__status">Trò chuyện riêng đang phát triển</span>
          <h1 id="ai-intro-title">Cùng mình thực hành mạng nhé!</h1>
          <p>
            Chào bạn, mình là trợ lý AI của NetMaster. Hiện tại, mình hỗ trợ bạn ngay trong các bài
            lab: gợi ý bước tiếp theo, phân tích kết nối và giải thích cấu hình.
          </p>
          <p>
            Không gian trò chuyện AI riêng đang được phát triển. Trong lúc chờ, hãy chọn một bài
            lab, mở tab <strong>Trợ lý AI</strong> và gửi câu hỏi của bạn nhé.
          </p>
          <div className="ai-intro__actions">
            {labAction}
            {lessonAction}
          </div>
        </article>
      </div>
    </section>
  );
}
