import { of } from 'rxjs';
import {
  RequestRuntimeCatalogDto,
  REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE,
  RuntimeApiResponse
} from '../models/request-runtime-catalog.models';
import { RequestRuntimeCatalogApiService } from './request-runtime-catalog-api.service';
import { RequestRuntimeCatalogFacadeService } from './request-runtime-catalog-facade.service';

describe('RequestRuntimeCatalogFacadeService', () => {
  let facade: RequestRuntimeCatalogFacadeService;

  const buildCatalog = (): RequestRuntimeCatalogDto => ({
    generatedAtUtc: '2026-01-01T00:00:00Z',
    totalAvailableRequests: 2,
    applications: [
      {
        applicationId: 'APP-1',
        applicationName: 'تطبيق أول',
        totalAvailableRequests: 1,
        categories: [
          {
            categoryId: 10,
            parentCategoryId: 0,
            categoryName: 'التصنيف الرئيسي',
            applicationId: 'APP-1',
            isRequestType: false,
            canStart: false,
            displayOrder: 1,
            startStage: null,
            organizationalUnitScope: null,
            availabilityReasons: [],
            runtimeWarnings: [],
            children: [
              {
                categoryId: 11,
                parentCategoryId: 10,
                categoryName: 'طلب متاح',
                applicationId: 'APP-1',
                isRequestType: true,
                canStart: true,
                displayOrder: 1,
                startStage: { stageName: 'بداية الطلب' },
                organizationalUnitScope: { scopeMode: 'LegacyRoot', unitIds: ['10'], scopeLabel: 'نطاق 10' },
                availabilityReasons: ['متاح'],
                runtimeWarnings: [],
                children: []
              },
              {
                categoryId: 12,
                parentCategoryId: 10,
                categoryName: 'طلب غير متاح',
                applicationId: 'APP-1',
                isRequestType: true,
                canStart: false,
                displayOrder: 2,
                startStage: { stageName: 'بداية أخرى' },
                organizationalUnitScope: { scopeMode: 'LegacyRoot', unitIds: ['10'], scopeLabel: 'نطاق 10' },
                availabilityReasons: ['غير متاح'],
                runtimeWarnings: [],
                children: []
              }
            ]
          }
        ]
      },
      {
        applicationId: 'APP-2',
        applicationName: 'تطبيق ثان',
        totalAvailableRequests: 1,
        categories: [
          {
            categoryId: 21,
            parentCategoryId: 0,
            categoryName: 'طلب ثان متاح',
            applicationId: 'APP-2',
            isRequestType: true,
            canStart: true,
            displayOrder: 1,
            startStage: { stageName: 'مرحلة ثانية' },
            organizationalUnitScope: { scopeMode: 'LegacyRoot', unitIds: ['21'], scopeLabel: 'نطاق 21' },
            availabilityReasons: ['متاح'],
            runtimeWarnings: [],
            children: []
          }
        ]
      }
    ]
  });

  beforeEach(() => {
    const apiMock: Partial<RequestRuntimeCatalogApiService> = {
      getRegistrationTree: () => of({
        data: buildCatalog(),
        errors: []
      } as RuntimeApiResponse<RequestRuntimeCatalogDto>)
    };

    facade = new RequestRuntimeCatalogFacadeService(apiMock as RequestRuntimeCatalogApiService);
  });

  it('buildTreeNodes should keep startable requests and their ancestors only', () => {
    const catalog = buildCatalog();

    const nodes = facade.buildTreeNodes(catalog, REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE, '');
    const visibleCount = facade.countVisibleStartableRequests(nodes);

    expect(visibleCount).toBe(2);

    const appOneParent = nodes.find(node => Number(node.data?.categoryId) === 10);
    expect(appOneParent).toBeTruthy();

    const appOneChildren = (appOneParent?.children ?? []) as any[];
    expect(appOneChildren.length).toBe(1);
    expect(Number(appOneChildren[0]?.data?.categoryId)).toBe(11);
  });

  it('buildTreeNodes should filter by search text and keep matching branch', () => {
    const catalog = buildCatalog();

    const nodes = facade.buildTreeNodes(catalog, REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE, 'مرحلة ثانية');

    expect(nodes.length).toBe(1);
    expect(Number(nodes[0]?.data?.categoryId)).toBe(21);
    expect(facade.countVisibleStartableRequests(nodes)).toBe(1);
  });

  it('countTotalStartableRequests should respect selected application', () => {
    const catalog = buildCatalog();

    expect(facade.countTotalStartableRequests(catalog, REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE)).toBe(2);
    expect(facade.countTotalStartableRequests(catalog, 'APP-1')).toBe(1);
    expect(facade.countTotalStartableRequests(catalog, 'APP-2')).toBe(1);
  });
});
