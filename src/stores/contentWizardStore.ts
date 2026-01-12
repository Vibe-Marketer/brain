import { create } from 'zustand';
import type {
  ContentWizardState,
  WizardStep,
  AgentStatus,
  ClassificationResult,
  Insight,
  Hook,
  StreamingContent,
} from '@/types/content-hub';
import { initialWizardState } from '@/types/content-hub';

/**
 * Step order for navigation
 */
const STEP_ORDER: WizardStep[] = [
  'select-sources',
  'extract-analyze',
  'generate-hooks',
  'create-content',
];

/**
 * Convert Map-based initialWizardState to Record-based for Zustand compatibility
 */
const getInitialState = (): ContentWizardStoreState => ({
  current_step: initialWizardState.current_step,
  selected_calls: initialWizardState.selected_calls,
  selected_profile_id: initialWizardState.selected_profile_id,
  classification_status: initialWizardState.classification_status,
  insights_status: initialWizardState.insights_status,
  hooks_status: initialWizardState.hooks_status,
  content_status: initialWizardState.content_status,
  classification_result: initialWizardState.classification_result,
  generated_insights: initialWizardState.generated_insights,
  generated_hooks: initialWizardState.generated_hooks,
  selected_hook_ids: initialWizardState.selected_hook_ids,
  generated_content: {}, // Use Record instead of Map for Zustand serialization
  error: initialWizardState.error,
});

/**
 * Store state type (uses Record instead of Map for Zustand compatibility)
 */
interface ContentWizardStoreState extends Omit<ContentWizardState, 'generated_content'> {
  generated_content: Record<string, StreamingContent>;
}

/**
 * Content Wizard Store Actions
 */
interface ContentWizardActions {
  // Navigation actions
  setCurrentStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: WizardStep) => void;
  canProceedToStep: (step: WizardStep) => boolean;

  // Selection actions
  setSelectedCalls: (ids: number[]) => void;
  toggleCall: (id: number) => void;
  setSelectedProfile: (id: string | null) => void;

  // Agent status actions
  setClassificationStatus: (status: AgentStatus) => void;
  setInsightsStatus: (status: AgentStatus) => void;
  setHooksStatus: (status: AgentStatus) => void;
  setContentStatus: (status: AgentStatus) => void;

  // Result actions
  setClassificationResult: (result: ClassificationResult | null) => void;
  setGeneratedInsights: (insights: Insight[]) => void;
  setGeneratedHooks: (hooks: Hook[]) => void;
  addGeneratedHook: (hook: Hook) => void;

  // Hook selection actions
  toggleHookSelection: (id: string) => void;
  selectAllHooks: () => void;
  deselectAllHooks: () => void;

  // Streaming content actions
  initStreamingContent: (hookId: string) => void;
  appendStreamingContent: (
    hookId: string,
    field: 'social_post_text' | 'email_subject' | 'email_body_opening',
    delta: string
  ) => void;
  finalizeStreamingContent: (hookId: string) => void;
  markContentSaved: (hookId: string) => void;

  // Error and reset actions
  setError: (error: string | null) => void;
  resetToStep: (step: WizardStep) => void;
  reset: () => void;
}

/**
 * Content Wizard Zustand Store
 *
 * Manages local state for the 4-step content generation wizard.
 * This is a local state store - no database operations.
 */
