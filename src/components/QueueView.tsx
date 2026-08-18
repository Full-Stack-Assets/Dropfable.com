import { useEffect, useState } from "react";
import { Loader2, Trash2, RefreshCw } from "lucide-react";
import { parseJsonResponse } from "../lib/http";
import { authHeaders } from "../lib/billingClient";

interface QueueTask {
  id: string;
  productId: string;
  productName: string;
  niche: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export function QueueView() {
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch("/api/queue", { headers: authHeaders() });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "Failed to load queue.");
      setTasks(data.tasks || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Queue API is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, []);

  const clearDone = async () => {
    await fetch("/api/queue/clear", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() } });
    refresh();
  };

  const removeTask = async (id: string) => {
    await fetch(`/api/queue/tasks/${id}`, { method: "DELETE", headers: authHeaders() });
    refresh();
  };

  const pending = tasks.filter((t) => t.status === "pending" || t.status === "processing").length;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-light tracking-tight text-gray-900">Generation Queue</h2>
          <p className="text-sm text-gray-500 mt-1">{pending} in flight. Completed jobs stay until you clear them.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button onClick={clearDone} className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
            Clear done
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>}
      {loading && <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />}

      {!loading && tasks.length === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl text-sm text-gray-500">
          No queued jobs. Use batch manufacture to add niches without blocking the browser.
        </div>
      )}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-gray-900">{task.productName} · {task.niche}</div>
              <div className="text-xs text-gray-500 mt-1 capitalize">{task.status}{task.error ? ` — ${task.error}` : ""}</div>
            </div>
            <button onClick={() => removeTask(task.id)} className="p-2 text-gray-400 hover:text-red-600" title="Remove">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
