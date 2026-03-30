import React from "react";

import LevelContainer from "@/components/level-container/level-container";
import InteractiveColumn from "@/components/interactive-column/interactive-column";

function Levels() {
  return (
    <div className="relative w-full overflow-hidden px-4 py-6 md:px-8 md:py-8">
      <div className="flex w-full flex-col-reverse md:flex-row md:items-start md:gap-6">
        {/* Main content: takes remaining space on desktop */}
        <main className="w-full md:flex-1">
          <LevelContainer />
        </main>

        {/* Sidebar / interactive column: full width on mobile, fixed width on md+ */}
        <aside className="w-full md:w-80">
          <InteractiveColumn />
        </aside>
      </div>
    </div>
  );
}

export default Levels;
