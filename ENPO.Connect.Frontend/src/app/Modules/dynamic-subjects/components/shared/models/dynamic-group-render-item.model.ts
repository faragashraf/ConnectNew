import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';

export interface DynamicGroupRenderItem {
  groupId: number;
  groupName: string;
  formArrayName: string;
  fields: CdCategoryMandDto[];
}
