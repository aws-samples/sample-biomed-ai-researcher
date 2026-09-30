// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Dna, PersonArmsSpread } from '@phosphor-icons/react';
import sampleGenes from '.././data/data_genes.json';
import sampleTraits from '.././data/data_traits.json';

import { Combobox } from './Combobox';

interface PeerametersProps {
  gene?: string;
  onGeneChange?: (value: string) => void;
  condition?: string;
  onConditionChange?: (value: string) => void;
}

export function Peerameters(props: PeerametersProps = {}) {
  return (
    <div className="@container">
      <section className="flex flex-col @lg:flex-row items-center gap-2">
        <div className="flex grow items-center gap-2 w-full">
          <Dna className="inline w-8" size={24} />
          <Combobox
            label="Select a Gene"
            items={sampleGenes}
            value={props.gene}
            onChange={props.onGeneChange}
          />
        </div>

        <span className="hidden @lg:block text-3xl text-gray-400">&#215;</span>
        <div className="flex grow items-center gap-2 w-full">
          <PersonArmsSpread className="inline w-8" size={24} />

          <Combobox
            label="Select a Phenotype"
            items={sampleTraits}
            value={props.condition}
            onChange={props.onConditionChange}
          />
        </div>
      </section>
    </div>
  );
}
