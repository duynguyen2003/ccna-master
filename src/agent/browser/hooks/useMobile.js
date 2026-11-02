import { useEffect, useState } from 'react';

export default function useMobile() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia?.('(max-width: 768px)').matches || false
  );
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 768px)');
    const update = () => setMobile(query.matches);
    query?.addEventListener?.('change', update);
    return () => query?.removeEventListener?.('change', update);
  }, []);
  return mobile;
}
