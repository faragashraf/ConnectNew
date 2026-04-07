import { Injectable } from '@angular/core';
import {
  WorkflowRoutingConfig,
  WorkflowRoutingValidationResult
} from '../models/workflow-routing.models';

@Injectable()
export class WorkflowRoutingEngine {
  validate(config: WorkflowRoutingConfig): WorkflowRoutingValidationResult {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    const createRoute = config.createConfigRouteKey.trim();
    const viewRoute = config.viewConfigRouteKey.trim();
    const defaultTarget = config.defaultTargetUnit.trim();

    if (!config.routingMode) {
      blockingIssues.push('يجب تحديد Workflow Mode.');
    }
    if (!config.routeResolutionMode) {
      blockingIssues.push('يجب تحديد Route Resolution Mode.');
    }
    if (!config.targetResolutionStrategy) {
      blockingIssues.push('يجب تحديد Target Resolution Strategy.');
    }
    if (!config.directionAwareBehavior) {
      blockingIssues.push('يجب تحديد سلوك الاتجاه.');
    }

    if (!createRoute) {
      blockingIssues.push('Create Config Route Key إلزامي.');
    }
    if (!viewRoute) {
      blockingIssues.push('View Config Route Key إلزامي.');
    }
    if (createRoute && viewRoute && createRoute === viewRoute) {
      blockingIssues.push('Create/View route keys يجب أن يكونا مختلفين.');
    }

    if (config.routingMode === 'static' && !defaultTarget) {
      blockingIssues.push('في الوضع الثابت يجب تحديد Default Target Unit.');
    }
    if (config.routingMode === 'manual' && !config.allowManualSelection) {
      blockingIssues.push('في الوضع اليدوي يجب تفعيل Allow Manual Selection.');
    }
    if (config.routingMode === 'hybrid' && !defaultTarget && !config.allowManualSelection) {
      blockingIssues.push('في الوضع الهجين يجب تحديد default target أو تفعيل الاختيار اليدوي.');
    }

    if (config.routeResolutionMode === 'pattern') {
      const hasPatternToken = createRoute.includes('{direction}') || viewRoute.includes('{direction}');
      if (!hasPatternToken) {
        warnings.push('Pattern mode مفضل معه token مثل {direction} داخل route keys.');
      }
    }

    if (config.directionAwareBehavior === 'split') {
      const hasDirectionalHint = createRoute.includes('incoming')
        || createRoute.includes('outgoing')
        || viewRoute.includes('incoming')
        || viewRoute.includes('outgoing');
      if (!hasDirectionalHint) {
        warnings.push('Split direction behavior مفضل معه route keys منفصلة (incoming/outgoing).');
      }
    }

    if (defaultTarget && !/^[a-zA-Z0-9_,\- ]+$/.test(defaultTarget)) {
      warnings.push('Default Target Unit يحتوي رموز غير متوقعة.');
    }

    return {
      isValid: blockingIssues.length === 0,
      blockingIssues,
      warnings
    };
  }
}
