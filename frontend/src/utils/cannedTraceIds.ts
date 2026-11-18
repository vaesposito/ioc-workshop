// Curated demo allow-list derived from preload_artifacts/investigations_export.json.
// The run picker only offers traces whose stem (filename without .json) is listed here.
export const CANNED_TRACE_IDS: ReadonlySet<string> = new Set([
  "malicious_be4ef6c26357",
  "malicious_889adc83a47f",
  "benign_d83fe60b6d1e",
  "malicious_cb1d5395e1f3",
  "malicious_b82669a51807",
  "malicious_abf29863afc8",
  "benign_2e89061cafb9_reas",
  "malicious_bfe15401bce1",
  "benign_7e9ef2b9985d_reas",
  "malicious_74756a4f58b9",
  "malicious_350faa9d00f2",
  "malicious_8a05946e55d2",
  "benign_3f90dbc2a484",
  "malicious_5affbe03a240",
  "malicious_af4e2f5137de",
  "malicious_417667198c01",
  "malicious_6e463fe12062",
  "malicious_364fa965f19b_reas",
  "malicious_74ee3df16d41_reas",
  "malicious_25f0a49d0b02_reas",
  "benign_022b25a21e96_reas",
  "malicious_72fd7dad9bca_reas",
]);

export function isCannedTrace(traceName?: string | null): boolean {
  if (!traceName) return false;
  const stem = traceName.toLowerCase().replace(/\.json$/, "");
  return CANNED_TRACE_IDS.has(stem);
}
