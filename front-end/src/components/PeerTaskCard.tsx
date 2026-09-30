// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { FlagBanner, DotsThreeCircle } from '@phosphor-icons/react';
import { Progress } from './ui/progress';
import { useContext, useEffect, useState } from 'react';
import { ChevronRight, Microscope } from 'lucide-react';
import { Button } from './ui/button';

import { AsideContext } from '../App';
import { Link } from 'react-router-dom';

type Status = 'Initiating' | 'Peering' | 'Finishing' | 'Completed' | 'Error';
const statuses: Status[] = ['Initiating', 'Peering', 'Finishing', 'Completed'];

export function PeerTaskCard(props: {
  title: string;
  status: number;
  id: number;
  paperId: string;
}) {
  const { removePeerTask } = useContext(AsideContext);
  const paperId = props.paperId;
  const [title, setTitle] = useState(props.title);
  const id = props.id;
  const [status, setStatus] = useState(props.status);
  const [count, setCount] = useState<number>(0);
  const [statusText, setStatusText] = useState(statuses[props.status]);
  useEffect(() => {
    setTitle(props.title);
  }, [props]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (count < 3) {
        setCount(count + 1);
      } else {
        clearInterval(interval);
      }
    }, 2500);

    setStatusText(statuses[count]);

    return () => clearInterval(interval);
  }, [count]);

  return (
    <>
      {
        <div className={statusText != 'Completed' ? 'peer-task card' : 'card'}>
          <div className="flex items-start gap-1 justify-between  text-sm">
            Peer #{id}
            {statusText != 'Completed' && (
              <header className="flex items-center mb-2">
                <span className="flex items-center gap-1">
                  {statusText === 'Initiating' ? (
                    <>
                      <FlagBanner size={18} />
                      <strong>Initiating</strong>
                    </>
                  ) : (
                    'Initiating'
                  )}
                </span>
                <ChevronRight size={18} />
                <span className="flex items-center gap-1">
                  {statusText === 'Peering' ? (
                    <>
                      <Microscope size={18} />
                      <strong>Peering</strong>
                    </>
                  ) : (
                    'Peering'
                  )}
                </span>
                <ChevronRight size={18} />
                <span className="flex items-center gap-1">
                  {statusText === 'Finishing' ? (
                    <>
                      <DotsThreeCircle size={18} className="inline" />
                      <strong>Finishing</strong>
                    </>
                  ) : (
                    'Finishing'
                  )}
                </span>
                <ChevronRight size={18} />
                Done
              </header>
            )}
          </div>
          <div>
            {statusText == 'Initiating' ? (
              <h4>Extracting title...</h4>
            ) : (
              <h4>{title}</h4>
            )}
            {statusText != 'Completed' ? (
              <div className="w-3/4 mt-3">
                <div>
                  <Progress value={(count * 90) / 2} className="border" />
                  <small> About 8 minutes left</small>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <Link to={'/Paper/' + paperId}>
                  <Button size="sm">View</Button>
                </Link>
                <Button
                  size="sm"
                  variant="link"
                  onClick={() => removePeerTask(id)}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        </div>
      }
    </>
  );
}
