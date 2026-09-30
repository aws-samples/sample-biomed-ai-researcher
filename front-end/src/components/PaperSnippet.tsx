// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Link } from 'react-router-dom';
import { Tag } from './Tag';
import { Paper } from '../model';

let myPeer = {
  tags: ['TCF7L2', 'bmi', 'tnip8', 'knockout'],
};

function PaperSnippet(props: { data: Paper }) {
  let { id, title, authors, abstract, date, publication, accesses } = {
    ...props.data,
  };

  return (
    <main>
      <Link to={'/Paper/' + id}>
        <h3 className="line-clamp-2">{title}</h3>
      </Link>

      <small>
        {date}, {publication}, Accesses: {accesses}
      </small>

      <p className="authors line-clamp-1">{authors}</p>
      <div className="flex gap-2 my-2">
        {myPeer.tags.map((t) => {
          return (
            <Link to="/" key={t}>
              <Tag>{t}</Tag>
            </Link>
          );
        })}
      </div>
      <p>{abstract}</p>
    </main>
  );
}
export default PaperSnippet;
