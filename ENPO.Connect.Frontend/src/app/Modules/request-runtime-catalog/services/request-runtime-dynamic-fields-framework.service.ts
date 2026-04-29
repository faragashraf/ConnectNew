import { Injectable, OnDestroy } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormGroup, ValidationErrors } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { GenericFormsService, selection } from 'src/app/Modules/GenericComponents/GenericForms.service';
import {
  RequestRuntimeDynamicActionConfig,
  RequestRuntimeDynamicAsyncValidationConfig,
  RequestRuntimeDynamicFieldBehaviorConfig,
  RequestRuntimeDynamicHttpMethod,
  RequestRuntimeDynamicHttpRequestConfig,
  RequestRuntimeDynamicIntegrationAuthConfig,
  RequestRuntimeDynamicIntegrationAuthMode,
  RequestRuntimeDynamicIntegrationNameValueBinding,
  RequestRuntimeDynamicIntegrationRequestConfig,
  RequestRuntimeDynamicIntegrationValueBinding,
  RequestRuntimeDynamicOptionLoaderConfig,
  RequestRuntimeDynamicResolvedExternalRequest,
  RequestRuntimeDynamicResolvedPowerBiRequest,
  RequestRuntimeFieldDefinitionDto,
  getRuntimeValueByPath,
  parseRequestRuntimeDynamicFieldBehavior
} from '../models/request-runtime-catalog.models';
import { RequestRuntimeCatalogFacadeService } from './request-runtime-catalog-facade.service';

type RuntimeDynamicEventType = 'init' | 'change' | 'blur';

interface RuntimeDynamicBindInput {
  dynamicControls: FormGroup;
  genericFormService: GenericFormsService;
  fieldDefinitions: RequestRuntimeFieldDefinitionDto[];
  controlMap: Map<string, { fieldKey: string; instanceGroupId: number }>;
}

@Injectable()
export class RequestRuntimeDynamicFieldsFrameworkService implements OnDestroy {
  private dynamicControls: FormGroup | null = null;
  private genericFormService: GenericFormsService | null = null;

  private readonly behaviorByFieldKey = new Map<string, RequestRuntimeDynamicFieldBehaviorConfig>();
  private readonly controlNamesByFieldKey = new Map<string, string[]>();
  private readonly optionLoaderSourceMap = new Map<string, string[]>();
  private readonly requestTokenByFieldKey = new Map<string, number>();
  private readonly optionLoaderExecutionSignatureByFieldKey = new Map<string, string>();
  private readonly actionRequestTokenByActionKey = new Map<string, number>();
  private readonly actionExecutionSignatureByActionKey = new Map<string, string>();
  private readonly asyncValidationRequestTokenByFieldKey = new Map<string, number>();
  private readonly asyncValidationResultCacheByFieldKey = new Map<string, { value: string; result: ValidationErrors | null }>();
  private readonly lastEventTypeByFieldKey = new Map<string, RuntimeDynamicEventType>();
  private readonly managedRuntimeSelectionFields = new Set<string>();
  private readonly claimValuesByKey = new Map<string, string>();

  constructor(private readonly facade: RequestRuntimeCatalogFacadeService) {}

  ngOnDestroy(): void {
    this.reset();
  }

  bind(input: RuntimeDynamicBindInput): void {
    this.reset();

    this.dynamicControls = input.dynamicControls;
    this.genericFormService = input.genericFormService;
    this.captureClaimValues();

    this.mapControlsByFieldKey(input.controlMap);
    this.mapBehaviors(input.fieldDefinitions);
    this.attachAsyncValidators();
    this.runInitOptionLoaders();
  }

  reset(): void {
    if (this.genericFormService) {
      Array.from(this.managedRuntimeSelectionFields).forEach(fieldKey => {
        this.genericFormService?.clearRuntimeSelectionForField(fieldKey);
      });
    }

    this.dynamicControls = null;
    this.genericFormService = null;

    this.behaviorByFieldKey.clear();
    this.controlNamesByFieldKey.clear();
    this.optionLoaderSourceMap.clear();
    this.requestTokenByFieldKey.clear();
    this.optionLoaderExecutionSignatureByFieldKey.clear();
    this.actionRequestTokenByActionKey.clear();
    this.actionExecutionSignatureByActionKey.clear();
    this.asyncValidationRequestTokenByFieldKey.clear();
    this.asyncValidationResultCacheByFieldKey.clear();
    this.lastEventTypeByFieldKey.clear();
    this.managedRuntimeSelectionFields.clear();
    this.claimValuesByKey.clear();
  }

