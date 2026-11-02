import React, { useCallback } from 'react';
import FeedbackExplanation from '@ccna/agent-ui/feedback';
import { api } from '../../../services/Api';

export default function AiFeedbackExplanation({ token, attempt, disabled }) {
  const load = useCallback(
    (signal) => api.cliExplain(token, attempt.id, { signal, suppressGlobalError: true }),
    [token, attempt.id]
  );
  const submission = JSON.stringify([
    attempt.feedbackRecordedAt,
    attempt.feedbackRevision,
    attempt.feedback,
  ]);
  return (
    <FeedbackExplanation
      scope={`${token}:${attempt.id}:${submission}`}
      load={load}
      disabled={disabled}
    />
  );
}
