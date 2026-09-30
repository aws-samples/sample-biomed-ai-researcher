// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
export interface Paper {
  id: string;
  title: string;
  authors?: string;
  abstract?: string;
  date?: string;
  publication?: string;
  accesses?: number;
  text?: string;
  tags?: string[];
  tasks?: PeerTask[];
}

export interface PeerTask {
  id: number;
  status: number;
  title: string;
  paperId: string;
  genes: string[];
  traits: string[];
  by?: string;
  date?: string;
  tags?: string[];
  results?: Results;
  checks?: string[];
}

export interface Results {
  genesMatched: string[];
  traitsMatched: string[];
  questions: Question[];
}

export interface Question {
  question: string;
  answer: string;
  evidence?: string;
  doc_reference?: string;
  children?: Question[];
  marker?: string;
  header?: string;
}

export interface References {
  doc_reference: string;
  text?: string;
}

export type Bookmark = {
  id: string;
  paperId: string;
  title?: string;
  folders?: number[];
  userId: string;
};
