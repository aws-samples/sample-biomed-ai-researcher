  // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
  import {
    Clipboard,
    FilePdf,
    Globe,
    UploadSimple,
  } from '@phosphor-icons/react';
  import { Button } from './ui/button';
  import { Input } from './ui/input';
  import { useContext, useRef, useState } from 'react';
  import { AsideContext } from '../App';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

  import { Peerameters } from './Peerameters';
  import { Textarea } from './ui/textarea';
  import { useNavigate } from 'react-router-dom';
  import { apiClient } from '../api';
  function PeerPane() {
    const { addPeerTask, setShowPane } = useContext(AsideContext);
    const navigate = useNavigate();
    const [sourceText, setSourceText] = useState('');
    const [filename, setFilename] = useState<string>('');
    const [sourceUrl, setSourceUrl] = useState<string>('');
    const [gene, setGene] = useState<string>('');
    const [condition, setCondition] = useState<string>('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDivClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setFilename(file.name);
        setSelectedFile(file);
      }
    };

    // Add this new state for the file
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // Add loading state
  const [isUploading, setIsUploading] = useState(false);
  // Add error state
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadDocument = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file first');
      return null;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const conditionList = condition ? [condition] : [];
      const geneList = gene ? [gene] : [];
      const data = await apiClient.uploadDocument(selectedFile, conditionList, geneList);

      console.log('Upload successful:', data);

      // Clear the form
      setFilename('');
      setSelectedFile(null);
      setGene('');
      setCondition('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      return data.file_id;

    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      console.error('Upload error:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

    async function initializePeer() {
      const fileId = await uploadDocument();
      if (fileId) {
        setSourceText('');
        setFilename('');
        addPeerTask();
        setShowPane(false); // Close sidebar after upload
        navigate(`/Paper/${fileId}`);
      }
    }
    return (
      <>
        <section className="card">
          <header className="flex justify-between mb-4">
            <h3>Peer into a Paper</h3>
          </header>
          <main className="flex flex-col gap-2">
            <Tabs defaultValue="upload">
              <TabsList className="flex">
                <TabsTrigger value="paste" className="hideme">
                  <Clipboard size={24} className="mr-1" /> Paste
                </TabsTrigger>
                <TabsTrigger value="upload" className="grow">
                  <UploadSimple size={24} className="mr-1" /> Upload 
                </TabsTrigger>
                <TabsTrigger value="url" className="hideme">
                  <Globe size={24} className="mr-1" /> PubMed ID
                </TabsTrigger>
              </TabsList>
              <TabsContent value="paste">
                <div className="flex gap-2 flex-col">
                  <Textarea
                    className="h-36"
                    placeholder="Paste the paper text"
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                  />
                </div>
              </TabsContent>
              <TabsContent value="upload">
                <div
                  className="border rounded border-dashed rounded-md border-cyan-500 h-36 items-center flex justify-center bg-cyan-100 hover:bg-cyan-200"
                  onClick={handleDivClick}
                >
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    ref={fileInputRef}
                    accept="pdf"
                    onChange={handleFileChange}
                  />
                  {filename.length == 0 ? (
                    <>
                      Drop a file , or{' '}
                      <a className="mx-1 cursor-pointer">browse files</a> to
                      upload.
                    </>
                  ) : (
                    <div className="p-1 px-2 flex flex-col items-center cursor:default">
                      <FilePdf size={48} weight="thin" />
                      <p>{filename}</p>
                    </div>
                  )}
                </div>
                {isUploading && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-cyan-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                    </div>
                    <p className="text-sm text-gray-600">Processing your document...</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="url">
                <div className="flex items-center gap-2 h-24">
                  <Input
                    type="text"
                    defaultValue={sourceUrl}
                    placeholder="Enter a PubMed ID or URL"
                    onChange={(e) => setSourceUrl(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        addPeerTask();
                      }
                    }}
                  />
                </div>
              </TabsContent>
            </Tabs>
            {(sourceUrl?.length > 0 ||
              filename?.length > 0 ||
              sourceText?.length > 0) && (
              <>
                <Peerameters
                  gene={gene}
                  onGeneChange={setGene}
                  condition={condition}
                  onConditionChange={setCondition}
                />
                <Button
                  className="w-full my-2" 
                  onClick={() => initializePeer()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Processing...' : 'Start'}
                </Button>
                {uploadError && (
                  <div className="text-red-600 text-sm mt-2">
                    {uploadError}
                  </div>
                )}
              </>
            )}
          </main>
        </section>
      </>
    );
  }

  export default PeerPane;
