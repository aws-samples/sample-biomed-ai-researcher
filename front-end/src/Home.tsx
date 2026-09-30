// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import PeerPane from './components/PeerPane';

function Home() {
  return (
    <>
      <main>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex justify-center">
            <img src="./logo.svg" width="300" />
          </div>
          <section className="lg:w-8/12 mx-auto mt-14">
            <PeerPane />
          </section>
        </div>
      </main>
    </>
  );
}

export default Home;
