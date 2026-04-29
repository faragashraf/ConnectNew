import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DynamicMetadataService } from 'src/app/shared/services/helper/dynamic-metadata.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import {
  SummerUnitFreezeDetailsDto,
  SummerWorkflowCommonResponse,
  SummerUnitFreezeDto
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
  selector: 'app-summer-unit-freeze-details-page',
  templateUrl: './summer-unit-freeze-details-page.component.html',
  styleUrls: ['./summer-unit-freeze-details-page.component.scss']
})
export class SummerUnitFreezeDetailsPageComponent implements OnInit {
  private static readonly RefreezePrefillStorageKey = 'summer.unitFreeze.refreeze.prefill';
  freezeId = 0;
  details: SummerUnitFreezeDetailsDto | null = null;
  destinations: SummerDestinationConfig[] = [];

  loading = false;
  releasing = false;
  detailsError = '';

  private readonly seasonYear = SUMMER_SEASON_YEAR;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dynamicMetadataService: DynamicMetadataService,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly msg: MsgsService
  ) {}

  ngOnInit(): void {
    const freezeId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    if (!Number.isFinite(freezeId) || freezeId <= 0) {
      this.msg.msgError('خطأ', '<h5>رقم التجميد غير صحيح.</h5>', true);
      this.backToList();
      return;
    }

    this.freezeId = Math.floor(freezeId);
    this.loadDestinationCatalog();
    this.loadDetails();
  }

  backToList(): void {
    this.router.navigateByUrl('/Admin/resorts/unit-freeze');
  }

  openRefreezeCreate(): void {
    const freeze = this.details?.freeze;
    if (!freeze) {
      return;
    }

    this.persistRefreezePrefill(freeze.categoryId, freeze.waveCode, freeze.familyCount, freeze.freezeId);
    this.router.navigate(['/Admin/resorts/unit-freeze/create'], {
      queryParams: {
        resortId: freeze.categoryId,
        waveId: freeze.waveCode,
        capacity: freeze.familyCount,
        fromFreezeId: freeze.freezeId
      }
    });
  }

  releaseAll(): void {
    if (!this.details?.freeze?.isActive || this.releasing) {
      return;
    }

    this.msg.msgConfirm('سيتم فك التجميد لكل الوحدات غير المستخدمة داخل هذا السجل.', 'تأكيد فك التجميد').then(confirmed => {
      if (!confirmed) {
        return;
      }

      this.releasing = true;
      this.summerWorkflowController.releaseAdminUnitFreeze(this.freezeId).subscribe({
        next: response => {
          if (response?.isSuccess) {
            this.msg.msgSuccess('تم فك التجميد بنجاح.');
            this.loadDetails();
            return;
          }

          this.msg.msgError('خطأ', `<h5>${this.collectFreezeErrors(response)}</h5>`, true);
        },
        error: () => {
          this.msg.msgError('خطأ', '<h5>تعذر تنفيذ فك التجميد حالياً.</h5>', true);
        },
        complete: () => {
          this.releasing = false;
        }
      });
    });
  }

  private loadDestinationCatalog(): void {
    this.dynamicMetadataService
      .getMendJson<unknown>(SUMMER_DYNAMIC_APPLICATION_ID, SUMMER_DESTINATION_CATALOG_KEY)
      .subscribe({
        next: response => {
          if (response?.isSuccess) {
            this.destinations = parseSummerDestinationCatalog(response.data, this.seasonYear);
          } else {
            this.destinations = [];
          }
        },
        error: () => {
          this.destinations = [];
        }
      });
  }

  private loadDetails(): void {
    if (this.freezeId <= 0) {
      return;
    }

    this.loading = true;
    this.detailsError = '';
    this.summerWorkflowController.getAdminUnitFreezeDetails(this.freezeId).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          this.details = response.data;
          this.detailsError = '';
          return;
        }

        this.details = null;
        this.detailsError = this.collectDetailsErrors(response);
      },
      error: () => {
        this.details = null;
        this.detailsError = 'تعذر تحميل تفاصيل التجميد حالياً.';
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  private collectDetailsErrors(
    response: SummerWorkflowCommonResponse<SummerUnitFreezeDetailsDto> | null | undefined
  ): string {
    const messages = (response?.errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0);

    return messages.length > 0 ? messages.join('<br/>') : 'تعذر تحميل تفاصيل التجميد.';
  }

  private collectFreezeErrors(
    response: SummerWorkflowCommonResponse<SummerUnitFreezeDto> | null | undefined
  ): string {
    const messages = (response?.errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0);

    return messages.length > 0 ? messages.join('<br/>') : 'تعذر فك التجميد.';
  }

  private persistRefreezePrefill(
    resortId: number,
    waveId: string,
    capacity: number,
    fromFreezeId: number
  ): void {
    try {
      sessionStorage.setItem(
        SummerUnitFreezeDetailsPageComponent.RefreezePrefillStorageKey,
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
