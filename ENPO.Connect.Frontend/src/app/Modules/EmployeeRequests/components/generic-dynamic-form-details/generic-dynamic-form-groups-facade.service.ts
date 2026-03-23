import { Injectable } from '@angular/core';
import { GroupInfo } from 'src/app/Modules/GenericComponents/GenericForms.service';

export type GroupLookupResult = {
  group: GroupInfo;
  parent: GroupInfo | null;
};

export type DuplicateGroupResult = {
  sourceGroup: GroupInfo;
  parent: GroupInfo | null;
  newInstance: GroupInfo;
};

export type RemoveGroupResult = {
  removedGroup: GroupInfo;
  parent: GroupInfo | null;
};

@Injectable({ providedIn: 'root' })
export class GenericDynamicFormGroupsFacadeService {
  findGroupById(
    groupId: number,
    groups: GroupInfo[],
    parent: GroupInfo | null = null
  ): GroupLookupResult | null {
    for (const group of groups ?? []) {
      if (group.groupId === groupId) {
        return { group, parent };
      }

      const children = group.instances ?? [];
      if (children.length === 0) {
        continue;
      }

      const found = this.findGroupById(groupId, children, group);
      if (found) {
        return found;
      }
    }

    return null;
  }

  getMaxGroupId(groups: GroupInfo[]): number {
    let max = 0;
    (groups ?? []).forEach(group => {
      max = Math.max(max, Number(group.groupId ?? 0));
      if ((group.instances ?? []).length > 0) {
        max = Math.max(max, this.getMaxGroupId(group.instances ?? []));
      }
    });
    return max;
  }

  createDuplicateInstance(
    groups: GroupInfo[],
    groupId: number,
    fieldsPerInstance?: number,
    instanceIndex: number = 0,
    explicitInstanceGroupId?: number
  ): DuplicateGroupResult | null {
    const found = this.findGroupById(groupId, groups);
    if (!found) {
      return null;
    }

    const sourceGroup = found.group;
    const parent = found.parent ?? null;

    let newGroupId = this.getMaxGroupId(groups) + 1;
    if (newGroupId <= 9) {
      newGroupId = 10;
    }

    const newFormArrayName = `${sourceGroup.formArrayName}_inst_${newGroupId}`;
    const perInstance = Number.isFinite(fieldsPerInstance as number) && Number(fieldsPerInstance) > 0
      ? Number(fieldsPerInstance)
      : sourceGroup.fields.length;

    const sliceStart = Math.max(0, instanceIndex) * perInstance;
    const sliceEnd = sliceStart + perInstance;
    const slicedFields = sourceGroup.fields.slice(sliceStart, sliceEnd).map(field => ({ ...field }));
    const finalFields = slicedFields.length > 0
      ? slicedFields
      : sourceGroup.fields.map(field => ({ ...field }));

    const assignedInstanceId = this.resolveNewInstanceGroupId(sourceGroup, parent, explicitInstanceGroupId);
    const newInstance: GroupInfo = {
      groupName: sourceGroup.groupName,
      groupId: newGroupId,
      formArrayName: newFormArrayName,
      fields: finalFields,
      isDuplicated: true,
      isExtendable: !!sourceGroup.isExtendable,
      instances: [],
      originGroupId: sourceGroup.groupId,
      instanceGroupId: assignedInstanceId
    };

    if (parent) {
      parent.instances = parent.instances ?? [];
      parent.instances.push(newInstance);
    } else {
      sourceGroup.instances = sourceGroup.instances ?? [];
      sourceGroup.instances.push(newInstance);
    }

    return {
      sourceGroup,
      parent,
      newInstance
    };
  }

  removeGroup(groups: GroupInfo[], groupId: number): RemoveGroupResult | null {
    const found = this.findGroupById(groupId, groups);
    if (!found) {
      return null;
    }

    const { group, parent } = found;
    if (parent) {
      parent.instances = (parent.instances ?? []).filter(instance => instance.groupId !== groupId);
      return { removedGroup: group, parent };
    }

    const topLevelIndex = (groups ?? []).findIndex(item => item.groupId === groupId);
    if (topLevelIndex >= 0) {
      groups.splice(topLevelIndex, 1);
    }
    return { removedGroup: group, parent: null };
  }

  private resolveNewInstanceGroupId(
    sourceGroup: GroupInfo,
    parent: GroupInfo | null,
    explicitInstanceGroupId?: number
  ): number {
    if (explicitInstanceGroupId !== undefined && explicitInstanceGroupId !== null && explicitInstanceGroupId > 0) {
      return explicitInstanceGroupId;
    }

    const targetParent = parent ?? sourceGroup;
    const knownIds: number[] = [];

    if (sourceGroup.instanceGroupId && sourceGroup.instanceGroupId > 0) {
      knownIds.push(sourceGroup.instanceGroupId);
    }

    (targetParent.instances ?? []).forEach(instance => {
      const value = Number(instance.instanceGroupId ?? 0);
      if (Number.isFinite(value) && value > 0) {
        knownIds.push(value);
      }
    });

    const max = knownIds.length > 0 ? Math.max(...knownIds) : 1;
    return max + 1;
  }
}
