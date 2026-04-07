import { Injectable } from '@angular/core';
import { ControlCenterViewModel } from '../models/admin-control-center.view-models';
import { RuntimeRequestLaunchPlan } from '../models/runtime-request-integration.models';

@Injectable()
export class RuntimeRequestIntegrationEngine {
  private readonly runtimePath = '/DynamicSubjects/subjects/new';

  buildLaunchPlan(vm: ControlCenterViewModel, auditBlockingCount: number): RuntimeRequestLaunchPlan {
    const workflowStep = vm.steps.find(step => step.key === 'workflow-routing');
    const categoryId = Number(vm.context.categoryId ?? 0);
    const createConfigRouteKey = String(workflowStep?.values['createConfigRouteKey'] ?? '').trim();
    const documentDirection = vm.context.documentDirection ?? vm.derived.preview.input.direction;
    const previewBlockingIssues = vm.derived.preview.renderingMap.blockingIssues;

    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    if (categoryId <= 0) {
      blockingIssues.push('Category Id غير صالح. لا يمكن فتح شاشة تسجيل الطلب بدون نوع موضوع واضح.');
    }

    if (!createConfigRouteKey) {
      blockingIssues.push('Create Config Route Key غير محدد في Workflow Routing.');
    }

    if (previewBlockingIssues.length > 0) {
      blockingIssues.push('المعاينة غير صالحة. يجب حل مشاكل Preview قبل تجربة الإدخال الفعلي.');
    }

    if (auditBlockingCount > 0) {
      blockingIssues.push('Readiness Audit يحتوي مشكلات مانعة. لا ينصح بتشغيل المسار الفعلي قبل حلها.');
    }

    if (createConfigRouteKey && !createConfigRouteKey.toLowerCase().startsWith('dynamicsubjects/')) {
      warnings.push(
        'Create Config Route Key لا يطابق route key الافتراضي لشاشة Dynamic Subjects. التكامل الحالي يعتمد Category Id + Direction.'
      );
    }

    if (!vm.context.routeKeyPrefix) {
      warnings.push('Route Key Prefix غير محدد؛ تتبع source config في runtime سيكون محدودًا.');
    }

    const queryParams: Record<string, string | number> = {
      source: 'admin-control-center',
      scopeCreateRouteKey: createConfigRouteKey || 'n/a'
    };

    if (categoryId > 0) {
      queryParams['categoryId'] = categoryId;
      queryParams['scopeCategoryId'] = categoryId;
    }

    if (documentDirection) {
      queryParams['documentDirection'] = documentDirection;
    }

    if (vm.context.routeKeyPrefix) {
      queryParams['scopeRouteKeyPrefix'] = vm.context.routeKeyPrefix;
    }

    return {
      runtimePath: this.runtimePath,
      queryParams,
      blockingIssues,
      warnings,
      isRuntimeReady: blockingIssues.length === 0
    };
  }
}
