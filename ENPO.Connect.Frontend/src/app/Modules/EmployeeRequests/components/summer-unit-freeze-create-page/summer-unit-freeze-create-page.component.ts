import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { DynamicMetadataService } from 'src/app/shared/services/helper/dynamic-metadata.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import {
  AdminUnitFreezeCreatePayload,
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
  selector: 'app-summer-unit-freeze-create-page',
  templateUrl: './summer-unit-freeze-create-page.component.html',
  styleUrls: ['./summer-unit-freeze-create-page.component.scss']
})
export class SummerUnitFreezeCreatePageComponent implements OnInit {
  destinations: SummerDestinationConfig[] = [];
  loadingDestinations = false;
  destinationsError = '';
  submitLoading = false;

  private readonly seasonYear = SUMMER_SEASON_YEAR;

  constructor(
    private readonly dynamicMetadataService: DynamicMetadataService,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly router: Router,
    private readonly msg: MsgsService
  ) {}

  ngOnInit(): void {
    this.loadDestinationCatalog();
  }

  onSubmit(payload: AdminUnitFreezeCreatePayload): void {
    if (this.submitLoading) {
      return;
    }

    this.submitLoading = true;
    this.summerWorkflowController
      .createAdminUnitFreeze(payload)
      .pipe(finalize(() => { this.submitLoading = false; }))
      .subscribe({
        next: response => {
          if (response?.isSuccess && response.data) {
            this.msg.msgSuccess('تم إنشاء التجميد بنجاح.');
            this.router.navigateByUrl('/Admin/resorts/unit-freeze');
            return;
          }

          this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
        },
        error: () => {
          this.msg.msgError('خطأ', '<h5>تعذر إنشاء التجميد حالياً.</h5>', true);
        }
      });
  }

  onCancel(): void {
    this.router.navigateByUrl('/Admin/resorts/unit-freeze');
  }

  private loadDestinationCatalog(): void {
    this.loadingDestinations = true;
    this.destinationsError = '';

    this.dynamicMetadataService
      .getMendJson<unknown>(SUMMER_DYNAMIC_APPLICATION_ID, SUMMER_DESTINATION_CATALOG_KEY)
      .pipe(finalize(() => { this.loadingDestinations = false; }))
      .subscribe({
        next: response => {
          if (response?.isSuccess) {
            this.destinations = parseSummerDestinationCatalog(response.data, this.seasonYear);
            if (this.destinations.length > 0) {
              return;
            }
          }

          this.destinations = [];
          const errors = Array.isArray(response?.errors) ? response.errors : [];
          this.destinationsError = errors.length > 0 ? errors.join(' | ') : 'تعذر تحميل إعدادات المصايف.';
        },
        error: () => {
          this.destinations = [];
          this.destinationsError = 'تعذر تحميل إعدادات المصايف.';
        }
      });
  }

  private collectErrors(
    response: SummerWorkflowCommonResponse<SummerUnitFreezeDto> | null | undefined
  ): string {
    const messages = (response?.errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0);

    return messages.length > 0 ? messages.join('<br/>') : 'تعذر إنشاء عملية التجميد.';
  }
}
