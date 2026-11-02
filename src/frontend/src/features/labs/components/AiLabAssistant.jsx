import React, { useCallback } from 'react';
import DropdownSelect from '../../../components/ui/DropdownSelect';
import AnimatedCopyButton from '../../../components/ui/AnimatedCopyButton';
import Dialog from '../../../components/ui/Dialog';
import AiLabPanel from '@ccna/agent-ui/panel';
import { API_URL } from '../../../services/Api';

// Application wiring only. AI UI/state/transport live in src/agent/browser.
export default function AiLabAssistant(props) {
  const unauthorized = useCallback(() => window.dispatchEvent(new Event('unauthorized')), []);
  return (
    <AiLabPanel
      {...props}
      baseUrl={API_URL}
      Dialog={Dialog}
      Select={DropdownSelect}
      CopyButton={AnimatedCopyButton}
      onUnauthorized={unauthorized}
    />
  );
}
