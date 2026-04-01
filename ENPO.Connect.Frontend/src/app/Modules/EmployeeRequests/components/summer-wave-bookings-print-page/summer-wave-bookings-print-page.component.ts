import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import {
  SummerWaveBookingsPrintRowDto,
  SummerWaveBookingsPrintReportDto,
  SummerWaveBookingsPrintSectionDto,
  SummerWorkflowCommonResponse
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';
import { SUMMER_SEASON_YEAR } from '../summer-requests-workspace/summer-requests-workspace.config';
import { SUMMER_FEATURE_ROUTES } from '../summer-shared/core/summer-feature.config';

@Component({
  selector: 'app-summer-wave-bookings-print-page',
  templateUrl: './summer-wave-bookings-print-page.component.html',
  styleUrls: ['./summer-wave-bookings-print-page.component.scss']
})
export class SummerWaveBookingsPrintPageComponent implements OnInit {
  readonly seasonYear = SUMMER_SEASON_YEAR;

  loading = false;
  loadError = '';
  report: SummerWaveBookingsPrintReportDto | null = null;

  selectedCategoryId = 0;
  selectedWaveCode = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly authObjectsService: AuthObjectsService
  ) {}

  ngOnInit(): void {
    const categoryIdFromRoute = Number(this.route.snapshot.queryParamMap.get('categoryId') ?? 0) || 0;
    const waveCodeFromRoute = String(this.route.snapshot.queryParamMap.get('waveCode') ?? '').trim();

    this.selectedCategoryId = categoryIdFromRoute;
    this.selectedWaveCode = waveCodeFromRoute;

    if (this.selectedCategoryId <= 0 || this.selectedWaveCode.length === 0) {
      this.loadError = 'يرجى اختيار المصيف والفوج من شاشة الفلاتر الذكية أولاً.';
      return;
    }

    this.loadReport();
  }

  get sections(): SummerWaveBookingsPrintSectionDto[] {
    return this.report?.sections ?? [];
  }

  get hasRows(): boolean {
    return (this.report?.totalBookings ?? 0) > 0;
  }

  get showRequestRefColumn(): boolean {
    return this.hasAnyTextRowValue(row => row.requestRef);
  }

  get showUnitNumberColumn(): boolean {
    return this.hasAnyTextRowValue(row => row.unitNumber);
  }

  get showPersonsCountColumn(): boolean {
    return this.hasAnyNumericRowValue(row => row.personsCount);
  }

  get showStatusColumn(): boolean {
    return this.hasAnyTextRowValue(row => row.statusLabel);
  }

  get showNotesColumn(): boolean {
    return this.hasAnyTextRowValue(row => row.notes);
  }

  get printUserName(): string {
    const profile = (this.authObjectsService.getUserProfile() ?? {}) as Record<string, unknown>;
    const candidates = [
      profile['ArabicName'],
      profile['userDisplayName'],
      profile['displayName'],
      localStorage.getItem('firstName'),
      this.report?.generatedByUserId,
      localStorage.getItem('UserId')
    ];

    for (const candidate of candidates) {
      const text = String(candidate ?? '').trim();
      if (text.length > 0) {
        return text;
      }
    }

    return '-';
  }

  printNow(): void {
    window.print();
  }

  closePreview(): void {
    if (window.opener) {
      window.close();
      return;
    }

    this.router.navigate(['/EmployeeRequests', SUMMER_FEATURE_ROUTES.adminConsole]);
  }

  formatDate(value?: string | null): string {
    const parsed = this.parseDate(value);
    if (!parsed) {
      return '-';
    }

    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(parsed);
  }

  formatDateTime(value?: string | null): string {
    const parsed = this.parseDate(value);
    if (!parsed) {
      return '-';
    }

    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(parsed);
  }

  resolveDisplayText(value: string | null | undefined): string {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : '-';
  }

  trackBySection(_index: number, section: SummerWaveBookingsPrintSectionDto): string {
    const familyCount = section?.familyCount ?? 0;
    const label = String(section?.sectionLabel ?? '').trim();
    return `${familyCount}|${label}`;
  }

  trackByRow(index: number, row: SummerWaveBookingsPrintRowDto): string {
    const messageId = Number(row?.messageId ?? 0);
    return messageId > 0 ? String(messageId) : `row-${index}`;
  }

  private loadReport(): void {
    this.loading = true;
    this.loadError = '';
    this.report = null;

    this.summerWorkflowController
      .getWaveBookingsPrintReport(this.selectedCategoryId, this.selectedWaveCode, this.seasonYear)
      .subscribe({
        next: response => {
          if (response?.isSuccess && response.data) {
            this.report = response.data;
            return;
          }

          this.report = null;
          this.loadError = this.collectErrors(response, 'تعذر تحميل كشف الحاجزين.');
        },
        error: () => {
          this.report = null;
          this.loadError = 'تعذر تحميل كشف الحاجزين حالياً.';
        },
        complete: () => {
          this.loading = false;
        }
      });
  }

  private hasAnyTextRowValue(selector: (row: SummerWaveBookingsPrintRowDto) => string | null | undefined): boolean {
    return this.sections.some(section => section.rows.some(row => {
      const text = String(selector(row) ?? '').trim();
      return text.length > 0 && text !== '-';
    }));
  }

  private hasAnyNumericRowValue(selector: (row: SummerWaveBookingsPrintRowDto) => number | null | undefined): boolean {
    return this.sections.some(section => section.rows.some(row => {
      const value = Number(selector(row) ?? 0);
      return Number.isFinite(value) && value > 0;
    }));
  }

  private parseDate(value?: string | null): Date | null {
    const text = String(value ?? '').trim();
    if (text.length === 0) {
      return null;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private collectErrors(
    response: SummerWorkflowCommonResponse<unknown> | null | undefined,
    fallback: string
  ): string {
    const errors = (response?.errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0);

    return errors.length > 0 ? errors.join(' - ') : fallback;
  }
}
