import { Component } from 'solid-js';
import { Loader2 } from 'lucide-solid';

interface LoadingSpinnerProps {
  size?: number;
  class?: string;
}

export const LoadingSpinner: Component<LoadingSpinnerProps> = (props) => {
  return (
    <div class={`flex items-center justify-center ${props.class || ''}`}>
      <Loader2 class={`animate-spin text-blue-600`} size={props.size || 24} />
    </div>
  );
};
