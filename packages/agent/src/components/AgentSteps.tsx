import { Component, For, Show } from 'solid-js';
import { Check, Loader } from 'lucide-solid';

interface AgentStepsProps {
  steps: string[];
  currentStep: number;
}

export const AgentSteps: Component<AgentStepsProps> = (props) => {
  return (
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 class="text-sm font-semibold text-blue-900 mb-3">実行計画:</h3>
      <div class="space-y-2">
        <For each={props.steps}>
          {(step, index) => {
            const stepIndex = index();
            const isComplete = stepIndex < props.currentStep;
            const isCurrent = stepIndex === props.currentStep;
            
            return (
              <div class="flex items-start gap-3">
                <div class={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  isComplete
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  <Show
                    when={isComplete}
                    fallback={
                      <Show
                        when={isCurrent}
                        fallback={<span class="text-xs">{stepIndex + 1}</span>}
                      >
                        <Loader class="w-4 h-4 animate-spin" />
                      </Show>
                    }
                  >
                    <Check class="w-4 h-4" />
                  </Show>
                </div>
                <p class={`text-sm flex-1 ${
                  isComplete
                    ? 'text-gray-600 line-through'
                    : isCurrent
                    ? 'text-blue-900 font-medium'
                    : 'text-gray-500'
                }`}>
                  {step}
                </p>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
