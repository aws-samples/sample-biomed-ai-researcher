// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import PeerPane from './components/PeerPane';
import { useLocation } from 'react-router-dom';
import { createContext, useState } from 'react';
import { Navigation } from './components/Navigation';
import { PeerTask } from './model';
import { CaretLeft } from '@phosphor-icons/react';
import samplePeerTasksJson from './data/data_peer_tasks.json';
const typedPeerTasks = samplePeerTasksJson as unknown as PeerTask[];
//const samplePeerTasks: PeerTask[] = (await import('./data_peer_tasks.json')).default;

interface AsideContextValue {
  showPane: boolean;
  setShowPane: React.Dispatch<React.SetStateAction<boolean>>;
  peerTasks: PeerTask[];
  addPeerTask: (task?: PeerTask) => void;
  removePeerTask: (id: number) => void;
}
export const AsideContext = createContext<AsideContextValue>({
  showPane: false,
  setShowPane: () => {},
  peerTasks: [],
  addPeerTask: () => {},
  removePeerTask: () => {},
});

function App() {
  const [showPane, setShowPane] = useState(false);
  const [peerTasks, setPeerTasks] = useState([typedPeerTasks[0]]);
  const location = useLocation();

  function addPeerTask(newTask?: PeerTask) {
    if (!newTask) {
      const baseTask =
        typedPeerTasks[Math.floor(Math.random() * typedPeerTasks.length)];
      const newId = Math.ceil(Math.random() * 10000 + 1);
      newTask = {
        ...baseTask,
        id: newId,
      };
    }
    setShowPane(true);
    setPeerTasks([...peerTasks, newTask]);
  }
  function removePeerTask(id: number) {
    const t = peerTasks.filter((task) => task.id !== id);
    setPeerTasks(t);
  }

  return (
    <>
      <AsideContext.Provider
        value={{
          showPane,
          setShowPane,
          peerTasks,
          addPeerTask,
          removePeerTask,
        }}
      >
        <main className="flex overflow-hidden">
          <Navigation />
          <aside
            className={
              !showPane
                ? 'transition-all duration-500 w-[500px] left-[-500px] h-full fixed p-4 pt-0 z-20'
                : 'transition-all duration-500 w-[500px] left-0 overflow-hidden overflow-y-auto h-full fixed px-4 pt-0 z-20'
            }
            style={{
              backgroundImage:
                'linear-gradient(90deg, #f5f5f5 490px, #d8d8d8 500px)',
              direction: 'rtl',
            }}
          >
            <header
              className="sticky justify-end flex -mr-4 ltr"
              style={{ direction: 'ltr' }}
            >
              <button
                className="bg-white shadow p-2 rounded-es-lg cursor-pointer hover:text-cyan-800"
                onClick={() => setShowPane(false)}
              >
                <CaretLeft size={24} />
              </button>
            </header>

            <div className="mt-4" style={{ direction: 'ltr' }}>
              <PeerPane />
            </div>
          </aside>

          <main
            className={
              showPane
                ? 'xl:left-[500px] relative duration-500 transition-padding w-full bgwhite mt-16'
                : 'xl:left-0 relative duration-500 transition-padding w-full mt-16'
            }
          >
            {location.pathname !== '/' && <Header />}
            <div
              className={
                location.pathname !== '/' ? 'px-10 xl:pl-[250px]' : 'px-10'
              }
            >
              <Outlet />
            </div>
          </main>
        </main>
      </AsideContext.Provider>
    </>
  );
}

export default App;
