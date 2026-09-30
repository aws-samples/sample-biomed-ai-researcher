// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import data from './data/data_papers.json';
import { useEffect, useState } from 'react';
import { useToast } from './components/ui/use-toast';
import PaperSnippet from './components/PaperSnippet';
import { SearchOverview } from './components/SearchOverview';
import { Paper } from './model';
import { SearchRelated } from './components/SearchRelated';
import { SearchFilters } from './components/SearchFilters';
import { useParams } from 'react-router-dom';

function Search() {
  const { query } = useParams();
  const [papers, setPapers] = useState<Paper[]>([]);
  const { toast } = useToast();
  useEffect(() => {
    setPapers(data);
  }, []);

  return (
    <>
      <div className="flex">
        <main className="relative max-w-[1200px]">
          <header className="feature-card mb-12 lg:w-3/4">
            <SearchOverview />
          </header>
          <h2 className="text-cyan-800 w-9/12 mb-4">
            Results for &ldquo;{query}&rdquo;
          </h2>
          <section className="flex flex-col gap-12 max-w-[1200px]">
            <SearchRelated />
            <SearchFilters />
            {papers?.map((p, i) => {
              return (
                <div key={i}>
                  <PaperSnippet data={p} />
                </div>
              );
            })}
          </section>
        </main>
      </div>
    </>
  );
}

export default Search;
