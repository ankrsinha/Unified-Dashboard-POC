import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useTransition,
  type DependencyList,
} from "react";

/**
 * React 19 async data loading via useActionState — isPending replaces manual loading flags.
 * Dispatch runs inside startTransition (required for async useActionState actions).
 */
export function useAsyncAction<State, Arg>(
  action: (previousState: State, arg: Arg) => Promise<State>,
  initialState: State,
  arg: Arg,
  deps: DependencyList,
  enabled = true,
) {
  const [state, dispatch, isPending] = useActionState(action, initialState);
  const [transitionPending, startTransition] = useTransition();
  const argRef = useRef(arg);
  argRef.current = arg;

  const dispatchArg = useCallback(() => {
    startTransition(() => {
      void dispatch(argRef.current);
    });
  }, [dispatch, startTransition]);

  useEffect(() => {
    if (!enabled) return;
    dispatchArg();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller lists fields that match arg
  }, [enabled, dispatchArg, ...deps]);

  return {
    state,
    isPending: isPending || transitionPending,
    reload: dispatchArg,
  };
}
