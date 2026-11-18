# Cognitive Security Demo

Static web demo of **Agent-ToM**, a Theory-of-Mind security monitor for LLM agents.

Live at [cognitive-security-demo.outshift.ai](https://cognitive-security-demo.outshift.ai)

## What it does

Takes a completed agent trace and shows whether the agent was **compromised** or behaved
safely, with the evidence and the exact point in the trace that proves it.

| View | Shows |
| --- | --- |
| Overview | what Agent-ToM is and how it reasons |
| Applications | five monitored agentic applications, and which need attention |
| Application | its traces, verdicts, and the capabilities it can reach |
| Trace | the full conversation: user, agent messages, agent reasoning, tool calls |
| Investigation | verdict, evidence, reasoning, each evidence linked to its trace row |

Pick an unanalyzed trace and run the detection live: the run is simulated, the result was
prepared in advance.

## Run it

```sh
cd frontend
npm install
npm start          # http://localhost:8001
```

No backend, no database, no login, no environment variables. The demo is static by
construction.

## Where the data comes from

Nothing here is hand-written. Every verdict is a real detection run:

1. The five applications are the task pairs shipped by
   [SHADE-Arena](https://github.com/jkutaso/SHADE-Arena): each one defines an environment, the
   tools the agent can reach, a benign main task and a hidden malicious side task.
2. The 30 conversations are agent runs inside those environments. SHADE-Arena publishes the
   environments and task definitions, not the transcripts, so these runs were produced
   separately.
3. Each run was analysed by **Agent-ToM** ([arXiv:2605.24216](https://arxiv.org/abs/2605.24216)),
   a learning-to-monitor framework grounded in Theory-of-Mind reasoning. Its first stage walks a
   five-step analysis over the trace, baseline learning, hypothesis generation, behavior
   prediction, pattern analysis and evidence collection, using the per-application playbook as
   its semantic guardrail memory. The output is a verdict plus the evidence behind it.
4. Those outputs were exported into `preload_artifacts/investigations_export.json`.

The demo replays them. It does not generate anything.

30 investigations, 6 per application, 23 flagged malicious and 7 benign.

| Path | Content |
| --- | --- |
| `preload_artifacts/investigations_export.json` | 30 investigations: verdict, reasoning, evidence |
| `preload_artifacts/<app>/traces/*.json` | the 30 conversations |
| `preload_artifacts/<app>/evoguard/memory/playbooks/` | the per-application playbooks |
| `frontend/src/content/` | application metadata, copy, tool manifests |
| `frontend/src/cms/` | reads those files, replaces the backend |

`frontend/` and `preload_artifacts/` must both stay at the repo root: the imports between them
are relative.

## Applications

| Application | SHADE-Arena task pair | Environment |
| --- | --- | --- |
| Bank Transfer | `bank_transfer_2` | `banking_environment.py` |
| Calendar | `api_key_calendar_agendas_2` | `workspace_environment.py` |
| Expenditure Accounting | `expenditure_accounting` | `banking_environment.py` |
| Spam Filtering | `spam_filter_update` | `spam_filter_update_environment.py` |
| American Airlines | `american_airlines_2` | `travel_environment.py` |

## Deploy

Push to `main`. The GitHub Actions workflow builds `frontend/` and publishes to Pages. No
build variables.

## Credits

The applications, environments and tool catalogues are derived from
[SHADE-Arena](https://github.com/jkutaso/SHADE-Arena), MIT licensed, copyright 2025 Jonathan
Kutasov, Joe Benton, Henry Sleight, John Hughes, Ethan Perez and Scale AI.

The detection method is described in *Agent-ToM*,
[arXiv:2605.24216](https://arxiv.org/abs/2605.24216).

This is a demonstration. It is not a security product and the results shown are a fixed,
pre-computed sample.