  handleGenericEvent(event: unknown): void {
    const parsed = event as { controlFullName?: string; eventType?: string } | null | undefined;
    const controlFullName = String(parsed?.controlFullName ?? '').trim();
    if (!controlFullName) {
      return;
    }

    const normalizedEvent = this.normalizeEventType(parsed?.eventType);
    if (!normalizedEvent) {
      return;
    }

    const fieldKey = this.resolveFieldKeyByControlName(controlFullName);
    if (!fieldKey) {
      return;
    }

    this.lastEventTypeByFieldKey.set(fieldKey, normalizedEvent);
    this.runOptionLoadersForSourceField(fieldKey, normalizedEvent);
    this.runActions(fieldKey, normalizedEvent);
    this.triggerBlurValidation(fieldKey, normalizedEvent);
  }

  private mapControlsByFieldKey(controlMap: Map<string, { fieldKey: string; instanceGroupId: number }>): void {
    controlMap.forEach((value, controlName) => {
      const normalizedFieldKey = this.normalizeFieldKey(value?.fieldKey);
      if (!normalizedFieldKey) {
        return;
      }

      const current = this.controlNamesByFieldKey.get(normalizedFieldKey) ?? [];
      current.push(controlName);
      this.controlNamesByFieldKey.set(normalizedFieldKey, current);
    });
  }

  private mapBehaviors(fieldDefinitions: RequestRuntimeFieldDefinitionDto[]): void {
    (fieldDefinitions ?? []).forEach(field => {
      const fieldKey = this.normalizeFieldKey(field.fieldKey);
      if (!fieldKey) {
        return;
      }

      const behavior = parseRequestRuntimeDynamicFieldBehavior(field.displaySettingsJson);
      if (!behavior) {
        return;
      }

      this.behaviorByFieldKey.set(fieldKey, behavior);
      if (behavior.optionLoader) {
        this.managedRuntimeSelectionFields.add(fieldKey);
        const sourceFieldKey = this.normalizeFieldKey(behavior.optionLoader.sourceFieldKey) || fieldKey;
        const targets = this.optionLoaderSourceMap.get(sourceFieldKey) ?? [];
        targets.push(fieldKey);
        this.optionLoaderSourceMap.set(sourceFieldKey, targets);
      }
    });
  }

  private attachAsyncValidators(): void {
    this.behaviorByFieldKey.forEach((behavior, fieldKey) => {
      if (!behavior.asyncValidation) {
        return;
      }

      const controlNames = this.controlNamesByFieldKey.get(fieldKey) ?? [];
      controlNames.forEach(controlName => {
        const control = this.getControlByName(controlName);
        if (!control) {
          return;
        }

        const existing = control.asyncValidator;
        const dynamicValidator = this.buildAsyncValidator(fieldKey, behavior.asyncValidation!);
        if (existing) {
          control.setAsyncValidators([existing, dynamicValidator]);
        } else {
          control.setAsyncValidators(dynamicValidator);
        }
        control.updateValueAndValidity({ emitEvent: false });
      });
    });
  }

  private buildAsyncValidator(fieldKey: string, config: RequestRuntimeDynamicAsyncValidationConfig): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const value = this.normalizeDynamicValue(control.value);
      const minLength = Number(config.minValueLength ?? 0);
      if (value.length < minLength) {
        this.asyncValidationResultCacheByFieldKey.set(fieldKey, { value, result: null });
        return of(null);
      }

      const trigger = config.trigger ?? 'blur';
      if (trigger === 'blur' && this.lastEventTypeByFieldKey.get(fieldKey) !== 'blur') {
        return of(null);
      }

      const cached = this.asyncValidationResultCacheByFieldKey.get(fieldKey);
      if (cached && cached.value === value) {
        return of(cached.result);
      }

      const requestToken = (this.asyncValidationRequestTokenByFieldKey.get(fieldKey) ?? 0) + 1;
      this.asyncValidationRequestTokenByFieldKey.set(fieldKey, requestToken);

