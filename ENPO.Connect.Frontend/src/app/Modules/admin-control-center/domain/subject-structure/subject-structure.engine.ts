import { Injectable } from '@angular/core';
import {
  SubjectStructureNode,
  SubjectStructureTreeNode,
  SubjectStructureValidationResult
} from '../models/subject-structure.models';

@Injectable()
export class SubjectStructureEngine {
  parseNodesPayload(rawValue: unknown): SubjectStructureNode[] {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map(item => this.normalizeNode(item))
        .filter((item): item is SubjectStructureNode => item != null)
        .sort((left, right) => left.displayOrder - right.displayOrder);
    } catch {
      return [];
    }
  }

  serializeNodesPayload(nodes: ReadonlyArray<SubjectStructureNode>): string {
    const normalized = [...nodes]
      .map(item => this.normalizeNode(item))
      .filter((item): item is SubjectStructureNode => item != null)
      .sort((left, right) => left.displayOrder - right.displayOrder);

    return JSON.stringify(normalized);
  }

  buildTree(nodes: ReadonlyArray<SubjectStructureNode>): SubjectStructureTreeNode[] {
    const map = new Map<string, SubjectStructureTreeNode>();

    for (const node of nodes) {
      map.set(node.id, {
        id: node.id,
        key: node.key,
        label: node.label,
        displayOrder: node.displayOrder,
        children: []
      });
    }

    const roots: SubjectStructureTreeNode[] = [];
    for (const node of nodes) {
      const mappedNode = map.get(node.id);
      if (!mappedNode) {
        continue;
      }

      if (!node.parentId) {
        roots.push(mappedNode);
        continue;
      }

      const parent = map.get(node.parentId);
      if (!parent) {
        roots.push(mappedNode);
        continue;
      }

      (parent.children as SubjectStructureTreeNode[]).push(mappedNode);
    }

    return roots
      .map(root => this.sortTree(root))
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  validate(nodes: ReadonlyArray<SubjectStructureNode>): SubjectStructureValidationResult {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    if (nodes.length === 0) {
      blockingIssues.push('يجب إضافة عنصر واحد على الأقل داخل هيكل الموضوع.');
      return {
        isValid: false,
        blockingIssues,
        warnings
      };
    }

    const keyMap = new Map<string, number>();
    const idMap = new Map<string, SubjectStructureNode>();
    const siblingOrderMap = new Map<string, Set<number>>();
    let rootCount = 0;

    for (const node of nodes) {
      idMap.set(node.id, node);

      const normalizedKey = node.key.trim().toLowerCase();
      keyMap.set(normalizedKey, (keyMap.get(normalizedKey) ?? 0) + 1);

      if (!node.parentId) {
        rootCount++;
      }

      const siblingKey = node.parentId ?? '__root__';
      const orderSet = siblingOrderMap.get(siblingKey) ?? new Set<number>();
      if (orderSet.has(node.displayOrder)) {
        blockingIssues.push(`يوجد تعارض في ترتيب العرض (${node.displayOrder}) ضمن نفس المستوى.`);
      }
      orderSet.add(node.displayOrder);
      siblingOrderMap.set(siblingKey, orderSet);

      if (node.displayOrder <= 0) {
        blockingIssues.push(`العنصر "${node.label}" يحتوي ترتيب عرض غير صالح.`);
      }
    }

    if (rootCount === 0) {
      blockingIssues.push('يجب أن يحتوي الهيكل على عنصر جذري واحد على الأقل.');
    }

    if (rootCount > 1) {
      warnings.push('يوجد أكثر من عنصر جذري. تأكد أن هذا السلوك مقصود.');
    }

    for (const [key, count] of keyMap.entries()) {
      if (count > 1) {
        blockingIssues.push(`حقل المفتاح "${key}" مكرر داخل الهيكل.`);
      }
    }

    for (const node of nodes) {
      if (node.parentId && !idMap.has(node.parentId)) {
        blockingIssues.push(`العنصر "${node.label}" مرتبط بأب غير موجود.`);
      }

      if (this.createsCycle(node.id, node.parentId, idMap)) {
        blockingIssues.push(`العنصر "${node.label}" يسبب دورة غير مسموحة في العلاقة الأب/ابن.`);
      }
    }

    return {
      isValid: blockingIssues.length === 0,
      blockingIssues,
      warnings
    };
  }

  canAssignParent(
    nodeId: string,
    candidateParentId: string | null,
    nodes: ReadonlyArray<SubjectStructureNode>
  ): boolean {
    if (!candidateParentId) {
      return true;
    }

    if (nodeId === candidateParentId) {
      return false;
    }

    const idMap = new Map<string, SubjectStructureNode>(nodes.map(item => [item.id, item]));
    return !this.createsCycle(nodeId, candidateParentId, idMap);
  }

  normalizeSiblingDisplayOrder(nodes: ReadonlyArray<SubjectStructureNode>): SubjectStructureNode[] {
    const grouped = new Map<string, SubjectStructureNode[]>();
    for (const node of nodes) {
      const groupKey = node.parentId ?? '__root__';
      const list = grouped.get(groupKey) ?? [];
      list.push(node);
      grouped.set(groupKey, list);
    }

    const normalized: SubjectStructureNode[] = [];
    for (const groupNodes of grouped.values()) {
      groupNodes
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .forEach((node, index) => {
          normalized.push({
            ...node,
            displayOrder: index + 1
          });
        });
    }

    return normalized.sort((left, right) => {
      if (left.parentId === right.parentId) {
        return left.displayOrder - right.displayOrder;
      }

      return String(left.parentId ?? '').localeCompare(String(right.parentId ?? ''));
    });
  }

  private normalizeNode(raw: unknown): SubjectStructureNode | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Record<string, unknown>;
    const id = String(candidate['id'] ?? '').trim();
    const key = String(candidate['key'] ?? '').trim();
    const label = String(candidate['label'] ?? '').trim();
    const displayOrder = Number(candidate['displayOrder'] ?? 0);

    if (!id || !key || !label || !Number.isFinite(displayOrder)) {
      return null;
    }

    const parentId = String(candidate['parentId'] ?? '').trim();
    return {
      id,
      key,
      label,
      parentId: parentId.length > 0 ? parentId : null,
      displayOrder: Math.max(1, Math.trunc(displayOrder)),
      isActive: candidate['isActive'] !== false
    };
  }

  private createsCycle(
    nodeId: string,
    candidateParentId: string | null,
    nodesById: Map<string, SubjectStructureNode>
  ): boolean {
    if (!candidateParentId) {
      return false;
    }

    let currentParentId: string | null = candidateParentId;
    while (currentParentId) {
      if (currentParentId === nodeId) {
        return true;
      }

      const parentNode = nodesById.get(currentParentId);
      if (!parentNode) {
        return false;
      }

      currentParentId = parentNode.parentId;
    }

    return false;
  }

  private sortTree(node: SubjectStructureTreeNode): SubjectStructureTreeNode {
    const sortedChildren = [...node.children]
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map(child => this.sortTree(child));

    return {
      ...node,
      children: sortedChildren
    };
  }
}
