import { FormBuilder } from '@angular/forms';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { GenericFormsService } from './GenericForms.service';

describe('GenericFormsService runtime selection normalization', () => {
  let service: GenericFormsService;

  beforeEach(() => {
    const fb = new FormBuilder();
    const spinner = jasmine.createSpyObj<SpinnerService>('SpinnerService', ['show', 'hide']);
    const dynamicFormController = jasmine.createSpyObj<DynamicFormController>('DynamicFormController', [
      'getMandatoryAll',
      'getMandatoryMetaDate',
      'getAllCategories'
    ]);
    const msg = jasmine.createSpyObj<MsgsService>('MsgsService', ['msgError']);

    service = new GenericFormsService(
      fb,
      spinner as unknown as SpinnerService,
      dynamicFormController as unknown as DynamicFormController,
      msg as unknown as MsgsService
    );
  });

  it('reads/writes runtime selections using normalized field keys', () => {
    service.setRuntimeSelectionForField('DOC_SOURCE', [{ key: '1', name: 'أول' }]);

    expect(service.implementControlSelection('doc_source|0')).toEqual([{ key: '1', name: 'أول' }]);

    service.setRuntimeSelectionForField('doc_source', [{ key: '2', name: 'ثان' }]);

    expect(service.selectionArrays.length).toBe(1);
    expect(service.implementControlSelection('DOC_SOURCE|15')).toEqual([{ key: '2', name: 'ثان' }]);

    service.clearRuntimeSelectionForField('Doc_Source|2');
    expect(service.implementControlSelection('doc_source')).toEqual([]);
  });

  it('clears runtime selections on runtime reset when clearSelections=true', () => {
    service.setRuntimeSelectionForField('customer_code', [{ key: '10', name: 'عميل' }]);
    expect(service.selectionArrays.length).toBe(1);

    service.resetDynamicRuntimeState(true);

    expect(service.selectionArrays.length).toBe(0);
    expect(service.implementControlSelection('customer_code')).toEqual([]);
  });
});
