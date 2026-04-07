import { Injectable } from '@angular/core';
import { AccessVisibilityEngine } from '../domain/access-visibility/access-visibility.engine';
import { FieldLibraryBindingEngine } from '../domain/field-library-binding/field-library-binding.engine';
import { FormCompositionEngine } from '../domain/form-composition/form-composition.engine';
import { ReadinessAuditCheckGroup } from '../domain/models/readiness-audit.models';
import { PreviewSimulationEngine } from '../domain/preview-simulation/preview-simulation.engine';
import { ReadinessAuditEngine } from '../domain/readiness-audit/readiness-audit.engine';
import { SubjectStructureEngine } from '../domain/subject-structure/subject-structure.engine';
import { ValidationRulesEngine } from '../domain/validation-rules/validation-rules.engine';
import { WorkflowRoutingEngine } from '../domain/workflow-routing/workflow-routing.engine';
import {
  PersistedControlCenterDraftState,
  PersistedControlCenterStepSnapshot
} from './admin-control-center-draft-storage.service';

@Injectable()
export class AdminControlCenterDemoScopeService {
  constructor(
    private readonly structureEngine: SubjectStructureEngine,
    private readonly bindingEngine: FieldLibraryBindingEngine,
    private readonly compositionEngine: FormCompositionEngine,
    private readonly workflowRoutingEngine: WorkflowRoutingEngine,
    private readonly accessEngine: AccessVisibilityEngine,
    private readonly validationRulesEngine: ValidationRulesEngine,
    private readonly previewEngine: PreviewSimulationEngine,
    private readonly readinessAuditEngine: ReadinessAuditEngine
  ) {}

