import React from 'react';
import AdminLabAi from '@ccna/agent-ui/admin';
import { API_URL } from '../../../../services/Api';
export default function AiLabSettings(props) {
  return <AdminLabAi {...props} baseUrl={API_URL} />;
}
