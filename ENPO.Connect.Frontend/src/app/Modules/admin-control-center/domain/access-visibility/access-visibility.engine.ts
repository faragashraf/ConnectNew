import { Injectable } from '@angular/core';
import {
  AccessVisibilityConfig,
  AccessVisibilityValidationResult
} from '../models/access-visibility.models';

@Injectable()
export class AccessVisibilityEngine {
  validate(config: AccessVisibilityConfig): AccessVisibilityValidationResult {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    const createScope = this.normalizeScope(config.createScope);
    const readScope = this.normalizeScope(config.readScope);
    const workScope = this.normalizeScope(config.workScope);
    const adminScope = this.normalizeScope(config.adminScope);
    const publishScope = this.normalizeScope(config.publishScope);

    if (createScope.length === 0) {
      blockingIssues.push('Create Scope إلزامي ولا يمكن أن يكون فارغًا.');
    }
    if (readScope.length === 0) {
      blockingIssues.push('Read Scope إلزامي ولا يمكن أن يكون فارغًا.');
    }
    if (adminScope.length === 0) {
      blockingIssues.push('Admin Scope إلزامي ولا يمكن أن يكون فارغًا.');
    }
    if (publishScope.length === 0) {
      blockingIssues.push('Publish Scope إلزامي ولا يمكن أن يكون فارغًا.');
    }

    const adminSet = new Set(adminScope);
    const readSet = new Set(readScope);

    for (const id of publishScope) {
      if (!adminSet.has(id)) {
        blockingIssues.push(`Publish Scope يحتوي "${id}" غير موجود داخل Admin Scope.`);
      }
    }

    for (const id of adminScope) {
      if (!readSet.has(id)) {
        warnings.push(`Admin unit "${id}" غير موجود في Read Scope.`);
      }
    }

    for (const id of workScope) {
      if (!readSet.has(id) && !adminSet.has(id)) {
        warnings.push(`Work unit "${id}" غير موجود في Read/Admin scopes.`);
      }
    }

    return {
      isValid: blockingIssues.length === 0,
      blockingIssues,
      warnings,
      normalizedScopes: {
        create: createScope,
        read: readScope,
        work: workScope,
        admin: adminScope,
        publish: publishScope
      }
    };
  }

  private normalizeScope(rawScope: string): string[] {
    return String(rawScope ?? '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index);
  }
}
