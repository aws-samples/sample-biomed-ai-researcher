// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  ArrowBendRightDown,
  BracketsCurly,
  CheckCircle,
  ListMagnifyingGlass,
  Microscope,
  MinusCircle,
} from '@phosphor-icons/react';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';
import ReactJson from 'react18-json-view';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../components/ui/hover-card';
import { Question, References } from '../model';
import h from '.././data/data_headers.json';
import { useParams } from 'react-router-dom';
import { restructureTableData } from '../utilities';
import PeerResultsSummary from './PeerResultsSummary';
import { Feedback } from './Feedback';
import { Combobox } from '../components/Combobox';
import { apiClient } from '../api';
import { useDocumentStatus } from '../hooks/useDocumentStatus';
import 'react18-json-view/src/style.css';

const headers: any = h;

function PeerResults() {
  const { id } = useParams();
  const { status, currentStage, isLoading: statusLoading } = useDocumentStatus(id);
  const [rawJSON, setRawJSON] = useState<Question[] | undefined>();
  const [results, setResults] = useState<Question[] | undefined>();
  const [references, setReferences] = useState<References[] | undefined>();
  const [biomarkers, setBiomarkers] = useState<string[]>([]);
  const [summaryText, setSummaryText] = useState<string[]>([]);

  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showJSON, setShowJSON] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'COMPLETED') {
      fetchResults();
    }
  }, [id, status]);

  async function fetchResults() {
    if (!id) return;
    setLoading(true);
    setError(null);
    
    try {
      // Fetch summary which contains results_table (the structured Q&A data)
      // console.log('[PeerResults] Fetching summary for:', id);
      const summaryData = await apiClient.getDocumentData(id, 'summary');
      // console.log('[PeerResults] Summary raw response:', summaryData);
      
      // results_table contains the structured question/answer data
      if (summaryData?.results_table) {
        setRawJSON(summaryData.results_table);
        const restructured = await restructureTableData(summaryData.results_table);
        // console.log('[PeerResults] Results restructured:', restructured);
        setResults(restructured);
      }
      
      // Extract summary text for PeerResultsSummary - keep as single string
      if (summaryData?.summary && typeof summaryData.summary === 'string') {
        setSummaryText([summaryData.summary]);
      }
      
      // Fetch biomarkers
      // console.log('[PeerResults] Fetching biomarkers for:', id);
      const biomarkersData = await apiClient.getDocumentData(id, 'biomarkers');
      // console.log('[PeerResults] Biomarkers raw:', biomarkersData);
      if (typeof biomarkersData === 'string') {
        // Remove surrounding quotes and unescape \n
        let cleaned = biomarkersData.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
        // Split by newlines and clean up numbering
        const lines = cleaned.split('\n').map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(s => s);
        // console.log('[PeerResults] Biomarkers parsed:', lines);
        setBiomarkers(lines);
      }
      
      // Fetch outcomes for references
      // console.log('[PeerResults] Fetching outcomes for:', id);
      const outcomesData = await apiClient.getDocumentData(id, 'outcomes');
      // console.log('[PeerResults] Outcomes raw response:', outcomesData);
      
      // Parse outcomes - can be various formats
      let parsedOutcomes: References[] = [];
      try {
        let dataStr = typeof outcomesData === 'string' ? outcomesData : JSON.stringify(outcomesData);
        // Unescape the string (handles \n and \")
        dataStr = dataStr.replace(/\\n/g, '').replace(/\\"/g, '"');
        // Extract JSON object from the response
        const jsonMatch = dataStr.match(/\{[^{}]*"variant_to_outcome"[^{}]*\{[\s\S]*?\}\s*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.variant_to_outcome) {
            parsedOutcomes = Object.entries(parsed.variant_to_outcome).map(([gene, text]) => ({
              doc_reference: gene,
              text: text as string
            }));
          }
        }
      } catch (e) {
        // console.log('[PeerResults] Could not parse outcomes as JSON:', e);
      }
      // console.log('[PeerResults] Parsed outcomes:', parsedOutcomes);
      setReferences(parsedOutcomes);
    } catch (e) {
      console.error('[PeerResults] Error fetching results:', e);
      setError(e instanceof Error ? e.message : 'Failed to load results');
    } finally {
      setLoading(false);
    }
  }

  const isProcessing = status === 'PENDING' || status === 'PROCESSING' || status === 'UNKNOWN';

  return (
    <>
      {(statusLoading || isProcessing) && (
        <section className="my-20 xl:max-w-[1100px]">
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin h-5 w-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
              <p className="font-medium">Processing document...</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div className="bg-cyan-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
            <p className="text-sm text-gray-600">
              Current stage: <span className="font-medium text-cyan-700">{currentStage || 'Initializing...'}</span>
            </p>
            <p className="text-xs text-gray-400 mt-2">This may take a few minutes</p>
          </div>
        </section>
      )}
      {status === 'FAILED' && (
        <section className="my-20 xl:max-w-[1100px]">
          <p className="text-red-600">Document processing failed. Please try uploading again.</p>
        </section>
      )}
      {status === 'FILTERED' && (
        <section className="my-20 xl:max-w-[1100px]">
          <p className="text-gray-600">
            This paper was determined not to be relevant to the target condition,
            so no further analysis was performed.
          </p>
        </section>
      )}
      {loading && (
        <section className="my-20 xl:max-w-[1100px]">
          <p>Loading results...</p>
        </section>
      )}
      {error && (
        <section className="my-20 xl:max-w-[1100px]">
          <p className="text-red-600">{error}</p>
        </section>
      )}
      {status === 'COMPLETED' && !loading && !error && results != undefined && (
        <section className="my-20 xl:max-w-[1100px] border-l-2 pl-4 border-cyan-400">
          <h4 className="mb-8 flex justify-start items-center gap-2">
            <div className="">
              <Microscope size={24} className="inline" /> Peer Results for
            </div>
            <div className="w-64">
              <Combobox
                label="GPR75 x BMI"
                items={['GPR75 x BMI', '129S7/SvEvBrd-Mt1 x Obesity']}
              />
            </div>
          </h4>

          <PeerResultsSummary summaryData={summaryText} />

          {/* Display biomarkers if available */}
          {biomarkers.length > 0 && (
            <div className="my-6">
              <h5 className="mb-3 font-semibold">Biomarkers Identified</h5>
              <div className="flex flex-wrap gap-2">
                {biomarkers.map((b, i) => (
                  <span key={i} className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm">{b}</span>
                ))}
              </div>
            </div>
          )}

          {/* Display outcomes/variants if available */}
          {references && references.length > 0 && (
            <div className="my-6">
              <h5 className="mb-3 font-semibold">Key Findings</h5>
              <div className="flex flex-wrap gap-3">
                {references.map((ref, i) => (
                  <div key={i} className="card p-3 max-w-sm">
                    <h6 className="font-medium text-cyan-700">{ref.doc_reference}</h6>
                    <p className="text-sm text-gray-600 mt-1">{ref.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="my-5">
            <Button onClick={() => setShowAnalysis(!showAnalysis)}>
              {showAnalysis ? 'Hide' : 'Show'} Full Analysis
            </Button>
          </p>

          {showAnalysis && (
            <section className="bg-cyan-50 p-7 rounded-lg max-w-[1000px] flex flex-col gap-14">
              <Button
                className="self-end -mr-3 -mb-12"
                variant={'link'}
                size="sm"
                onClick={() => {
                  setShowJSON(!showJSON);
                }}
              >
                <BracketsCurly className="inline mr-1" size={20} /> Raw JSON
              </Button>
              {showJSON && <ReactJson src={rawJSON as any} />}

              {results?.map((q, parentI) => {
                return (
                  <section key={parentI}>
                    <article>
                      <QuestionHeader
                        question={q.question}
                        header={headers[parentI + 1]}
                      >
                        {q.answer}
                      </QuestionHeader>
                      {q.answer.substring(0, 2) != 'No' && (
                        <div className="flex flex-col gap-4 mt-4 border-l-2 border-gray-400 ml-3 pl-4">
                          {q.children?.map((sq, childI) => {
                            return (
                              <div
                                className="flex"
                                key={parentI + '_' + childI}
                              >
                                <div
                                  className="text-sm grow"
                                  title={sq.question}
                                >
                                  <h5 className="inline">{sq.header}: </h5>
                                  {sq.answer}
                                </div>
                                {sq.doc_reference
                                  ?.split(',')
                                  .map((ref, refI) => {
                                    const refId = ref.trim();
                                    if (refId) {
                                      const foundRef = references?.find(
                                        (r) => r.doc_reference == refId
                                      );

                                      if (foundRef) {
                                        const txt = foundRef?.text || '';
                                        return (
                                          <Evidence
                                            key={
                                              parentI +
                                              '_' +
                                              childI +
                                              '_' +
                                              refI
                                            }
                                          >
                                            {txt}
                                          </Evidence>
                                        );
                                      } else {
                                        return (
                                          <Evidence
                                            key={
                                              parentI +
                                              '_' +
                                              childI +
                                              '_' +
                                              refI
                                            }
                                          >
                                            Reference {ref} not found
                                          </Evidence>
                                        );
                                      }
                                    }
                                  })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  </section>
                );
              })}
            </section>
          )}
        </section>
      )}
    </>
  );
}

function QuestionHeader(props: any) {
  let question = props.question;
  let text = props.children;
  let header = props.header;
  text = text.replace(
    '{traits}',
    'BMI, obesity, body fat mass, and metabolic traits like glucose tolerance and insulin sensitivity'
  );
  return (
    <div
      className="flex items-center justify-between p-0"
      title={question + '\n' + text}
    >
      <h3 className="m-0">
        {text.substring(0, 3) == 'Yes' && (
          <CheckCircle className="inline text-green-700 -mt-1" size={26} />
        )}
        {text.substring(0, 2) == 'No' && (
          <MinusCircle className="inline text-red-700 -mt-1" size={26} />
        )}{' '}
        {header}
      </h3>
    </div>
  );
}

function Evidence(props: any) {
  const str = (props.children as string) || '';
  return (
    <>
      {!str.includes('study does not') &&
        !str.includes('text does not') &&
        !str.includes('study did not') &&
        !str.includes('text did not') &&
        str.length > 0 && (
          <div className="ml-4">
            <HoverCard openDelay={0}>
              <HoverCardTrigger>
                <ListMagnifyingGlass size={24} />
              </HoverCardTrigger>
              <HoverCardContent
                align="end"
                className="w-96 bg-cyan-100 rounded-xl shadow-xl"
              >
                <div className="text-sm">
                  <>
                    <blockquote className="mb-2 line-clamp-4">
                      &ldquo;{str}&rdquo;
                    </blockquote>
                    <div className="flex items-center justify-between">
                      <a href={'#:~:text=' + str} className="text-sm flex">
                        <ArrowBendRightDown className="mt-1 mr-1" />
                        View in paper
                      </a>

                      <Feedback />
                    </div>
                  </>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        )}
    </>
  );
}
export default PeerResults;
