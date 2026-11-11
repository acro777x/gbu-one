/**
 * GBU One - Typed State Machine Common Contracts
 *
 * Provides shared transition result interfaces and invariant validation contracts
 * for all deterministic state machines across the application.
 */

export interface TransitionResult<TState> {
  /** Whether the transition was valid and accepted by the machine. */
  ok: boolean;
  /** The resulting state after applying or rejecting the transition. */
  state: TState;
  /** Diagnostic error explanation when a transition is rejected as invalid. */
  error?: string;
}

export interface InvariantValidationResult {
  /** Whether all domain invariants for this state hold true. */
  valid: boolean;
  /** List of broken invariants or safety violations, empty when valid. */
  violations: string[];
}
