<!-- Shared styles moved to docs/styles.css for consistent Markdown preview -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>Plan to Replace MsgsService (SweetAlert2) with PrimeNG</h1>
  <div class="badge">Plan</div>
</div>

<div class="doc-body">
## Overview
The goal is to replace the current `MsgsService` implementation, which relies on `SweetAlert2` (`swal2`), with pure PrimeNG components (`Toast`, `ConfirmDialog`). This will ensure a consistent UI/UX across the application and reduce external dependencies.

## 1. Prerequisites & Setup

### A. Update `AppModule`
Ensure `ConfirmationService` and `MessageService` are provided globally.
*   **File**: `src/app/app.module.ts`
*   **Action**: Add `ConfirmationService` to the `providers` array. (`MessageService` is already present).

```typescript
import { ConfirmationService, MessageService } from 'primeng/api';

@NgModule({
  // ...
  providers: [
    // ...
    MessageService,
    ConfirmationService, 
    // ...
  ]
})
export class AppModule { }
```

### B. Add Global UI Components
PrimeNG requires component placeholders in the root template to display toasts and dialogs.
*   **File**: `src/app/app.component.html`
*   **Action**: Add `<p-toast>` and `<p-confirmDialog>` at the top or bottom of the file.

```html
<p-toast position="center"></p-toast> 
<!-- Or position="top-right" based on preference -->

<p-confirmDialog [style]="{width: '50vw'}" [baseZIndex]="10000" rejectButtonStyleClass="p-button-text"></p-confirmDialog>

<app-nav-bar ...></app-nav-bar>
<!-- ... rest of content -->
```

## 2. Refactoring `MsgsService`

We will modify `src/app/shared/services/helper/msgs.service.ts` to use PrimeNG services instead of SweetAlert2. We will maintain the method signatures (inputs/outputs) such as `msgConfirm` returning a `Promise<boolean>` to minimize changes in the 80+ files using this service.

### Best Practices Mapping

| Case | Current (SweetAlert2) | Proposed (PrimeNG) | Best Practice Notes |
| :--- | :--- | :--- | :--- |
| **Success** | `Swal.mixin({...}).fire()` | `MessageService.add({severity:'success', ...})` | Use transient Toast notifications (disappear auto). |
| **Error** | `Swal.fire({icon:'error'})` | `MessageService.add({severity:'error', ...})` | Use sticky Toasts or Dialogs for critical errors. Toasts are usually sufficient. |
| **Info** | `Swal.fire({icon:'info'})` | `MessageService.add({severity:'info', ...})` | Use informational Toasts for updates. |
| **Warning** | - | `MessageService.add({severity:'warn', ...})` | Use for non-blocking warnings. |
| **Confirm** | `Swal.fire({...}).then(...)` | `ConfirmationService.confirm({...})` | Use `ConfirmDialog` (Modal) for destructive actions. |

### Proposed Implementation Code

```typescript
import { Injectable } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class MsgsService {

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  /**
   * Displays an error message.
   * Best Practice: Use for validation errors or API failures.
   */
  msgError(title: string, msgBody: string, isHtml?: boolean) {
    this.messageService.add({
      severity: 'error',
      summary: title,
      detail: msgBody, // PrimeNG supports limited HTML in some versions/configurations, but plain text is safer.
      life: 5000 // Error messages stick around a bit longer
    });
  }

  /**
   * Displays a success message.
   * Best Practice: Use for successful save/update operations.
   */
  msgSuccess(msgBody: string, milliseconds: number = 2000, small?: boolean) {
    this.messageService.add({
      severity: 'success',
      summary: 'Success', // Or 'نجاح'
      detail: msgBody,
      life: milliseconds
    });
  }

  /**
   * Displays an info message.
   */
  msgInfo(msgBody: string, title: string = 'Information', _icon?: any) {
    this.messageService.add({
      severity: 'info',
      summary: title,
      detail: msgBody
    });
  }

  /**
   * Displays a confirmation dialog and returns a Promise.
   * This maintains backward compatibility with existing code awaiting this method.
   */
  msgConfirm(msgBody: string, confirmButtonTxt: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmationService.confirm({
        message: msgBody,
        header: 'تأكيد', // "Confirmation"
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: confirmButtonTxt,
        rejectLabel: 'إلغاء', // "Cancel"
        accept: () => {
          resolve(true);
        },
        reject: () => {
          resolve(false);
        }
      });
    });
  }
}
```

## 3. Execution Steps

1.  **Modify `app.module.ts`**: Add `ConfirmationService`.
2.  **Modify `app.component.html`**: Add `<p-toast>` and `<p-confirmDialog>`.
3.  **Modify `msgs.service.ts`**: Replace Swal code with PrimeNG implementation.
4.  **Test**: Verify login errors, save successes, and any delete actions (confirmations).

</div>
