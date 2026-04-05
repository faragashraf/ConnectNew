import { Injectable } from '@angular/core';
import { SubjectCategoryTreeNodeDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';

export const DYNAMIC_SUBJECTS_APPLICATION_ID = '60';

@Injectable({ providedIn: 'root' })
export class DynamicSubjectAccessService {
  constructor(private readonly authObjectsService: AuthObjectsService) {}

  getApplicationId(): string {
    return DYNAMIC_SUBJECTS_APPLICATION_ID;
  }

  getUserUnitIds(): number[] {
    const profile = this.authObjectsService.getUserProfile() ?? {};
    const units = Array.isArray(profile?.vwOrgUnitsWithCounts) ? profile.vwOrgUnitsWithCounts : [];

    return units
      .map((item: unknown) => {
        if (item && typeof item === 'object' && 'unitId' in item) {
          return Number((item as { unitId?: unknown }).unitId);
        }

        return Number(item);
      })
      .filter((value: number) => Number.isFinite(value) && value > 0)
      .filter((value: number, index: number, source: number[]) => source.indexOf(value) === index);
  }

  filterByTopParent(tree: SubjectCategoryTreeNodeDto[]): SubjectCategoryTreeNodeDto[] {
    const allowedTopParents = new Set(this.getUserUnitIds());
    if (allowedTopParents.size === 0) {
      return [];
    }

    const walk = (nodes: SubjectCategoryTreeNodeDto[]): SubjectCategoryTreeNodeDto[] => (nodes ?? []).map(node => ({
      ...node,
      children: walk(node.children ?? [])
    }));

    return (tree ?? [])
      .filter(node => allowedTopParents.has(Number(node.categoryId ?? 0)))
      .map(node => ({
        ...node,
        children: walk(node.children ?? [])
      }));
  }

  collectCategoryIds(tree: SubjectCategoryTreeNodeDto[]): Set<number> {
    const ids = new Set<number>();

    const walk = (nodes: SubjectCategoryTreeNodeDto[]) => {
      (nodes ?? []).forEach(node => {
        const categoryId = Number(node.categoryId ?? 0);
        if (categoryId > 0) {
          ids.add(categoryId);
        }

        walk(node.children ?? []);
      });
    };

    walk(tree ?? []);
    return ids;
  }
}
