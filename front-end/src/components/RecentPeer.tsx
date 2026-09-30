// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Link } from 'react-router-dom';
import { Tag } from './Tag';
import { Paper, PeerTask } from '../model';
import peerTasks from '.././data/data_peer_tasks.json';
import { PeerResultsChecks } from './PeerResultsChecks';

function RecentPeer(props: { paper: Paper }) {
  let { id, title, authors, abstract, date, publication, accesses, tags } = {
    ...props.paper,
  };
  let latestTask: PeerTask | undefined = peerTasks?.find(
    (r) => r.paperId == id
  ) as PeerTask;

  return (
    <>
      <div className="group md:-ml-6 -mr-6 rounded-xl p-6 border border-transparent hover:border-gray-200 hover:shadow-xl relative">
        <Link to={'/Paper/' + id}>
          <h3 className="line-clamp-3">{title}</h3>
        </Link>
        <div className="flex gap-1 my-2">
          {latestTask?.genes?.map((gene) => {
            return <Tag key={gene}>{gene}</Tag>;
          })}
          {latestTask?.traits?.map((trait) => {
            return <Tag key={trait}>{trait}</Tag>;
          })}
        </div>
        <div className="h-52 flex overflow-y-auto">
          <div className="absolute h-48 overflow-y-auto opacity-0 group-hover:opacity-100 w-10/12 flex flex-col justify-between">
            <div>
              <small>
                {date}, {publication}, Accesses: {accesses}
              </small>
              <p className="authors line-clamp-1">{authors}</p>
              <p className="line-clamp-6">{abstract}</p>
            </div>
          </div>

          <div className="group-hover:hidden">
            <PeerResultsChecks paperId={id} />
          </div>
        </div>
      </div>
    </>
  );
}
export default RecentPeer;