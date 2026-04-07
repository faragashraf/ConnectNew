import { Injectable } from '@angular/core';
import { ControlCenterViewModel } from '../models/admin-control-center.view-models';
import { PublishChangeSummary, PublishReadinessResult } from '../models/publish-release.models';

@Injectable()
export class PublishReleaseEngine {
  buildChangeSummary(
    vm: ControlCenterViewModel,
    auditWarningCount: number
  ): PublishChangeSummary {
    const touchedSteps = vm.steps
      .filter(step => step.isVisited || step.isCompleted)
      .map(step => ({
        key: step.key,
        title: step.title,
        requiredProgress: `${step.requiredCompleted} / ${step.requiredTotal}`,
        optionalProgress: `${step.optionalCompleted} / ${step.optionalTotal}`
      }));

    return {
      publishState: vm.publishState,
      readyStepsCount: vm.readyStepsCount,
      totalStepsCount: vm.totalStepsCount,
      completedRequiredFields: vm.completedRequiredFields,
      totalRequiredFields: vm.totalRequiredFields,
      blockingIssuesCount: vm.blockingIssues.length,
      blockingIssueMessages: vm.blockingIssues,
      warningCount: auditWarningCount,
      touchedSteps
    };
  }

  evaluateReadiness(
    vm: ControlCenterViewModel,
    releaseTitle: string,
    releaseChannel: string,
    auditBlockingCount: number
  ): PublishReadinessResult {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    if (!releaseTitle.trim()) {
      blockingIssues.push('Release Title إلزامي قبل النشر.');
    }

    if (!releaseChannel.trim()) {
      blockingIssues.push('Release Channel إلزامي قبل النشر.');
    }

    if (vm.blockingIssues.length > 0) {
      blockingIssues.push('لا يمكن النشر قبل إغلاق جميع blocking issues في الخطوات السابقة.');
    }

    if (auditBlockingCount > 0) {
      blockingIssues.push('نتيجة Readiness Audit ما زالت تحتوي مشاكل مانعة.');
    }

    if (vm.readinessPercentage < 100) {
      warnings.push('جاهزية الإعداد أقل من 100%.');
    }

    if (vm.publishState === 'published') {
      warnings.push('الإعداد منشور بالفعل. أي نشر جديد سيُعامل كتحديث.');
    }

    return {
      isReady: blockingIssues.length === 0,
      blockingIssues,
      warnings
    };
  }

  serializeChangeSummary(summary: PublishChangeSummary): string {
    return JSON.stringify(summary);
  }

  parseChangeSummary(rawValue: unknown): PublishChangeSummary | null {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as PublishChangeSummary;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }
}
