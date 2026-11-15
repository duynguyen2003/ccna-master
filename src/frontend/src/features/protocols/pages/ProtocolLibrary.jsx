import React, { lazy, Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import ProtocolLessonPlayer from '../../lessons/components/ProtocolLessonPlayer';
import { isProtocolId, protocolCatalog, scenarioCatalog } from '../data/lessonCatalog';

const ProtocolScenarioPicker = lazy(() => import('../components/ProtocolScenarioPicker'));

export default function ProtocolLibrary() {
  const [params, setParams] = useSearchParams();
  const [choosing, setChoosing] = useState(false);
  const trigger = useRef(null);
  const { user } = useAuth();
  const protocolId = isProtocolId(params.get('protocol')) ? params.get('protocol') : 'http';
  return (
    <div className="protocol-library">
      <header className="protocol-library__header">
        <div>
          <h1>Mô phỏng giao thức</h1>
          <p>
            {scenarioCatalog.length} kịch bản · {protocolCatalog.length} giao thức
          </p>
        </div>
        <button
          type="button"
          ref={trigger}
          className="protocol-library__choose"
          onClick={() => setChoosing(true)}
          aria-haspopup="dialog"
        >
          <Layers size={18} aria-hidden="true" />
          Chọn mô phỏng
        </button>
      </header>
      {choosing && (
        <Suspense fallback={<p role="status">Đang tải bộ chọn mô phỏng…</p>}>
          <ProtocolScenarioPicker
            scenarios={scenarioCatalog}
            currentId={protocolId}
            returnFocusRef={trigger}
            onClose={() => setChoosing(false)}
            onSelect={(id) => {
              const next = new URLSearchParams(params);
              next.set('protocol', id);
              setParams(next);
            }}
          />
        </Suspense>
      )}
      <ProtocolLessonPlayer protocolId={protocolId} userId={user?.id} />
    </div>
  );
}
