import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { DynamicMetadataService } from 'src/app/shared/services/helper/dynamic-metadata.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import {
  AdminUnitFreezeListQuery,
  SummerUnitFreezeDto,
  SummerWorkflowCommonResponse
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';
import {
  parseSummerDestinationCatalog,
  SUMMER_SEASON_YEAR,
  SummerDestinationConfig
} from '../summer-requests-workspace/summer-requests-workspace.config';
import {
  SUMMER_DESTINATION_CATALOG_KEY,
  SUMMER_DYNAMIC_APPLICATION_ID
} from '../summer-shared/core/summer-feature.config';

@Component({
  selector: 'app-summer-unit-freeze-list-page',
  templateUrl: './summer-unit-freeze-list-page.component.html',
  styleUrls: ['./summer-unit-freeze-list-page.component.scss']
})
export class SummerUnitFreezeListPageComponent implements OnInit {
  private static readonly RefreezePrefillStorageKey = 'summer.unitFreeze.refreeze.prefill';
  filtersForm: FormGroup;

  destinations: SummerDestinationConfig[] = [];
  freezes: SummerUnitFreezeDto[] = [];

  loadingDestinations = false;
  loadingList = false;
  listError = '';

  private readonly seasonYear = SUMMER_SEASON_YEAR;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dynamicMetadataService: DynamicMetadataService,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly router: Router,
    private readonly msg: MsgsService
  ) {
    this.filtersForm = this.fb.group({
      resortId: [null],
      waveId: [''],
      capacity: [null],
      isActive: ['all']
    });
  }

  ngOnInit(): void {
    this.loadDestinationCatalog();
  }

  get selectedDestination(): SummerDestinationConfig | undefined {
    const resortId = Number(this.filtersForm.get('resortId')?.value ?? 0);
    return this.destinations.find(item => item.categoryId === resortId);
  }

  get filterWaves() {
    return this.selectedDestination?.waves ?? [];
  }

  get filterCapacities(): number[] {
    return this.selectedDestination?.familyOptions ?? [];
  }

  onResortChanged(): void {
    this.filtersForm.patchValue(
      {
        waveId: '',
        capacity: null
      },
      { emitEvent: false }
    );
  }

  applyFilters(): void {
    this.loadFreezes();
  }

  clearFilters(): void {
    this.filtersForm.patchValue(
      {
        resortId: null,
        waveId: '',
        capacity: null,
        isActive: 'all'
      },
      { emitEvent: false }
    );
    this.loadFreezes();
  }

  openCreatePage(): void {
    this.router.navigateByUrl('/Admin/resorts/unit-freeze/create');
  }

  openRefreezePage(row: SummerUnitFreezeDto): void {
    this.persistRefreezePrefill(row.categoryId, row.waveCode, row.familyCount, row.freezeId);
    this.router.navigate(['/Admin/resorts/unit-freeze/create'], {
      queryParams: {
        resortId: row.categoryId,
        waveId: row.waveCode,
        capacity: row.familyCount,
        fromFreezeId: row.freezeId
      }
    });
  }

  openDetails(freezeId: number): void {
    this.router.navigateByUrl(`/Admin/resorts/unit-freeze/${freezeId}`);
  }

  releaseFreeze(freezeId: number): void {
    this.msg.msgConfirm('سيتم فك التجميد لكل الوحدات غير المستخدمة داخل هذا السجل.', 'تأكيد فك التجميد').then(confirmed => {
      if (!confirmed) {
        return;
      }

      this.loadingList = true;
      this.summerWorkflowController.releaseAdminUnitFreeze(freezeId).subscribe({
        next: response => {
          if (response?.isSuccess) {
            this.msg.msgSuccess('تم فك التجميد بنجاح.');
            this.loadFreezes(true);
            return;
          }

          this.loadingList = false;
          this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
        },
        error: () => {
          this.loadingList = false;
          this.msg.msgError('خطأ', '<h5>تعذر تنفيذ فك التجميد حالياً.</h5>', true);
        }
      });
    });
  }

  refresh(): void {
    this.loadFreezes();
  }

  private loadDestinationCatalog(): void {
    this.loadingDestinations = true;

    this.dynamicMetadataService
      .getMendJson<unknown>(SUMMER_DYNAMIC_APPLICATION_ID, SUMMER_DESTINATION_CATALOG_KEY)
      .subscribe({
        next: response => {
          if (response?.isSuccess) {
            this.destinations = parseSummerDestinationCatalog(response.data, this.seasonYear);
          } else {
            this.destinations = [];
          }

          this.loadFreezes();
        },
        error: () => {
          this.destinations = [];
          this.loadFreezes();
        },
        complete: () => {
          this.loadingDestinations = false;
        }
      });
  }

  private loadFreezes(silent = false): void {
    this.loadingList = true;
    if (!silent) {
      this.listError = '';
    }

    this.summerWorkflowController.getAdminUnitFreezes(this.buildQuery()).subscribe({
      next: response => {
        if (response?.isSuccess && Array.isArray(response.data)) {
          this.freezes = response.data;
          this.listError = '';
          return;
        }

        this.freezes = [];
        this.listError = this.collectErrors(response);
      },
      error: () => {
        this.freezes = [];
        this.listError = 'تعذر تحميل قائمة التجميد حالياً.';
      },
      complete: () => {
        this.loadingList = false;
      }
    });
  }

  private buildQuery(): AdminUnitFreezeListQuery {
    const raw = this.filtersForm.getRawValue();
    const isActiveToken = String(raw.isActive ?? 'all').trim().toLowerCase();

    return {
      resortId: Number(raw.resortId ?? 0) || null,
      waveId: String(raw.waveId ?? '').trim(),
      capacity: Number(raw.capacity ?? 0) || null,
      isActive: isActiveToken === 'all'
        ? null
        : isActiveToken === 'active'
          ? true
          : false
    };
  }

  private collectErrors(
    response: SummerWorkflowCommonResponse<unknown> | null | undefined
  ): string {
    const messages = (response?.errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0);

    return messages.length > 0 ? messages.join('<br/>') : 'تعذر تحميل بيانات التجميد.';
  }

  private persistRefreezePrefill(
    resortId: number,
    waveId: string,
    capacity: number,
    fromFreezeId: number
  ): void {
    try {
      sessionStorage.setItem(
        SummerUnitFreezeListPageComponent.RefreezePrefillStorageKey,
        JSON.stringify({
          resortId,
          waveId,
          capacity,
          fromFreezeId,
          timestampUtc: new Date().toISOString()
        })
      );
    } catch {
      // No-op. Query params are still sent as the primary source.
    }
  }
}
