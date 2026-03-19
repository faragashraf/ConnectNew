import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize, Subject, takeUntil } from 'rxjs';
import { DomainCryptoController } from '../../services/DomainCrypto.service';

@Component({
  selector: 'app-encrypt-decrypt',
  templateUrl: './encrypt-decrypt.component.html',
  styleUrls: ['./encrypt-decrypt.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EncryptDecryptComponent implements OnInit, OnDestroy {
  encryptForm!: FormGroup;
  decryptForm!: FormGroup;

  encrypting = false;
  decrypting = false;
  
  encryptResult = '';
  decryptResult = '';

  encryptError = '';
  decryptError = '';

  showEncrypted = false;
  showDecrypted = false;

  clearAfterSeconds = 60;
  private destroy$ = new Subject<void>();
  private encryptClearTimer: number | null = null;
  private decryptClearTimer: number | null = null;

  constructor(
    private fb: FormBuilder,
    private cryptoService: DomainCryptoController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.encryptForm = this.fb.group({
      valueToEncrypt: ['', [Validators.required, Validators.minLength(3)]]
    });

    this.decryptForm = this.fb.group({
      userId: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  ngOnDestroy(): void {
    this.clearEncrypt(true);
    this.clearDecrypt(true);
    this.destroy$.next();
    this.destroy$.complete();
  }

  encrypt(): void {
    if (this.encrypting) return;
    this.encryptError = '';
    this.encryptResult = '';
    this.showEncrypted = false;

    if (this.encryptForm.invalid) {
      this.encryptForm.markAllAsTouched();
      return;
    }

    const value = String(this.encryptForm.get('valueToEncrypt')?.value || '').trim();
    if (!value) {
      this.encryptForm.get('valueToEncrypt')?.setErrors({ required: true });
      return;
    }

    this.encrypting = true;
    this.cryptoService.encrypt(value)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.encrypting = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (resp: string) => {
          this.encryptResult = resp ?? '';
          this.scheduleEncryptClear();
          this.cdr.markForCheck();
        },
        error: () => {
          this.encryptError = 'Encrypt request failed. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  decrypt(): void {
    if (this.decrypting) return;
    this.decryptError = '';
    this.decryptResult = '';
    this.showDecrypted = false;

    if (this.decryptForm.invalid) {
      this.decryptForm.markAllAsTouched();
      return;
    }

    const userId = String(this.decryptForm.get('userId')?.value || '').trim();
    if (!userId) {
      this.decryptForm.get('userId')?.setErrors({ required: true });
      return;
    }

    this.decrypting = true;
    this.cryptoService.decryptUserPassword(userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
           this.decrypting = false;
           this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (resp: string) => {
          this.decryptResult = resp ?? '';
          this.scheduleDecryptClear();
          this.cdr.markForCheck();
        },
        error: () => {
          this.decryptError = 'Decrypt request failed. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  clearEncrypt(skipFormReset = false): void {
    if (this.encryptClearTimer) {
      clearTimeout(this.encryptClearTimer);
      this.encryptClearTimer = null;
    }
    this.encryptResult = '';
    this.encryptError = '';
    this.showEncrypted = false;
    if (!skipFormReset) {
      this.encryptForm.reset();
    }
    this.cdr?.markForCheck();
  }

  clearDecrypt(skipFormReset = false): void {
    if (this.decryptClearTimer) {
      clearTimeout(this.decryptClearTimer);
      this.decryptClearTimer = null;
    }
    this.decryptResult = '';
    this.decryptError = '';
    this.showDecrypted = false;
    if (!skipFormReset) {
      this.decryptForm.reset();
    }
    this.cdr?.markForCheck();
  }

  toggleEncrypted(): void {
    this.showEncrypted = !this.showEncrypted;
    this.cdr?.markForCheck();
  }

  toggleDecrypted(): void {
    this.showDecrypted = !this.showDecrypted;
    this.cdr?.markForCheck();
  }

  private scheduleEncryptClear(): void {
    if (this.encryptClearTimer) {
      clearTimeout(this.encryptClearTimer);
    }
    this.encryptClearTimer = window.setTimeout(() => this.clearEncrypt(true), this.clearAfterSeconds * 1000);
  }

  private scheduleDecryptClear(): void {
    if (this.decryptClearTimer) {
      clearTimeout(this.decryptClearTimer);
    }
    this.decryptClearTimer = window.setTimeout(() => this.clearDecrypt(true), this.clearAfterSeconds * 1000);
  }

}
