import React, { useEffect, useState } from 'react';
import '../styles/AdminLabAi.css';

function AdminScope({ baseUrl, token, labId }) {
  const [data, setData] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(false);
  const call = async (signal, body) => {
    const response = await fetch(`${baseUrl}/admin/labs/${encodeURIComponent(labId)}/ai`, {
      method: body ? 'PATCH' : 'GET',
      signal,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json();
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? 'Cấu hình đã thay đổi. Tải lại trước khi lưu.'
          : response.status === 403
            ? 'Bạn không có quyền quản trị trợ lý.'
            : response.status === 503
              ? 'Chưa cấu hình trợ lý trên máy chủ.'
              : 'Không tải hoặc lưu được cấu hình trợ lý.'
      );
    return json.data;
  };
  useEffect(() => {
    if (!labId) return;
    const abort = new AbortController();
    setData(null);
    setError('');
    void call(abort.signal)
      .then((next) => {
        if (!abort.signal.aborted) {
          setData(next);
          setEnabled(next.enabled);
        }
      })
      .catch((cause) => {
        if (!abort.signal.aborted) setError(cause.message);
      });
    return () => abort.abort();
    // Scope remounts when authentication or lab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);
  if (!labId) return <p>Lưu bài lab trước khi cấu hình trợ lý AI.</p>;
  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const next = await call(undefined, { enabled, version: data.version });
      setData((value) => ({ ...value, ...next }));
      setSaved(true);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ai-admin-lab" aria-label="Quản trị trợ lý AI">
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Tải lại
          </button>
        </div>
      )}
      {!data && !error && <p role="status">Đang tải cấu hình AI…</p>}
      {data && (
        <>
          <label>
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy || !data.editable}
              onChange={(event) => {
                setEnabled(event.target.checked);
                setSaved(false);
              }}
            />{' '}
            Bật trợ lý AI cho lab này
          </label>
          {!data.configured ? (
            <p>Máy chủ chưa cấu hình trợ lý AI.</p>
          ) : !data.editable ? (
            <p>Trợ lý chỉ hỗ trợ lab CLI.</p>
          ) : !data.available ? (
            <p>Trợ lý đang tắt trên máy chủ. Tài khoản vẫn cần quyền sử dụng khi bật lại.</p>
          ) : null}
          <button
            type="button"
            disabled={busy || !data.editable || data.enabled === enabled}
            aria-busy={busy}
            onClick={save}
          >
            {busy ? 'Đang lưu…' : 'Lưu cấu hình AI'}
          </button>
          <p role="status">{saved ? 'Đã lưu cấu hình AI.' : ''}</p>
          <dl>
            <div>
              <dt>Lượt yêu cầu</dt>
              <dd>{data.requests}</dd>
            </div>
            <div>
              <dt>Chi phí đã ghi nhận</dt>
              <dd>
                {new Intl.NumberFormat('vi-VN', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 6,
                }).format(Number(data.costMicros) / 1e6)}
              </dd>
            </div>
            <div>
              <dt>Chưa quyết toán</dt>
              <dd>{data.unresolved}</dd>
            </div>
            <div>
              <dt>Hữu ích / Chưa hữu ích</dt>
              <dd>
                {data.helpful} / {data.unhelpful}
              </dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
export default function AdminLabAi(props) {
  return <AdminScope key={`${props.token}:${props.labId}`} {...props} />;
}
