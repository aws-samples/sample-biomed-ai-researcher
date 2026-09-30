// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { UserCircle } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../api';

interface DocumentMeta {
  submitter?: string;
  date_created?: string;
  file_name?: string;
}

export function PeerResultsChecks(props: { paperId?: string }) {
  const id = props.paperId;
  const [meta, setMeta] = useState<DocumentMeta>({});

  useEffect(() => {
    if (id) {
      apiClient.getDocumentMetadata(id).then(setMeta).catch(() => {});
    }
  }, [id]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-center gap-4 text-sm text-gray-600">
      <span className="flex items-center gap-1">
        <UserCircle size={18} /> {meta.submitter || 'Unknown'}
      </span>
      <span>{formatDate(meta.date_created)}</span>
    </div>
  );
}