  createDemoDraftState(): PersistedControlCenterDraftState {
    const now = new Date().toISOString();

    const structureNodes = [
      {
        id: 'node-demo-root',
        key: 'followup_root',
        label: 'بيانات أساسية',
        parentId: null,
        displayOrder: 1,
        isActive: true
      },
      {
        id: 'node-demo-org',
        key: 'target_org',
        label: 'بيانات الجهة',
        parentId: 'node-demo-root',
        displayOrder: 1,
        isActive: true
      },
      {
        id: 'node-demo-details',
        key: 'request_details',
        label: 'تفاصيل الطلب',
        parentId: 'node-demo-root',
        displayOrder: 2,
        isActive: true
      },
      {
        id: 'node-demo-attachments',
        key: 'attachments_notes',
        label: 'المرفقات والملاحظات',
        parentId: 'node-demo-root',
        displayOrder: 3,
        isActive: true
      }
    ];

    const structureValidation = this.structureEngine.validate(structureNodes);
    const structurePayload = this.structureEngine.serializeNodesPayload(structureNodes);

    const bindings = this.bindingEngine.normalizeDisplayOrder([
      {
        bindingId: 'bind-demo-request-title',
        sourceFieldId: 'demo-request-title',
        fieldKey: 'requestTitle',
        label: 'عنوان الطلب',
        type: 'InputText',
        displayOrder: 1,
        visible: true,
        required: true,
        readonly: false,
        defaultValue: ''
      },
      {
        bindingId: 'bind-demo-request-description',
        sourceFieldId: 'demo-request-description',
        fieldKey: 'requestDescription',
        label: 'وصف مختصر',
        type: 'Textarea',
        displayOrder: 2,
        visible: true,
        required: true,
        readonly: false,
        defaultValue: ''
      },
      {
        bindingId: 'bind-demo-action-type',
        sourceFieldId: 'demo-action-type',
        fieldKey: 'actionType',
        label: 'نوع الإجراء',
        type: 'Dropdown',
        displayOrder: 3,
        visible: true,
        required: true,
        readonly: false,
        defaultValue: 'followup'
      },
      {
        bindingId: 'bind-demo-target-unit',
        sourceFieldId: 'demo-target-unit',
        fieldKey: 'targetUnit',
        label: 'الجهة المعنية',
        type: 'Dropdown',
        displayOrder: 4,
        visible: true,
        required: true,
        readonly: false,
        defaultValue: '148'
      },
      {
        bindingId: 'bind-demo-priority',
        sourceFieldId: 'demo-priority',
        fieldKey: 'priorityLevel',
        label: 'الأولوية',
        type: 'Dropdown',
        displayOrder: 5,
        visible: true,
        required: true,
        readonly: false,
        defaultValue: 'medium'
      },
      {
        bindingId: 'bind-demo-due-date',
        sourceFieldId: 'demo-due-date',
        fieldKey: 'dueDate',
        label: 'تاريخ الاستحقاق',
        type: 'Date',
        displayOrder: 6,
        visible: true,
        required: false,
        readonly: false,
        defaultValue: ''
      },
      {
        bindingId: 'bind-demo-request-notes',
        sourceFieldId: 'demo-request-notes',
        fieldKey: 'requestNotes',
        label: 'ملاحظات',
        type: 'Textarea',
        displayOrder: 7,
        visible: true,
        required: false,
        readonly: false,
        defaultValue: ''
      },
      {
        bindingId: 'bind-demo-has-attachment',
        sourceFieldId: 'demo-has-attachment',
        fieldKey: 'hasAttachment',
        label: 'يوجد مرفقات',
        type: 'Checkbox',
        displayOrder: 8,
        visible: true,
        required: false,
        readonly: false,
        defaultValue: 'false'
      }
    ]);

    const bindingValidation = this.bindingEngine.validateBindings(bindings);
    const bindingPayload = this.bindingEngine.serializeBindingsPayload(bindings);

    const containers = this.compositionEngine.normalizeDisplayOrder([
      {
        id: 'container-demo-main',
        title: 'بيانات أساسية',
        type: 'group',
        visible: true,
        displayOrder: 1,
        fieldKeys: ['requestTitle', 'requestDescription', 'priorityLevel']
      },
      {
        id: 'container-demo-org',
        title: 'بيانات الجهة',
        type: 'section',
        visible: true,
        displayOrder: 2,
        fieldKeys: ['actionType', 'targetUnit']
      },
      {
        id: 'container-demo-details',
        title: 'تفاصيل المتابعة',
        type: 'card',
        visible: true,
        displayOrder: 3,
        fieldKeys: ['dueDate', 'requestNotes', 'hasAttachment']
      }
    ]);

    const compositionValidation = this.compositionEngine.validate(
      containers,
      bindings
        .filter(item => item.visible)
        .map(item => ({
          fieldKey: item.fieldKey,
          label: item.label,
          type: item.type
        })),
      true
    );
    const compositionPayload = this.compositionEngine.serializeContainersPayload(containers);

    const workflowConfig = {
      routingMode: 'hybrid' as const,
      defaultTargetUnit: '148',
      allowManualSelection: true,
      routeResolutionMode: 'context' as const,
      targetResolutionStrategy: 'scope-match' as const,
      createConfigRouteKey: 'connect.central.followup.create',
      viewConfigRouteKey: 'connect.central.followup.view',
      directionAwareBehavior: 'shared' as const,
      workflowNotes: 'توجيه افتراضي لنطاق تجريبي جاهز للاختبار الداخلي.'
    };

    const workflowValidation = this.workflowRoutingEngine.validate(workflowConfig);

    const accessConfig = {
      createScope: '60,61',
      readScope: '60,61,62,148',
      workScope: '60,62',
      adminScope: '60,148',
      publishScope: '60',
      visibilityNotes: 'نطاقات افتراضية لتجربة المراجعة الإدارية.'
    };

    const accessValidation = this.accessEngine.validate(accessConfig);

    const requiredRules = [
      {
        id: 'required-request-title',
        fieldKey: 'requestTitle',
        fieldLabel: 'عنوان الطلب',
        isRequired: true
      },
      {
        id: 'required-request-description',
        fieldKey: 'requestDescription',
        fieldLabel: 'وصف مختصر',
        isRequired: true
      },
      {
        id: 'required-action-type',
        fieldKey: 'actionType',
        fieldLabel: 'نوع الإجراء',
        isRequired: true
      },
      {
        id: 'required-target-unit',
        fieldKey: 'targetUnit',
        fieldLabel: 'الجهة المعنية',
        isRequired: true
      },
      {
        id: 'required-priority-level',
        fieldKey: 'priorityLevel',
        fieldLabel: 'الأولوية',
        isRequired: true
      },
      {
        id: 'required-due-date',
        fieldKey: 'dueDate',
        fieldLabel: 'تاريخ الاستحقاق',
        isRequired: false
      },
      {
        id: 'required-request-notes',
        fieldKey: 'requestNotes',
        fieldLabel: 'ملاحظات',
        isRequired: false
      },
      {
        id: 'required-has-attachment',
        fieldKey: 'hasAttachment',
        fieldLabel: 'يوجد مرفقات',
        isRequired: false
      }
    ];

    const conditionalRules = [
      {
        id: 'cond-priority-needs-due-date',
        leftFieldKey: 'priorityLevel',
        operator: 'eq' as const,
        rightValue: 'high',
        effect: 'required' as const
      }
    ];

    const blockingRules = [
      {
        id: 'block-target-unit-empty',
        name: 'منع الإرسال بدون الجهة المعنية',
        conditionExpression: 'isEmpty(targetUnit)',
        message: 'لا يمكن الإرسال قبل تحديد الجهة المعنية.'
      }
    ];

    const validationConfig = {
      validationLevel: 'strict' as const,
      submitBehavior: 'block' as const,
      enableCrossFieldValidation: true,
      validationNotes: 'قواعد افتراضية تضمن منع الإرسال عند غياب البيانات الأساسية.',
      requiredRules,
      conditionalRules,
      blockingRules
    };

    const rulesEvaluation = this.validationRulesEngine.evaluate(validationConfig);
    const conditionalPayload = this.validationRulesEngine.serializeConditionalPayload({
      requiredRules,
      conditionalRules
    });
    const blockingPayload = this.validationRulesEngine.serializeBlockingPayload(blockingRules);

    const requiredFieldKeys = requiredRules
      .filter(item => item.isRequired)
      .map(item => item.fieldKey);

    const renderingMap = this.previewEngine.buildRenderingMap({
      mode: 'create',
      direction: 'incoming',
      bindings,
      containers,
      requiredFieldKeys,
      workflow: {
        routingMode: workflowConfig.routingMode,
        routeResolutionMode: workflowConfig.routeResolutionMode,
        targetResolutionStrategy: workflowConfig.targetResolutionStrategy,
        directionAwareBehavior: workflowConfig.directionAwareBehavior,
        createConfigRouteKey: workflowConfig.createConfigRouteKey,
        viewConfigRouteKey: workflowConfig.viewConfigRouteKey,
        routeKeyPrefix: 'connect.central.followup',
        primaryConfigRouteKey: 'connect.central.followup.124'
      }
    });

    const readinessGroups: ReadonlyArray<ReadinessAuditCheckGroup> = [
      {
        category: 'binding',
        title: 'ربط مكتبة الحقول',
        stepKey: 'field-library-binding',
        blockingIssues: [...bindingValidation.blockingIssues],
        warnings: [...bindingValidation.warnings]
      },
      {
        category: 'composition',
        title: 'تركيب النموذج',
        stepKey: 'form-composition',
        blockingIssues: [...compositionValidation.blockingIssues],
        warnings: [...compositionValidation.warnings]
      },
      {
        category: 'policy',
        title: 'سياسة سير العمل',
        stepKey: 'workflow-routing',
        blockingIssues: [...workflowValidation.blockingIssues],
        warnings: [...workflowValidation.warnings]
      },
      {
        category: 'route',
        title: 'تغطية المسارات والإعدادات',
        stepKey: 'workflow-routing',
        blockingIssues: [],
        warnings: []
      },
      {
        category: 'access',
        title: 'الصلاحيات والرؤية',
        stepKey: 'access-visibility',
        blockingIssues: [...accessValidation.blockingIssues],
        warnings: [...accessValidation.warnings]
      },
      {
        category: 'validation',
        title: 'قواعد التحقق',
        stepKey: 'validation-rules',
        blockingIssues: [...rulesEvaluation.blockingIssues],
        warnings: [...rulesEvaluation.warnings]
      },
      {
        category: 'preview',
        title: 'المعاينة والمحاكاة',
        stepKey: 'preview-simulation',
        blockingIssues: [...renderingMap.blockingIssues],
        warnings: [...renderingMap.warnings]
      }
    ];

    const readinessResult = this.readinessAuditEngine.evaluate(readinessGroups);
    const readinessBlockingPayload = JSON.stringify(readinessResult.blockingIssues);
    const readinessWarningsPayload = JSON.stringify(readinessResult.warnings);

    const steps: ReadonlyArray<PersistedControlCenterStepSnapshot> = [
      {
        key: 'scope-definition',
        isVisited: true,
        values: {
          applicationId: '60',
          categoryId: '124',
          requestMode: 'single',
          documentDirection: 'incoming',
          routeKeyPrefix: 'connect.central.followup',
          primaryConfigRouteKey: 'connect.central.followup.124',
          createUnitScope: '60,61',
          readUnitScope: '60,61,62,148',
          creatorUnitDefault: '60',
          targetUnitDefault: '148',
          runtimeContextJson: '{"requestSource":"admin-control-center","template":"demo-followup"}',
          localizationProfile: 'ar-enterprise',
          uiPreset: 'operations-standard'
        }
      },
      {
        key: 'subject-structure',
        isVisited: true,
        values: {
          rootSubjectLabel: 'طلب متابعة داخلية',
          subjectPrefix: 'FUP',
          enableSubSubjectHierarchy: true,
          structureNotes: 'هيكل افتراضي للتجربة السريعة والتأكد من صلاحية المسار.',
          structureNodesPayload: structurePayload,
          structureValidationToken: structureValidation.isValid ? 'valid' : null
        }
      },
      {
        key: 'field-library-binding',
        isVisited: true,
        values: {
          libraryVersion: 'operations',
          bindingStrategy: 'strict',
          includeLegacyFields: false,
          bindingNotes: 'ربط افتراضي يغطي الحقول الأساسية لتجربة المسار.',
          bindingPayload,
          bindingValidationToken: bindingValidation.isValid ? 'valid' : null
        }
      },
      {
        key: 'form-composition',
        isVisited: true,
        values: {
          defaultGroupLabel: 'بيانات الطلب الرئيسية',
          layoutDirection: 'rtl',
          allowInlineSections: true,
          compositionNotes: 'توزيع الحقول على مجموعات واضحة للمستخدم الإداري.',
          compositionLayoutPayload: compositionPayload,
          compositionValidationToken: compositionValidation.isValid ? 'valid' : null
        }
      },
      {
        key: 'workflow-routing',
        isVisited: true,
        values: {
          routingMode: workflowConfig.routingMode,
          defaultTargetUnit: workflowConfig.defaultTargetUnit,
          allowManualSelection: workflowConfig.allowManualSelection,
          routeResolutionMode: workflowConfig.routeResolutionMode,
          targetResolutionStrategy: workflowConfig.targetResolutionStrategy,
          createConfigRouteKey: workflowConfig.createConfigRouteKey,
          viewConfigRouteKey: workflowConfig.viewConfigRouteKey,
          directionAwareBehavior: workflowConfig.directionAwareBehavior,
          workflowNotes: workflowConfig.workflowNotes,
          workflowValidationToken: workflowValidation.isValid ? 'valid' : null
        }
      },
      {
        key: 'access-visibility',
        isVisited: true,
        values: {
          createScope: accessConfig.createScope,
          readScope: accessConfig.readScope,
          workScope: accessConfig.workScope,
          adminScope: accessConfig.adminScope,
          publishScope: accessConfig.publishScope,
          visibilityNotes: accessConfig.visibilityNotes,
          accessVisibilityToken: accessValidation.isValid ? 'valid' : null
        }
      },
      {
        key: 'validation-rules',
        isVisited: true,
        values: {
          validationLevel: validationConfig.validationLevel,
          submitBehavior: validationConfig.submitBehavior,
          enableCrossFieldValidation: validationConfig.enableCrossFieldValidation,
          validationNotes: validationConfig.validationNotes,
          conditionalRulesPayload: conditionalPayload,
          submissionBlockingPayload: blockingPayload,
          validationRulesToken: rulesEvaluation.isValid ? 'valid' : null
        }
      },
      {
        key: 'preview-simulation',
        isVisited: true,
        values: {
          previewDirection: 'incoming',
          previewMode: 'create',
          sampleReference: 'DEMO-FUP-001',
          enableSimulationTrace: true,
          previewNotes: 'معاينة افتراضية لنطاق طلب متابعة داخلية.',
          renderingMapPayload: this.previewEngine.serializeRenderingMap(renderingMap),
          previewValidationToken: renderingMap.blockingIssues.length === 0 ? 'valid' : null
        }
      },
      {
        key: 'readiness-audit',
        isVisited: true,
        values: {
          auditOwner: 'فريق الحوكمة الرقمية',
          auditChecklistVersion: 'ACC-AUDIT-v1',
          blockOnCriticalIssues: 'true',
          auditNotes: 'النطاق التجريبي جاهز للاختبار الداخلي.',
          readinessScore: String(readinessResult.score),
          auditBlockingPayload: readinessBlockingPayload,
          auditWarningsPayload: readinessWarningsPayload,
          readinessAuditToken: readinessResult.blockingIssues.length === 0 ? 'valid' : null
        }
      },
      {
        key: 'publish-release',
        isVisited: true,
        values: {
          releaseTitle: 'تشغيل تجريبي - طلب متابعة داخلية',
          releaseChannel: 'pilot',
          publishWindow: '2026-04-07 10:00',
          releaseVersion: 'v1.0.0-demo',
          releaseNotes: 'إعداد تجريبي للتحقق من رحلة الإعداد والنشر end-to-end.',
          changeSummaryPayload: JSON.stringify({
            template: 'demo-followup',
            readinessScore: readinessResult.score,
            warnings: readinessResult.warnings.length,
            generatedAt: now
          }),
          publishReadinessToken: readinessResult.blockingIssues.length === 0 ? 'valid' : null
        }
      }
    ];

    return {
      context: {
        applicationId: '60',
        categoryId: 124,
        routeKeyPrefix: 'connect.central.followup',
        documentDirection: 'incoming',
        requestMode: 'single',
        primaryConfigRouteKey: 'connect.central.followup.124',
        createUnitScope: '60,61',
        readUnitScope: '60,61,62,148',
        creatorUnitDefault: '60',
        targetUnitDefault: '148',
        runtimeContextJson: '{"requestSource":"admin-control-center","template":"demo-followup"}',
        localizationProfile: 'ar-enterprise',
        uiPreset: 'operations-standard'
      },
      steps,
      activeStepKey: 'scope-definition',
      isPublished: false,
      lastPublishedAt: null,
      lastSavedAt: now
    };
  }
}
