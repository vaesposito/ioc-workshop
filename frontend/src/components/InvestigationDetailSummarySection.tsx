interface InvestigationDetailSummarySectionProps {
  techniqueLabel: string;
  investigationName: string;
  updatedAt: string;
  traceCount: number;
}

export function InvestigationDetailSummarySection({
  techniqueLabel,
  investigationName,
  updatedAt,
  traceCount,
}: InvestigationDetailSummarySectionProps) {
  return (
    <aside className="ioc-hairline border-t p-4 lg:col-span-2 lg:border-t-0">
      <div className="mb-3">
        <h2 className="ioc-kicker">Run summary</h2>
        <p className="ioc-copy mt-1.5 text-[12.5px] leading-[1.4]">
          Detective Agent · {techniqueLabel}
        </p>
        <p className="ioc-copy mt-1 text-[12.5px] font-light leading-[1.4]">
          {investigationName}
        </p>
      </div>

      <div className="ioc-hairline border-t pt-3 text-[12.5px]">
        <div className="space-y-2.5">
          <div>
            <p className="ioc-kicker">Updated</p>
            <p className="ioc-copy mt-1.5 text-[12px] font-light leading-[1.45]">
              {updatedAt}
            </p>
          </div>
          <div>
            <p className="ioc-kicker">Traces</p>
            <p className="ioc-copy mt-1.5 text-[12px] font-light leading-[1.45]">
              {traceCount}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
