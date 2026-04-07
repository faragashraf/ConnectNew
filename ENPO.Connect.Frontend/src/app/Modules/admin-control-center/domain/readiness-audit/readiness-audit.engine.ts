import { Injectable } from '@angular/core';
import {
  ReadinessAuditCheckGroup,
  ReadinessAuditIssue,
  ReadinessAuditPayload,
  ReadinessAuditResult
} from '../models/readiness-audit.models';

@Injectable()
export class ReadinessAuditEngine {
  evaluate(groups: ReadonlyArray<ReadinessAuditCheckGroup>): ReadinessAuditResult {
    const issues: ReadinessAuditIssue[] = [];

    for (const group of groups) {
      group.blockingIssues.forEach((message, index) => {
        issues.push({
          id: `${group.category}-blocking-${index + 1}`,
          severity: 'blocking',
          category: group.category,
          title: group.title,
          stepKey: group.stepKey,
          message
        });
      });

      group.warnings.forEach((message, index) => {
        issues.push({
          id: `${group.category}-warning-${index + 1}`,
          severity: 'warning',
          category: group.category,
          title: group.title,
          stepKey: group.stepKey,
          message
        });
      });
    }

    const blockingIssues = issues.filter(issue => issue.severity === 'blocking');
    const warnings = issues.filter(issue => issue.severity === 'warning');

    const score = this.calculateScore(blockingIssues.length, warnings.length);

    return {
      score,
      status: blockingIssues.length > 0 ? 'blocked' : 'ready',
      issues,
      blockingIssues,
      warnings
    };
  }

  serializePayload(result: ReadinessAuditResult): string {
    const payload: ReadinessAuditPayload = {
      score: result.score,
      status: result.status,
      generatedAt: new Date().toISOString(),
      blockingIssues: result.blockingIssues,
      warnings: result.warnings
    };

    return JSON.stringify(payload);
  }

  parsePayload(rawValue: unknown): ReadinessAuditPayload | null {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as ReadinessAuditPayload;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      if (typeof parsed.score !== 'number' || (parsed.status !== 'ready' && parsed.status !== 'blocked')) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private calculateScore(blockingCount: number, warningCount: number): number {
    const raw = 100 - (blockingCount * 12) - (warningCount * 4);
    return Math.max(0, Math.min(100, raw));
  }
}