export const useContentWizardStore = create<ContentWizardStoreState & ContentWizardActions>(
  (set, get) => ({
    // Initial state
    ...getInitialState(),

    // Navigation actions
    setCurrentStep: (step: WizardStep) => {
      set({ current_step: step });
    },

    nextStep: () => {
      const { current_step } = get();
      const currentIndex = STEP_ORDER.indexOf(current_step);
      if (currentIndex < STEP_ORDER.length - 1) {
        set({ current_step: STEP_ORDER[currentIndex + 1] });
      }
    },

    prevStep: () => {
      const { current_step } = get();
      const currentIndex = STEP_ORDER.indexOf(current_step);
      if (currentIndex > 0) {
        set({ current_step: STEP_ORDER[currentIndex - 1] });
      }
    },

    goToStep: (step: WizardStep) => {
      const { canProceedToStep } = get();
      if (canProceedToStep(step)) {
        set({ current_step: step });
      }
    },

    canProceedToStep: (step: WizardStep): boolean => {
      const state = get();
      const targetIndex = STEP_ORDER.indexOf(step);
      const currentIndex = STEP_ORDER.indexOf(state.current_step);

      // Can always go back
      if (targetIndex <= currentIndex) {
        return true;
      }

      // Check prerequisites for each step
      switch (step) {
        case 'select-sources':
          return true;

        case 'extract-analyze':
          // Need at least one call selected and a profile
          return state.selected_calls.length > 0 && state.selected_profile_id !== null;

        case 'generate-hooks':
          // Need classification and insights to be completed
          return (
            state.classification_status === 'completed' &&
            state.insights_status === 'completed' &&
            state.generated_insights.length > 0
          );

        case 'create-content':
          // Need hooks to be generated and at least one selected
          return (
            state.hooks_status === 'completed' &&
            state.generated_hooks.length > 0 &&
            state.selected_hook_ids.length > 0
          );

        default:
          return false;
      }
    },

    // Selection actions
    setSelectedCalls: (ids: number[]) => {
      set({ selected_calls: ids });
    },

    toggleCall: (id: number) => {
      const { selected_calls } = get();
      if (selected_calls.includes(id)) {
        set({ selected_calls: selected_calls.filter((callId) => callId !== id) });
      } else {
        set({ selected_calls: [...selected_calls, id] });
      }
    },

    setSelectedProfile: (id: string | null) => {
      set({ selected_profile_id: id });
    },

    // Agent status actions
    setClassificationStatus: (status: AgentStatus) => {
      set({ classification_status: status });
    },

    setInsightsStatus: (status: AgentStatus) => {
      set({ insights_status: status });
    },

    setHooksStatus: (status: AgentStatus) => {
      set({ hooks_status: status });
    },

    setContentStatus: (status: AgentStatus) => {
      set({ content_status: status });
    },

    // Result actions
    setClassificationResult: (result: ClassificationResult | null) => {
      set({ classification_result: result });
    },

    setGeneratedInsights: (insights: Insight[]) => {
      set({ generated_insights: insights });
    },

    setGeneratedHooks: (hooks: Hook[]) => {
      set({ generated_hooks: hooks });
    },

    addGeneratedHook: (hook: Hook) => {
      set((state) => ({
        generated_hooks: [...state.generated_hooks, hook],
      }));
    },

    // Hook selection actions
    toggleHookSelection: (id: string) => {
      const { selected_hook_ids } = get();
      if (selected_hook_ids.includes(id)) {
        set({ selected_hook_ids: selected_hook_ids.filter((hookId) => hookId !== id) });
      } else {
        set({ selected_hook_ids: [...selected_hook_ids, id] });
      }
    },

    selectAllHooks: () => {
      const { generated_hooks } = get();
      set({ selected_hook_ids: generated_hooks.map((hook) => hook.id) });
    },

    deselectAllHooks: () => {
      set({ selected_hook_ids: [] });
    },

    // Streaming content actions
    initStreamingContent: (hookId: string) => {
      set((state) => ({
        generated_content: {
          ...state.generated_content,
          [hookId]: {
            hook_id: hookId,
            social_post_text: '',
            email_subject: '',
            email_body_opening: '',
            is_streaming: true,
            is_saved: false,
          },
        },
      }));
    },

    appendStreamingContent: (
      hookId: string,
      field: 'social_post_text' | 'email_subject' | 'email_body_opening',
      delta: string
    ) => {
      set((state) => {
        const existing = state.generated_content[hookId];
        if (!existing) {
          return state;
        }
        return {
          generated_content: {
            ...state.generated_content,
            [hookId]: {
              ...existing,
              [field]: existing[field] + delta,
            },
          },
        };
      });
    },

    finalizeStreamingContent: (hookId: string) => {
      set((state) => {
        const existing = state.generated_content[hookId];
        if (!existing) {
          return state;
        }
        return {
          generated_content: {
            ...state.generated_content,
            [hookId]: {
              ...existing,
              is_streaming: false,
            },
          },
        };
      });
    },

    markContentSaved: (hookId: string) => {
      set((state) => {
        const existing = state.generated_content[hookId];
        if (!existing) {
          return state;
        }
        return {
          generated_content: {
            ...state.generated_content,
            [hookId]: {
              ...existing,
              is_saved: true,
            },
          },
        };
      });
    },

    // Error and reset actions
    setError: (error: string | null) => {
      set({ error });
    },

    resetToStep: (step: WizardStep) => {
      const stepIndex = STEP_ORDER.indexOf(step);

      // Reset state based on which step we're resetting to
      if (stepIndex <= 0) {
        // Reset to step 1 - clear everything
        set(getInitialState());
      } else if (stepIndex === 1) {
        // Reset to step 2 - keep selections, clear results
        set((state) => ({
          current_step: step,
          classification_status: 'idle',
          insights_status: 'idle',
          hooks_status: 'idle',
          content_status: 'idle',
          classification_result: null,
          generated_insights: [],
          generated_hooks: [],
          selected_hook_ids: [],
          generated_content: {},
          error: null,
        }));
      } else if (stepIndex === 2) {
        // Reset to step 3 - keep classification and insights, clear hooks and content
        set((state) => ({
          current_step: step,
          hooks_status: 'idle',
          content_status: 'idle',
          generated_hooks: [],
          selected_hook_ids: [],
          generated_content: {},
          error: null,
        }));
      } else if (stepIndex === 3) {
        // Reset to step 4 - keep everything except content
        set((state) => ({
          current_step: step,
          content_status: 'idle',
          generated_content: {},
          error: null,
        }));
      }
    },

    reset: () => {
      set(getInitialState());
    },
  })
);

