export type BindingFieldType = 'InputText' | 'Textarea' | 'Dropdown' | 'Number' | 'Date' | 'Checkbox';

export interface ReusableFieldLibraryItem {
  readonly id: string;
  readonly fieldKey: string;
  readonly label: string;
  readonly type: BindingFieldType;
  readonly defaultValue?: string;
  readonly requiredByDefault: boolean;
  readonly readonlyByDefault: boolean;
}

export interface BoundFieldItem {
  bindingId: string;
  sourceFieldId: string;
  fieldKey: string;
  label: string;
  type: BindingFieldType;
  displayOrder: number;
  visible: boolean;
  required: boolean;
  readonly: boolean;
  defaultValue: string;
  mendSql?: number;
  cdmendSql?: number;
  groupId?: number;
  groupName?: string;
  displaySettingsJson?: string;
  dynamicRuntimeJson?: string;
}

export interface FieldLibraryBindingValidationResult {
  readonly isValid: boolean;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}
