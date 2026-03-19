import { memo } from "react";
import { Globe, LoaderCircle, Radio } from "lucide-react";

import type { ComputerPanelData } from "./computerPanelTypes";
import { formatAsciiPreview, hex } from "./computerPanelUtils";

function ComputerNetworkCardInner({ data }: { data: ComputerPanelData }) {
  const responsePreview = formatAsciiPreview(data.networkResponseBuffer, 120);
  const displayMethod = data.networkPending
    ? data.networkMethod
    : data.networkCompletedUrl
      ? data.networkCompletedMethod
      : data.networkMethod;
  const displayUrl = data.networkPending
    ? data.networkUrl
    : data.networkCompletedUrl || data.networkUrl;
  const displayBody = data.networkPending
    ? data.networkBody
    : data.networkCompletedBody || data.networkBody;
  const completedResponseText =
    data.networkCompletedResponseText ||
    (!data.networkCompletedStatus ? "" : "(empty)");

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-200">
          <Globe size={16} className="text-sky-300" />
          <h3 className="text-sm font-semibold">Network Controller</h3>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            data.networkPending
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : data.networkCompletedStatus.startsWith("HTTP ERROR")
                ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                : "border-slate-700 bg-slate-900 text-slate-300"
          }`}
        >
          {data.networkPending
            ? "Pending"
            : data.networkCompletedStatus || data.networkStatus || "Idle"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-200">
          {data.networkPending ? (
            <LoaderCircle size={15} className="animate-spin text-amber-300" />
          ) : (
            <Radio size={15} className="text-sky-300" />
          )}
          {displayMethod}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-300">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">URL</div>
          <div className="mt-1 break-all font-mono">
            {displayUrl || "No request yet"}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Request body</div>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950/70 p-3 font-mono text-xs text-slate-300">
            {displayBody || "(empty)"}
          </pre>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Response buffer</div>
          <div className="mt-2 grid gap-2 text-xs text-slate-300">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              bytes available: <span className="font-mono">{data.networkResponseBuffer.length}</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              last byte: <span className="font-mono">{hex(data.networkLastByte)} / {data.networkLastByte}</span>
            </div>
            <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs text-slate-400">
              {responsePreview || "(no response bytes yet)"}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[auto_1fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-200">
          Last status
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-300">
          <div className="font-mono">
            {data.networkCompletedStatus || data.networkStatus || "No completed request yet"}
          </div>
        </div>
      </div>

      <details className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3" open>
        <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Last completed request
        </summary>
        <div className="mt-3 grid gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-semibold">
              {data.networkCompletedMethod}
            </span>
            <span className="break-all font-mono text-xs text-slate-400">
              {data.networkCompletedUrl || "No completed request yet"}
            </span>
          </div>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950/70 p-3 font-mono text-xs text-slate-300">
            {data.networkCompletedBody || "(empty)"}
          </pre>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Last completed response body
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950/70 p-3 font-mono text-xs text-slate-300">
            {completedResponseText || "No completed response yet"}
          </pre>
        </div>
      </details>

      <details className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3" open>
        <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Recent requests
        </summary>
        <div className="mt-3 max-h-96 space-y-3 overflow-auto">
          {data.networkHistory.length === 0 ? (
            <div className="rounded-lg bg-slate-950/70 px-3 py-3 text-xs text-slate-500">
              No completed request yet
            </div>
          ) : (
            data.networkHistory.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-semibold text-slate-200">
                    {entry.method}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      entry.status.startsWith("HTTP ERROR")
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                        : "border-slate-700 bg-slate-900 text-slate-300"
                    }`}
                  >
                    {entry.status}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">#{entry.id}</span>
                </div>
                <div className="mt-2 break-all font-mono text-xs text-sky-300">
                  {entry.url || "(no url)"}
                </div>
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      Request body
                    </div>
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-300">
                      {entry.requestBody || "(empty)"}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      Response body
                    </div>
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-300">
                      {entry.responseText || "(empty)"}
                    </pre>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </details>
    </section>
  );
}

export const ComputerNetworkCard = memo(
  ComputerNetworkCardInner,
  (prev, next) =>
    prev.data.networkMethod === next.data.networkMethod &&
    prev.data.networkUrl === next.data.networkUrl &&
    prev.data.networkBody === next.data.networkBody &&
    prev.data.networkStatus === next.data.networkStatus &&
    prev.data.networkPending === next.data.networkPending &&
    prev.data.networkLastByte === next.data.networkLastByte &&
    prev.data.networkResponseBuffer === next.data.networkResponseBuffer &&
    prev.data.networkCompletedMethod === next.data.networkCompletedMethod &&
    prev.data.networkCompletedUrl === next.data.networkCompletedUrl &&
    prev.data.networkCompletedBody === next.data.networkCompletedBody &&
    prev.data.networkCompletedStatus === next.data.networkCompletedStatus &&
    prev.data.networkCompletedResponseText ===
      next.data.networkCompletedResponseText &&
    prev.data.networkHistory === next.data.networkHistory,
);
