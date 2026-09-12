export {describeError, classifyError} from './describeError';
export type {DescribeErrorOptions, ErrorFailureClass} from './describeError';
export {
  buildDiagnosticReport,
  clearDiagnostics,
  DIAGNOSTIC_ENTRY_LIMIT,
  DIAGNOSTIC_STORAGE_KEY,
  listDiagnostics,
  recordDiagnostic,
  redactDiagnosticText,
  registerDiagnosticSecrets,
  resetDiagnosticsForTests,
  subscribeDiagnostics
} from './diagnostics';
export type {DiagnosticEntry, DiagnosticFailureClass} from './diagnostics';
export {installGlobalDiagnosticCapture} from './globalCapture';
