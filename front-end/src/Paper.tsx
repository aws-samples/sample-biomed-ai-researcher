// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
} from '@phosphor-icons/react';

import PeerResults from './components/PeerResults';
import { Tag } from './components/Tag';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Paper as PaperType } from './model';
import { apiClient } from './api';
import { useDocumentStatus } from './hooks/useDocumentStatus';

function Paper() {
  const { id } = useParams();
  const { status } = useDocumentStatus(id);
  const [paper, setPaper] = useState<PaperType>({
    id: '0',
    title: '',
  });

  useEffect(() => {
    if (id) fetchMetadata();
  }, [id]);

  async function fetchMetadata() {
    try {
      const metadata = await apiClient.getDocumentMetadata(id!);
      setPaper({
        id: id || '0',
        title: metadata.file_name || 'Document',
        authors: metadata.submitter || '',
        date: metadata.date_created ? new Date(metadata.date_created).toLocaleDateString() : '',
      });
    } catch (e) {
      setPaper({ id: id || '0', title: 'Processing document...' });
    }
  }

  return (
    <>
      <main className="relative">
        <div className="my-6 flex gap-2">
          {paper?.tags?.map((tag, i) => (
            <Tag key={i}>{tag}</Tag>
          ))}
        </div>
        <header className="max-w-[1200px]">
          <div className="flex">
            <h2 className="text-cyan-800 max-w-[850px]">
              {paper.title}
            </h2>
          </div>
          {paper.authors && <p className="font-bold my-2">{paper.authors}</p>}
          {paper.date && <p className="mt-2">Uploaded: {paper.date}</p>}
          <p className="my-2 text-sm text-gray-500">Document ID: {id}</p>
          <p className="text-sm">
            Status:{' '}
            <span
              className={
                status === 'COMPLETED'
                  ? 'text-green-600'
                  : status === 'FAILED'
                  ? 'text-red-600'
                  : 'text-yellow-600'
              }
            >
              {status}
            </span>
          </p>
        </header>

        <PeerResults />
      </main>
    </>
  );
}

export default Paper;
