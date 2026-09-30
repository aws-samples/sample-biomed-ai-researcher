// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api';

export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FILTERED' | 'FAILED' | 'UNKNOWN';

interface UseDocumentStatusResult {
  status: DocumentStatus;
  currentStage: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDocumentStatus(fileId: string | undefined, pollInterval = 5000): UseDocumentStatusResult {
  const [status, setStatus] = useState<DocumentStatus>('UNKNOWN');
  const [currentStage, setCurrentStage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!fileId) return;
    
    try {
      const metadata = await apiClient.getDocumentMetadata(fileId);
      const rawStatus = (metadata?.status || '').toLowerCase();
      
      // Set current stage for display
      setCurrentStage(metadata?.status || 'Starting...');
      
      let newStatus: DocumentStatus;
      if (rawStatus === 'summary complete') {
        newStatus = 'COMPLETED';
      } else if (rawStatus.includes('not relevant')) {
        // Paper was filtered out; the pipeline intentionally stops here.
        newStatus = 'FILTERED';
      } else if (rawStatus.includes('fail') || rawStatus.includes('error')) {
        newStatus = 'FAILED';
      } else if (rawStatus === '') {
        newStatus = 'PENDING';
      } else {
        newStatus = 'PROCESSING';
      }
      
      setStatus(newStatus);
      setError(null);
    } catch (e) {
      setStatus('PENDING');
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    if (!fileId) {
      setIsLoading(false);
      return;
    }

    fetchStatus();

    // Only poll if not in terminal state
    const shouldPoll =
      status !== 'COMPLETED' && status !== 'FAILED' && status !== 'FILTERED';
    if (!shouldPoll) return;

    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fileId, status, pollInterval, fetchStatus]);

  return { status, currentStage, isLoading, error, refetch: fetchStatus };
}
