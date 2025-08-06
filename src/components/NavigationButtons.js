import React from 'react';

export function NavigationButtons({
  onPrevious,
  onNext,
  canNavigatePrevious,
  canNavigateNext
}) {
  return (
    <div className="flex justify-center gap-4">
      <button
        className="btn-nav"
        onClick={onPrevious}
        disabled={!canNavigatePrevious}
        title="Previous floor/location/region"
      >
        <span className="text-lg">&#8249;</span>
        Previous
      </button>
      
      <button
        className="btn-nav"
        onClick={onNext}
        disabled={!canNavigateNext}
        title="Next floor/location/region"
      >
        Next
        <span className="text-lg">&#8250;</span>
      </button>
    </div>
  );
}