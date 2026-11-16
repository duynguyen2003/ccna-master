import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import AiAssistantIntro from '@ccna/agent-ui/intro';

export default function AiAssistant() {
  return (
    <AiAssistantIntro
      backAction={
        <Link to="/">
          <ArrowLeft size={16} aria-hidden="true" /> Về trang chủ
        </Link>
      }
      labAction={
        <Link to="/labs">
          Chọn bài lab <ArrowRight size={16} aria-hidden="true" />
        </Link>
      }
      lessonAction={
        <Link to="/roadmap">
          <BookOpen size={16} aria-hidden="true" /> Xem lộ trình học
        </Link>
      }
    />
  );
}