/**
 * Selector hooks for common use cases
 */
export const useCurrentStep = () =>
  useContentWizardStore((state) => state.current_step);

export const useSelectedCalls = () =>
  useContentWizardStore((state) => state.selected_calls);

export const useSelectedProfile = () =>
  useContentWizardStore((state) => state.selected_profile_id);

export const useClassificationStatus = () =>
  useContentWizardStore((state) => state.classification_status);

export const useInsightsStatus = () =>
  useContentWizardStore((state) => state.insights_status);

export const useHooksStatus = () =>
  useContentWizardStore((state) => state.hooks_status);

export const useContentStatus = () =>
  useContentWizardStore((state) => state.content_status);

export const useClassificationResult = () =>
  useContentWizardStore((state) => state.classification_result);

export const useGeneratedInsights = () =>
  useContentWizardStore((state) => state.generated_insights);

export const useGeneratedHooks = () =>
  useContentWizardStore((state) => state.generated_hooks);

export const useSelectedHooks = () =>
  useContentWizardStore((state) => state.selected_hook_ids);

export const useStreamingContent = (hookId: string) =>
  useContentWizardStore((state) => state.generated_content[hookId] ?? null);

export const useIsProcessing = () =>
  useContentWizardStore((state) => {
    return (
      state.classification_status === 'running' ||
      state.insights_status === 'running' ||
      state.hooks_status === 'running' ||
      state.content_status === 'running'
    );
  });

export const useCanProceed = () =>
  useContentWizardStore((state) => {
    const { current_step, canProceedToStep, content_status } = state;
    const currentIndex = STEP_ORDER.indexOf(current_step);
    if (currentIndex >= STEP_ORDER.length - 1) {
      // On last step - can finish when content generation is complete
      return content_status === 'completed';
    }
    const nextStep = STEP_ORDER[currentIndex + 1];
    return canProceedToStep(nextStep);
  });

export const useWizardError = () =>
  useContentWizardStore((state) => state.error);