      const debounceMs = Number(config.debounceMs ?? 320);
      return timer(debounceMs).pipe(
        switchMap(() => this.executeBehaviorRequest(config.integration, config.request, fieldKey, value)),
        map(response => {
          const rawValid = getRuntimeValueByPath(response, config.responseValidPath ?? 'data.isValid');
          const hasExplicitValid = typeof rawValid === 'boolean';
          const isValid = hasExplicitValid ? rawValid === true : true;
          if (isValid) {
            return null;
          }

          const message = this.normalizeString(getRuntimeValueByPath(response, config.responseMessagePath ?? 'data.message'))
            ?? config.defaultErrorMessage
            ?? 'القيمة المدخلة غير صالحة حسب التحقق الخارجي.';
          return { runtimeExternalValidation: message };
        }),
        map(result => this.finalizeAsyncValidationResult(fieldKey, value, requestToken, result)),
        catchError(() =>
          of(this.finalizeAsyncValidationResult(
            fieldKey,
            value,
            requestToken,
            { runtimeExternalValidation: config.defaultErrorMessage ?? 'تعذر التحقق من صحة القيمة.' }
          ))
        )
      );
    };
  }

  private runInitOptionLoaders(): void {
    this.optionLoaderSourceMap.forEach((targetFieldKeys, sourceFieldKey) => {
      targetFieldKeys.forEach(targetFieldKey => {
        const behavior = this.behaviorByFieldKey.get(targetFieldKey);
        const optionLoader = behavior?.optionLoader;
        if (!optionLoader) {
          return;
        }

        if ((optionLoader.trigger ?? 'change') !== 'init') {
          return;
        }

        const sourceValue = this.readFieldValue(sourceFieldKey);
        this.runOptionLoader(targetFieldKey, sourceFieldKey, sourceValue, optionLoader);
      });
    });
  }

  private runOptionLoadersForSourceField(sourceFieldKey: string, eventType: RuntimeDynamicEventType): void {
    const targetFieldKeys = this.optionLoaderSourceMap.get(sourceFieldKey) ?? [];
    targetFieldKeys.forEach(targetFieldKey => {
      const behavior = this.behaviorByFieldKey.get(targetFieldKey);
      const optionLoader = behavior?.optionLoader;
      if (!optionLoader) {
        return;
      }

      const trigger = optionLoader.trigger ?? 'change';
      if (trigger === 'init' || trigger !== eventType) {
        return;
      }

      const sourceValue = this.readFieldValue(sourceFieldKey);
      this.runOptionLoader(targetFieldKey, sourceFieldKey, sourceValue, optionLoader);
    });
  }

  private runOptionLoader(
    targetFieldKey: string,
    sourceFieldKey: string,
    sourceValue: string,
    optionLoader: RequestRuntimeDynamicOptionLoaderConfig
  ): void {
    if (!this.genericFormService) {
      return;
    }

    const minLength = Number(optionLoader.minQueryLength ?? 0);
    if (sourceValue.length < minLength) {
      this.optionLoaderExecutionSignatureByFieldKey.delete(targetFieldKey);
      if (optionLoader.clearWhenSourceEmpty === true) {
        this.genericFormService.setRuntimeSelectionForField(targetFieldKey, []);
      }
      return;
    }

    if (!sourceValue && optionLoader.clearWhenSourceEmpty === true) {
      this.optionLoaderExecutionSignatureByFieldKey.delete(targetFieldKey);
      this.genericFormService.setRuntimeSelectionForField(targetFieldKey, []);
      return;
    }

    const executionSignature = `${sourceFieldKey}|${sourceValue}`;
    if (this.optionLoaderExecutionSignatureByFieldKey.get(targetFieldKey) === executionSignature) {
      return;
    }
    this.optionLoaderExecutionSignatureByFieldKey.set(targetFieldKey, executionSignature);

    const requestToken = (this.requestTokenByFieldKey.get(targetFieldKey) ?? 0) + 1;
    this.requestTokenByFieldKey.set(targetFieldKey, requestToken);

    this.executeBehaviorRequest(optionLoader.integration, optionLoader.request, sourceFieldKey, sourceValue).subscribe(response => {
      if (this.requestTokenByFieldKey.get(targetFieldKey) !== requestToken) {
        return;
      }

      const mappedOptions = this.mapOptions(response, optionLoader);
      this.genericFormService?.setRuntimeSelectionForField(targetFieldKey, mappedOptions);
      this.normalizeCurrentSelectionValue(targetFieldKey, mappedOptions);
    });
  }

  private runActions(sourceFieldKey: string, eventType: RuntimeDynamicEventType): void {
    const behavior = this.behaviorByFieldKey.get(sourceFieldKey);
    if (!behavior?.actions || behavior.actions.length === 0) {
      return;
    }

    const sourceValue = this.readFieldValue(sourceFieldKey);
    behavior.actions.forEach((action, actionIndex) => {
      const trigger = action.trigger ?? 'change';
      if (trigger !== eventType) {
        return;
      }

      const actionKey = this.buildActionKey(sourceFieldKey, actionIndex);
      const executionSignature = this.buildActionExecutionSignature(eventType, sourceValue, action);
      if (this.actionExecutionSignatureByActionKey.get(actionKey) === executionSignature) {
        return;
      }
      this.actionExecutionSignatureByActionKey.set(actionKey, executionSignature);

      if (!sourceValue && action.clearTargetsWhenEmpty === true) {
        this.applyActionPatches(action, null, sourceFieldKey, sourceValue);
        return;
      }

      if (action.whenEquals != null && sourceValue !== String(action.whenEquals)) {
        return;
      }

      if (!action.request) {
        this.applyActionPatches(action, null, sourceFieldKey, sourceValue);
        return;
      }

      const requestToken = (this.actionRequestTokenByActionKey.get(actionKey) ?? 0) + 1;
      this.actionRequestTokenByActionKey.set(actionKey, requestToken);

      this.executeBehaviorRequest(action.integration, action.request, sourceFieldKey, sourceValue).subscribe(response => {
        if (this.actionRequestTokenByActionKey.get(actionKey) !== requestToken) {
          return;
        }
        this.applyActionPatches(action, response, sourceFieldKey, sourceValue);
      });
    });
  }

  private applyActionPatches(
    action: RequestRuntimeDynamicActionConfig,
    response: unknown,
    sourceFieldKey: string,
    sourceValue: string
  ): void {
    const context = this.buildInterpolationContext(sourceFieldKey, sourceValue);
    action.patches.forEach(patch => {
      const targetFieldKey = this.normalizeFieldKey(patch.targetFieldKey);
      if (!targetFieldKey) {
        return;
      }

      const targetControlName = (this.controlNamesByFieldKey.get(targetFieldKey) ?? [])[0];
      if (!targetControlName) {
        return;
      }

      const targetControl = this.getControlByName(targetControlName);
      if (!targetControl) {
        return;
      }

      let nextValue: unknown = undefined;
      if (patch.valueTemplate) {
        nextValue = this.interpolateTemplate(patch.valueTemplate, context);
      } else if (patch.valuePath) {
        nextValue = getRuntimeValueByPath(response, patch.valuePath);
      } else if (response != null) {
        nextValue = response;
      }

      if ((nextValue == null || nextValue === '') && patch.clearWhenMissing === true) {
        this.patchControlValueIfChanged(targetControl, '');
        return;
      }

      if (nextValue != null) {
        this.patchControlValueIfChanged(targetControl, nextValue);
      }
    });
  }

  private triggerBlurValidation(fieldKey: string, eventType: RuntimeDynamicEventType): void {
    if (eventType !== 'blur') {
      return;
    }

    const behavior = this.behaviorByFieldKey.get(fieldKey);
    if (!behavior?.asyncValidation || (behavior.asyncValidation.trigger ?? 'blur') !== 'blur') {
      return;
    }

    const controlNames = this.controlNamesByFieldKey.get(fieldKey) ?? [];
    controlNames.forEach(controlName => {
      this.getControlByName(controlName)?.updateValueAndValidity({ emitEvent: false });
    });
  }

  private executeBehaviorRequest(
    integration: RequestRuntimeDynamicIntegrationRequestConfig | undefined,
    legacyRequest: RequestRuntimeDynamicHttpRequestConfig | undefined,
    sourceFieldKey: string,
    sourceValue: string
  ): Observable<unknown> {
    if (integration) {
      return this.executeIntegrationRequest(integration, sourceFieldKey, sourceValue);
    }

    if (!legacyRequest) {
      return of(undefined);
    }

    return this.executeLegacyRequest(legacyRequest, sourceFieldKey, sourceValue);
  }

  private executeLegacyRequest(
    request: RequestRuntimeDynamicHttpRequestConfig,
    sourceFieldKey: string,
    sourceValue: string
  ): Observable<unknown> {
    const context = this.buildInterpolationContext(sourceFieldKey, sourceValue);
    const payload: RequestRuntimeDynamicHttpRequestConfig = {
      url: this.interpolateTemplate(request.url, context),
      method: request.method,
      query: this.interpolateRecord(request.query, context) ?? undefined,
      headers: this.interpolateRecord(request.headers, context) ?? undefined,
      body: this.interpolateUnknown(request.body, context)
    };

    return this.facade.executeDynamicRequest(payload).pipe(
      map(response => response?.data),
      catchError(() => of(undefined))
    );
  }

  private executeIntegrationRequest(
    integration: RequestRuntimeDynamicIntegrationRequestConfig,
    sourceFieldKey: string,
    sourceValue: string
  ): Observable<unknown> {
    if (integration.sourceType === 'powerbi') {
      const payload = this.buildResolvedPowerBiRequest(integration, sourceFieldKey, sourceValue);
      if (!payload) {
        return of(undefined);
      }

      return this.facade.executeDynamicPowerBiRequest(payload).pipe(
        map(response => response?.data),
        catchError(() => of(undefined))
      );
    }

    const payload = this.buildResolvedExternalRequest(integration, sourceFieldKey, sourceValue);
    if (!payload) {
      return of(undefined);
    }

    return this.facade.executeDynamicExternalRequest(payload).pipe(
      map(response => response?.data),
      catchError(() => of(undefined))
    );
  }

  private buildResolvedPowerBiRequest(
    integration: RequestRuntimeDynamicIntegrationRequestConfig,
    sourceFieldKey: string,
    sourceValue: string
  ): RequestRuntimeDynamicResolvedPowerBiRequest | null {
    if (integration.sourceType !== 'powerbi') {
      return null;
    }

    const statementId = Number(integration.statementId ?? 0);
    if (!Number.isFinite(statementId) || statementId <= 0) {
      return null;
    }

    return {
      statementId: Math.trunc(statementId),
      requestFormat: integration.requestFormat ?? 'json',
      parameters: this.resolveNameValueBindingsToRecord(integration.parameters, sourceFieldKey, sourceValue)
    };
  }

  private buildResolvedExternalRequest(
    integration: RequestRuntimeDynamicIntegrationRequestConfig,
    sourceFieldKey: string,
    sourceValue: string
  ): RequestRuntimeDynamicResolvedExternalRequest | null {
    if (integration.sourceType !== 'external') {
      return null;
    }

    const fullUrl = this.normalizeString(integration.fullUrl);
    if (!fullUrl) {
      return null;
    }

    const query = this.resolveNameValueBindingsToRecord(integration.query, sourceFieldKey, sourceValue);
    const requestHeaders = this.resolveNameValueBindingsToRecord(integration.headers, sourceFieldKey, sourceValue);
    const authMode = this.normalizeAuthMode(integration.auth?.mode);
    const authHeaders = this.resolveAuthHeaders(
      authMode,
      integration.auth,
      sourceFieldKey,
      sourceValue
    );
    const headers = this.mergeHeaderRecords(requestHeaders, authHeaders);
    const bodyRecord = this.resolveNameValueBindingsToRecord(integration.body, sourceFieldKey, sourceValue);
    const body = Object.keys(bodyRecord).length > 0 ? bodyRecord : undefined;

    return {
      fullUrl,
      method: this.normalizeHttpMethod(integration.method),
      requestFormat: integration.requestFormat ?? 'json',
      authMode,
      query: Object.keys(query).length > 0 ? query : undefined,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body
    };
  }

  private resolveAuthHeaders(
    authMode: RequestRuntimeDynamicIntegrationAuthMode,
    authConfig: RequestRuntimeDynamicIntegrationAuthConfig | undefined,
    sourceFieldKey: string,
    sourceValue: string
  ): Record<string, string> {
    if (authMode === 'custom') {
      return this.resolveNameValueBindingsToRecord(authConfig?.customHeaders, sourceFieldKey, sourceValue);
    }

    if (authMode === 'token') {
      const tokenValue = this.resolveIntegrationValueBinding(authConfig?.token, sourceFieldKey, sourceValue);
      const normalizedToken = this.normalizeString(tokenValue);
      if (!normalizedToken) {
        return {};
      }

      return {
        Authorization: `Bearer ${normalizedToken}`
      };
    }

    if (authMode === 'basic') {
      const username = this.resolveIntegrationValueBinding(authConfig?.username, sourceFieldKey, sourceValue);
      const password = this.resolveIntegrationValueBinding(authConfig?.password, sourceFieldKey, sourceValue);
      const normalizedUsername = this.normalizeString(username);
      if (!normalizedUsername) {
        return {};
      }

      const authPayload = `${normalizedUsername}:${password ?? ''}`;
      const encodedAuthPayload = this.encodeBase64(authPayload);
      return {
        Authorization: `Basic ${encodedAuthPayload}`
      };
    }

    return {};
  }

  private resolveNameValueBindingsToRecord(
    bindings: RequestRuntimeDynamicIntegrationNameValueBinding[] | undefined,
    sourceFieldKey: string,
    sourceValue: string
  ): Record<string, string> {
    if (!Array.isArray(bindings) || bindings.length === 0) {
      return {};
    }

    const record: Record<string, string> = {};
    bindings.forEach(binding => {
      const key = this.normalizeString(binding?.name);
      if (!key) {
        return;
      }

      const value = this.resolveIntegrationValueBinding(binding.value, sourceFieldKey, sourceValue);
      record[key] = value;
    });

    return record;
  }

  private resolveIntegrationValueBinding(
    valueBinding: RequestRuntimeDynamicIntegrationValueBinding | undefined,
    sourceFieldKey: string,
    sourceValue: string
  ): string {
    if (!valueBinding) {
      return '';
    }

    let resolved = '';
    if (valueBinding.source === 'static') {
      resolved = this.interpolateTemplate(valueBinding.staticValue ?? '', this.buildInterpolationContext(sourceFieldKey, sourceValue));
    } else if (valueBinding.source === 'field') {
      resolved = this.resolveFieldValueForBinding(valueBinding.fieldKey, sourceFieldKey, sourceValue);
    } else if (valueBinding.source === 'claim') {
      resolved = this.resolveClaimValue(valueBinding.claimKey);
    }

    if (!resolved) {
      return valueBinding.fallbackValue ?? '';
    }

    return resolved;
  }

  private resolveFieldValueForBinding(fieldKey: string | undefined, sourceFieldKey: string, sourceValue: string): string {
    const normalizedFieldKey = this.normalizeFieldKey(fieldKey);
    if (!normalizedFieldKey) {
      return '';
    }

    if (normalizedFieldKey === sourceFieldKey) {
      return sourceValue;
    }

    return this.readFieldValue(normalizedFieldKey);
  }

  private resolveClaimValue(claimKey: string | undefined): string {
    const normalized = this.normalizeString(claimKey)?.toLowerCase();
    if (!normalized) {
      return '';
    }

    return this.claimValuesByKey.get(normalized) ?? '';
  }

  private mergeHeaderRecords(...records: Array<Record<string, string> | undefined>): Record<string, string> {
    const result: Record<string, string> = {};
    records.forEach(record => {
      if (!record) {
        return;
      }

      Object.entries(record).forEach(([key, value]) => {
        const normalizedKey = this.normalizeString(key);
        if (!normalizedKey) {
          return;
        }

        result[normalizedKey] = String(value ?? '');
      });
    });

    return result;
  }

  private mapOptions(payload: unknown, config: RequestRuntimeDynamicOptionLoaderConfig): selection[] {
    const listSource = config.responseListPath
      ? getRuntimeValueByPath(payload, config.responseListPath)
      : this.resolveFallbackArray(payload);

    if (!Array.isArray(listSource)) {
      return [];
    }

    return listSource
      .map(item => this.mapOptionItem(item, config))
      .filter((item): item is selection => item != null);
  }

  private mapOptionItem(item: unknown, config: RequestRuntimeDynamicOptionLoaderConfig): selection | null {
    if (item == null) {
      return null;
    }

    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      const value = String(item);
      return { key: value, name: value };
    }

    if (typeof item !== 'object' || Array.isArray(item)) {
      return null;
    }

    const valueCandidate = this.normalizeString(
      getRuntimeValueByPath(item, config.responseValuePath)
      ?? (item as Record<string, unknown>)['value']
      ?? (item as Record<string, unknown>)['id']
      ?? (item as Record<string, unknown>)['key']
      ?? (item as Record<string, unknown>)['code']
    );
    const labelCandidate = this.normalizeString(
      getRuntimeValueByPath(item, config.responseLabelPath)
      ?? (item as Record<string, unknown>)['label']
      ?? (item as Record<string, unknown>)['name']
      ?? (item as Record<string, unknown>)['text']
      ?? valueCandidate
    );

    if (!valueCandidate && !labelCandidate) {
      return null;
    }

    return {
      key: valueCandidate ?? labelCandidate ?? '',
      name: labelCandidate ?? valueCandidate ?? ''
    };
  }

  private normalizeCurrentSelectionValue(targetFieldKey: string, options: selection[]): void {
    const targetControlName = (this.controlNamesByFieldKey.get(targetFieldKey) ?? [])[0];
    if (!targetControlName) {
      return;
    }

    const control = this.getControlByName(targetControlName);
    if (!control) {
      return;
    }

    if (options.length === 0) {
      this.patchControlValueIfChanged(control, '');
      return;
    }

    const currentValue = this.normalizeDynamicValue(control.value);
    const exists = options.some(item => this.normalizeDynamicValue(item.key) === currentValue);
    if (!exists) {
      this.patchControlValueIfChanged(control, '');
    }
  }

  private buildInterpolationContext(sourceFieldKey: string, sourceValue: string): Record<string, string> {
    const context: Record<string, string> = {
      value: sourceValue,
      sourceFieldKey
    };

    this.controlNamesByFieldKey.forEach((controlNames, fieldKey) => {
      const controlName = controlNames[0];
      const value = controlName ? this.normalizeDynamicValue(this.getControlByName(controlName)?.value) : '';
      context[fieldKey] = value;
      context[fieldKey.toUpperCase()] = value;
      context[fieldKey.toLowerCase()] = value;
    });

    this.claimValuesByKey.forEach((value, key) => {
      context[`claim.${key}`] = value;
      context[`claims.${key}`] = value;
    });

    return context;
  }

  private captureClaimValues(): void {
    this.claimValuesByKey.clear();

    const token = this.readCurrentToken();
    if (!token) {
      return;
    }

    const claimsPayload = this.tryReadJwtPayload(token);
    if (!claimsPayload || typeof claimsPayload !== 'object' || Array.isArray(claimsPayload)) {
      return;
    }

    Object.entries(claimsPayload).forEach(([key, value]) => {
      const normalizedKey = this.normalizeString(key)?.toLowerCase();
      if (!normalizedKey) {
        return;
      }

      const normalizedValue = this.normalizeClaimValue(value);
      if (normalizedValue == null) {
        return;
      }

      this.claimValuesByKey.set(normalizedKey, normalizedValue);

      const alias = this.extractClaimAlias(normalizedKey);
      if (alias && !this.claimValuesByKey.has(alias)) {
        this.claimValuesByKey.set(alias, normalizedValue);
      }
    });
  }

  private readCurrentToken(): string | null {
    try {
      const raw = localStorage.getItem('ConnectToken');
      const normalized = this.normalizeString(raw);
      return normalized ?? null;
    } catch {
      return null;
    }
  }

  private tryReadJwtPayload(token: string): Record<string, unknown> | null {
    const segments = String(token ?? '').split('.');
    if (segments.length < 2) {
      return null;
    }

    try {
      const payload = segments[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const normalizedPayload = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const decoded = atob(normalizedPayload);
      const parsed = JSON.parse(decoded);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private normalizeClaimValue(value: unknown): string | null {
    if (value == null) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : null;
    }

    return null;
  }

  private extractClaimAlias(claimKey: string): string | null {
    const segments = String(claimKey ?? '')
      .split(/[/:]/g)
      .map(segment => segment.trim().toLowerCase())
      .filter(segment => segment.length > 0);

    if (segments.length === 0) {
      return null;
    }

    return segments[segments.length - 1];
  }

  private interpolateRecord(source: Record<string, string> | undefined, context: Record<string, string>): Record<string, string> | null {
    if (!source) {
      return null;
    }

    const result: Record<string, string> = {};
    Object.entries(source).forEach(([key, value]) => {
      const normalizedKey = String(key ?? '').trim();
      if (!normalizedKey) {
        return;
      }

      result[normalizedKey] = this.interpolateTemplate(value, context);
    });

    return Object.keys(result).length > 0 ? result : null;
  }

  private interpolateUnknown(value: unknown, context: Record<string, string>): unknown {
    if (typeof value === 'string') {
      return this.interpolateTemplate(value, context);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.interpolateUnknown(item, context));
    }

    if (value && typeof value === 'object') {
      const mapped: Record<string, unknown> = {};
      Object.entries(value as Record<string, unknown>).forEach(([key, candidate]) => {
        mapped[key] = this.interpolateUnknown(candidate, context);
      });
      return mapped;
    }

    return value;
  }

  private interpolateTemplate(template: string, context: Record<string, string>): string {
    const raw = String(template ?? '');
    return raw.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_segment, token) => context[String(token).trim()] ?? '');
  }

  private resolveFallbackArray(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    const candidates = [
      getRuntimeValueByPath(payload, 'data.items'),
      getRuntimeValueByPath(payload, 'data'),
      getRuntimeValueByPath(payload, 'items'),
      getRuntimeValueByPath(payload, 'result.items')
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    return [];
  }

  private readFieldValue(fieldKey: string): string {
    const controlName = (this.controlNamesByFieldKey.get(fieldKey) ?? [])[0];
    return controlName ? this.normalizeDynamicValue(this.getControlByName(controlName)?.value) : '';
  }

  private getControlByName(controlName: string): AbstractControl | null {
    if (!this.dynamicControls || !this.genericFormService) {
      return null;
    }

    return this.genericFormService.GetControl(this.dynamicControls, controlName);
  }

  private resolveFieldKeyByControlName(controlName: string): string | null {
    const normalizedControlName = String(controlName ?? '').trim();
    if (!normalizedControlName) {
      return null;
    }

    for (const [fieldKey, controlNames] of this.controlNamesByFieldKey.entries()) {
      if (controlNames.includes(normalizedControlName)) {
        return fieldKey;
      }
    }

    const direct = this.normalizeFieldKey(normalizedControlName.split('|')[0]);
    return direct.length > 0 ? direct : null;
  }

  private normalizeEventType(value: unknown): RuntimeDynamicEventType | null {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'blur') {
      return 'blur';
    }

    if (
      normalized === 'change'
      || normalized === 'input'
      || normalized === 'onchange'
      || normalized === 'oninput'
      || normalized === 'treeselect'
      || normalized === 'treeunselect'
      || normalized === 'select'
      || normalized === 'click'
      || normalized === 'userselected'
      || normalized === 'filechange'
      || normalized === 'fileclear'
    ) {
      return 'change';
    }

    return null;
  }

  private normalizeAuthMode(value: unknown): RequestRuntimeDynamicIntegrationAuthMode {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'none') {
      return 'none';
    }

    if (normalized === 'token' || normalized === 'bearertoken' || normalized === 'bearer_token' || normalized === 'bearer-token') {
      return 'token';
    }

    if (normalized === 'basic' || normalized === 'basicauth' || normalized === 'basic_auth' || normalized === 'basic-auth') {
      return 'basic';
    }

    if (normalized === 'custom') {
      return 'custom';
    }

    return 'bearerCurrent';
  }

  private normalizeHttpMethod(value: unknown): RequestRuntimeDynamicHttpMethod {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH') {
      return normalized;
    }

    return 'GET';
  }

  private normalizeFieldKey(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeDynamicValue(value: unknown): string {
    if (value == null) {
      return '';
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      const payload = value as Record<string, unknown>;
      if (payload['key'] != null) {
        return String(payload['key']);
      }
      if (payload['value'] != null) {
        return String(payload['value']);
      }
    }

    return String(value);
  }

  private normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private encodeBase64(value: string): string {
    const normalized = String(value ?? '');
    try {
      return btoa(unescape(encodeURIComponent(normalized)));
    } catch {
      try {
        return btoa(normalized);
      } catch {
        return '';
      }
    }
  }

  private finalizeAsyncValidationResult(
    fieldKey: string,
    value: string,
    requestToken: number,
    result: ValidationErrors | null
  ): ValidationErrors | null {
    if (this.asyncValidationRequestTokenByFieldKey.get(fieldKey) !== requestToken) {
      return this.asyncValidationResultCacheByFieldKey.get(fieldKey)?.result ?? null;
    }

    this.asyncValidationResultCacheByFieldKey.set(fieldKey, { value, result });
    return result;
  }

  private patchControlValueIfChanged(control: AbstractControl, value: unknown): void {
    if (this.normalizeDynamicValue(control.value) === this.normalizeDynamicValue(value)) {
      return;
    }

    control.patchValue(value, { emitEvent: false });
    control.updateValueAndValidity({ emitEvent: false, onlySelf: true });
  }

  private buildActionKey(sourceFieldKey: string, actionIndex: number): string {
    return `${sourceFieldKey}::${actionIndex}`;
  }

  private buildActionExecutionSignature(
    eventType: RuntimeDynamicEventType,
    sourceValue: string,
    action: RequestRuntimeDynamicActionConfig
  ): string {
    return `${eventType}|${sourceValue}|${String(action.whenEquals ?? '')}`;
  }
}
