// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { auth } from './auth';
import appConfig from './config.json';

// API utility with Cognito authentication
export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = appConfig.apiEndpoint;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await auth.getIdToken();
    if (!token) {
      throw new Error('Not authenticated. Please sign in.');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': token,
    };
  }

  async uploadDocument(
    file: File,
    condition: string[] = [],
    gene: string[] = []
  ): Promise<any> {
    const headers = await this.getAuthHeaders();

    // Step 1: Get presigned URL. Note: the backend derives the uploader
    // identity from the Cognito token, so no submitter is sent from the client.
    const presignedResponse = await fetch(`${this.baseUrl}document`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        file_name: file.name,
        prompt_group: 'default',
        condition,
        gene
      })
    });

    if (!presignedResponse.ok) {
      throw new Error(`Failed to get upload URL: ${presignedResponse.statusText}`);
    }

    const { presigned_url, file_id } = await presignedResponse.json();

    // Step 2: Upload file directly to S3 using presigned URL
    const uploadResponse = await fetch(presigned_url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': 'application/pdf'
      }
    });

    if (!uploadResponse.ok) {
      throw new Error(`File upload failed: ${uploadResponse.statusText}`);
    }

    return { file_id, message: 'Upload successful' };
  }

  async getDocumentMetadata(fileId: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}document_metadata?key=${fileId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get metadata: ${response.statusText}`);
    }

    return response.json();
  }

  async getDocumentData(fileId: string, requestType: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}document_data?file-id=${fileId}&request-type=${requestType}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get document data: ${response.statusText}`);
    }

    // For summary, return JSON; for others, return text
    if (requestType === 'summary') {
      return response.json();
    }
    return response.text();
  }

  async getGenesConditions(): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}genes-conditions`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get genes/conditions: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();