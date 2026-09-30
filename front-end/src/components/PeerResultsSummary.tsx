// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Skeleton } from './ui/skeleton';
import { Feedback } from './Feedback';
import { PeerResultsChecks } from './PeerResultsChecks';
import { apiClient } from '../api';
import { useDocumentStatus } from '../hooks/useDocumentStatus';

interface PeerResultsSummaryProps {
  summaryData?: string[];
}

function PeerResultsSummary({ summaryData }: PeerResultsSummaryProps) {
  const { id } = useParams();
  const { status } = useDocumentStatus(id);
  const [summary, setSummary] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Use passed data if available, otherwise fetch
    if (summaryData && summaryData.length > 0) {
      setSummary(summaryData);
    } else if (status === 'COMPLETED') {
      fetchSummary();
    }
  }, [id, status, summaryData]);

  async function fetchSummary() {
    if (!id) return;
    setLoading(true);
    
    try {
      console.log('[PeerResultsSummary] Fetching summary for:', id);
      const data = await apiClient.getDocumentData(id, 'summary');
      console.log('[PeerResultsSummary] Summary raw response:', data);
      
      // summary.json has {summary: string, results_table: array}
      if (data?.summary && typeof data.summary === 'string') {
        setSummary([data.summary]);
      } else {
        setSummary([]);
      }
    } catch (e) {
      console.error('[PeerResultsSummary] Error fetching summary:', e);
      setSummary([]);
    } finally {
      setLoading(false);
    }
  }
  const isProcessing =
    status !== 'COMPLETED' && status !== 'FILTERED' && status !== 'FAILED';

  return (
    <>
      {(loading || isProcessing) && (
        <div className="flex flex-wrap gap-4 text-sm">
          <Skeleton className="lg:w-[350px] lg:h-36" />
          <Skeleton className="lg:w-[350px] lg:h-36" />
          <Skeleton className="lg:w-[350px] lg:h-36" />
        </div>
      )}
      {status === 'COMPLETED' && !loading && summary?.length > 0 && (
        <div>
          {/* Compact metadata header */}
          <div className="mb-4">
            <PeerResultsChecks paperId={id} />
          </div>
          
          {/* Summary card */}
          <div className="card w-full p-4 hover:shadow-xl hover:border-cyan-400 relative group">
            <div className="whitespace-pre-line" dangerouslySetInnerHTML={{ __html: summary[0] }} />
            <div className="absolute bottom-2 right-4 invisible group-hover:visible">
              <Feedback />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PeerResultsSummary;
