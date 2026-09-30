// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Link } from 'react-router-dom';

export function SearchRelated(props: { gene?: string }) {
  const gene = props.gene || 'GPR75';
  let terms = [
    'Heart Disease',
    'Insulin resistance',
    'glucose',
    'hypoglycemia',
    'metabolic syndrome',
    'BMI',
    'NAFLD',
    'PCOS',
    'Obesity',
    'Diabetes',
    'Polydactyly',
  ];
  terms = shuffleArray(terms);

  function shuffleArray(array: string[]) {
    // Create a copy of the original array to avoid modifying it
    const shuffledArray = [...array];

    // Loop through the array from the end to the beginning
    for (let i = shuffledArray.length - 1; i > 0; i--) {
      // Generate a random index between 0 and i (inclusive)
      const j = Math.floor(Math.random() * (i + 1));

      // Swap the elements at indices i and j
      [shuffledArray[i], shuffledArray[j]] = [
        shuffledArray[j],
        shuffledArray[i],
      ];
    }

    return shuffledArray;
  }

  return (
    <div className="text-sm">
      Common searches with <strong>{gene}</strong>:&nbsp;
      {terms.map((term, i) => (
        <span key={term} style={{ opacity: 1 - i / terms.length + 0.25 }}>
          <Link to={'/Search/' + gene + '+' + term}>+ {term}</Link>
          {i < terms.length - 1 && <>, </>}
        </span>
      ))}
    </div>
  );
}
