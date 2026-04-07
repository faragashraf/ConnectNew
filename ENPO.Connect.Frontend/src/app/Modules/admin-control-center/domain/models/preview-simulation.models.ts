import { BoundFieldItem } from './field-library-binding.models';
import { FormCompositionContainer } from './form-composition.models';

export type PreviewSimulationMode = 'create' | 'edit' | 'view';
export type PreviewSimulationDirection = 'incoming' | 'outgoing';

export interface PreviewSimulationInput {
  readonly mode: PreviewSimulationMode;
  readonly direction: PreviewSimulationDirection;
  readonly bindings: ReadonlyArray<BoundFieldItem>;
  readonly containers: ReadonlyArray<FormCompositionContainer>;
  readonly requiredFieldKeys: ReadonlyArray<string>;
  readonly workflow: {
    readonly routingMode: string | null;
    readonly routeResolutionMode: string | null;
    readonly targetResolutionStrategy: string | null;
    readonly directionAwareBehavior: string | null;
    readonly createConfigRouteKey: string | null;
    readonly viewConfigRouteKey: string | null;
    readonly routeKeyPrefix: string | null;
    readonly primaryConfigRouteKey: string | null;
  };
}

export interface PreviewRenderedField {
  readonly fieldKey: string;
  readonly label: string;
  readonly type: string;
  readonly required: boolean;
  readonly readonly: boolean;
  readonly defaultValue: string;
}

export interface PreviewRenderedContainer {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly displayOrder: number;
  readonly fields: ReadonlyArray<PreviewRenderedField>;
}

export interface PreviewRouteSnapshot {
  readonly routingMode: string;
  readonly routeResolutionMode: string;
  readonly targetResolutionStrategy: string;
  readonly directionAwareBehavior: string;
  readonly routeKeyPrefix: string;
  readonly primaryConfigRouteKey: string;
  readonly createConfigRouteKey: string;
  readonly viewConfigRouteKey: string;
  readonly resolvedRouteKey: string;
}

export interface PreviewRenderingMap {
  readonly mode: PreviewSimulationMode;
  readonly direction: PreviewSimulationDirection;
  readonly routeSnapshot: PreviewRouteSnapshot;
  readonly containers: ReadonlyArray<PreviewRenderedContainer>;
  readonly unassignedFieldKeys: ReadonlyArray<string>;
  readonly hiddenRequiredFieldKeys: ReadonlyArray<string>;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

export interface PreviewSimulationDerivedArtifact {
  readonly input: PreviewSimulationInput;
  readonly renderingMap: PreviewRenderingMap;
}
