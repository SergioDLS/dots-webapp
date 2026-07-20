import React from "react";

import PathContainer from "@/components/path/path-container";
import InteractiveColumn from "@/components/interactive-column/interactive-column";

function Levels() {
  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex w-full flex-col-reverse md:flex-row md:items-start md:gap-8">
        {/* Main content: takes remaining space on desktop */}
        <main className="w-full min-w-0 md:flex-1">
          <PathContainer />
        </main>

        {/* Sidebar: full width on mobile, fixed width on md+ */}
        <aside className="w-full md:w-80 md:shrink-0">
          <InteractiveColumn />
        </aside>
      </div>
    </div>
  );
}

export default Levels;
