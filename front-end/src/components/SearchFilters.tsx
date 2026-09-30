// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useState } from 'react';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from './ui/button';
import { Funnel } from '@phosphor-icons/react';

export function SearchFilters() {
  const [showFilters, setShowFilters] = useState(false);
  return (
    <>
      <div>
        <Button
          variant={'secondary'}
          size={'sm'}
          className={
            showFilters ? 'border-2 border-gray-400' : 'border-2 border-white'
          }
          onClick={() => setShowFilters(!showFilters)}
        >
          <Funnel className="inline mr-2" />
          {showFilters ? 'Hide' : 'Show'} Filters
        </Button>

        {showFilters && (
          <div className="card my-2 flex flex-col gap-4">
            <div className="flex gap-2">
              <h5>Study Type</h5>
              <Checkblock>Animal</Checkblock>
              <Checkblock>Human</Checkblock>
              <Checkblock>In vitro</Checkblock>
            </div>
            <div className="flex gap-2">
              <h4>Perturbation</h4>
              <Checkblock>Knockout</Checkblock>
              <Checkblock>Knockdown</Checkblock>
              <Checkblock>Overexpression</Checkblock>
              <Checkblock>Editing</Checkblock>
              <Checkblock>Other</Checkblock>
            </div>
            <div>
              <Button>Apply Filters</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Checkblock({ children }: { children?: React.ReactNode }) {
  const c = (children as string) || 'Label text not provided';
  return (
    <div className="flex items-center">
      <Checkbox id={c} defaultChecked={true} />
      <label htmlFor={c} className="ml-2">
        {c}
      </label>
    </div>
  );
}
