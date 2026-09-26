"use client";

import { useEffect, useState } from "react";
import { Download, Cloud, CheckCircle2, XCircle, Terminal } from "lucide-react";
import { Card, SectionHeading, Button, Badge } from "@/components/ui";

const EXPORT_TYPES = [
  { type: "meals", label: "Nutrition log" },
  { type: "workouts", label: "Workout log" },
  { type: "weights", label: "Body metrics" },
];

export default function SettingsPage() {
  const [sheetsConfigured, setSheetsConfigured] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/export/sheets")
      .then((r) => r.json())
      .then((d) => setSheetsConfigured(d.configured));
  }, []);

  async function syncToSheets(type: string) {
    setSyncing(type);
    setSyncResult((prev) => ({ ...prev, [type]: "" }));
    try {
      const res = await fetch("/api/export/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      setSyncResult((prev) => ({ ...prev, [type]: data.ok ? "Synced ✓" : data.error }));
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div>
      <SectionHeading title="Settings" subtitle="Export your data, connect Google Sheets, and set up the Claude connector." />

      <div className="space-y-6">
        <Card>
          <h3 className="mb-1 font-medium">Export to CSV</h3>
          <p className="mb-4 text-sm text-secondary">
            Download your full history as a CSV file — opens in Excel, Numbers, or Google Sheets.
          </p>
          <div className="flex flex-wrap gap-2">
            {EXPORT_TYPES.map((e) => (
              <a key={e.type} href={`/api/export/csv?type=${e.type}`} download>
                <Button variant="secondary" size="sm">
                  <Download size={14} /> {e.label}
                </Button>
              </a>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-medium">Google Sheets sync</h3>
            {sheetsConfigured === true && (
              <Badge tone="green">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={11} /> Connected
                </span>
              </Badge>
            )}
            {sheetsConfigured === false && (
              <Badge>
                <span className="flex items-center gap-1">
                  <XCircle size={11} /> Not configured
                </span>
              </Badge>
            )}
          </div>
          <p className="mb-4 text-sm text-secondary">
            Push your data straight into a Google Sheet so it stays live and easy to share or review.
          </p>

          {sheetsConfigured === false && (
            <div className="mb-4 rounded-lg bg-sunken p-3 text-xs text-secondary">
              <p className="mb-2 font-medium text-primary">Setup (one-time):</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  Create a Google Cloud service account and enable the{" "}
                  <span className="font-mono">Google Sheets API</span>.
                </li>
                <li>Create a Google Sheet and share it with the service account&apos;s email (Editor access).</li>
                <li>
                  Add <span className="font-mono">GOOGLE_SERVICE_ACCOUNT_EMAIL</span>,{" "}
                  <span className="font-mono">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</span>, and{" "}
                  <span className="font-mono">GOOGLE_SHEET_ID</span> to your <span className="font-mono">.env</span>{" "}
                  file, then restart the app.
                </li>
              </ol>
              <p className="mt-2">See the README for the full walkthrough.</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {EXPORT_TYPES.map((e) => (
              <div key={e.type} className="flex items-center justify-between">
                <span className="text-sm">{e.label}</span>
                <div className="flex items-center gap-2">
                  {syncResult[e.type] && <span className="text-xs text-muted">{syncResult[e.type]}</span>}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!sheetsConfigured || syncing === e.type}
                    onClick={() => syncToSheets(e.type)}
                  >
                    <Cloud size={14} /> {syncing === e.type ? "Syncing..." : "Sync"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-1 flex items-center gap-2">
            <Terminal size={16} />
            <h3 className="font-medium">Claude connector (MCP)</h3>
          </div>
          <p className="mb-4 text-sm text-secondary">
            Control this app in plain language from Claude Desktop or Claude Code — log meals, log
            workouts, generate meal plans, and check your progress just by asking.
          </p>
          <div className="rounded-lg bg-sunken p-3 text-xs text-secondary">
            <p className="mb-2 font-medium text-primary">Add to your Claude config:</p>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono">
{`{
  "mcpServers": {
    "fitful": {
      "command": "npx",
      "args": ["tsx", "mcp-server/index.ts"],
      "cwd": "<path to this project>"
    }
  }
}`}
            </pre>
            <p className="mt-2">
              Then try: <span className="font-mono">&quot;Log 2 eggs and a banana for breakfast&quot;</span> or{" "}
              <span className="font-mono">&quot;Build me a 3-day high-protein Mexican meal plan&quot;</span>.
            </p>
          </div>
        </Card>

        <Card>
          <h3 className="mb-1 font-medium">Nutrition data source</h3>
          <p className="text-sm text-secondary">
            Food search combines a curated local library with live results from the public{" "}
            <span className="font-mono">USDA FoodData Central</span> API. For higher rate limits, get a free
            key at fdc.nal.usda.gov/api-key-signup.html and set <span className="font-mono">FDC_API_KEY</span> in
            your <span className="font-mono">.env</span>.
          </p>
        </Card>
      </div>
    </div>
  );
}
