import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { environment } from 'src/environments/environment';
import { NswagEditorService, NswagEntry } from '../../services/nswag-editor.service';

@Component({
  selector: 'app-nswag-editor',
  templateUrl: './nswag-editor.component.html',
  styleUrls: ['./nswag-editor.component.scss']
})
export class NswagEditorComponent implements OnInit {
  form: FormGroup;
  loading = false;
  saving = false;
  envProperties: Array<{ label: string; value: any }> = [];

  constructor(private fb: FormBuilder, private svc: NswagEditorService) {
    this.form = this.fb.group({ items: this.fb.array([]) });
  }

  ngOnInit(): void {
    this.load();
    this.envProperties = this.getEnvironmentProperties();
  }

  get items() {
    return this.form.get('items') as FormArray;
  }

  private addItem(data?: NswagEntry) {
    const g = this.fb.group({
      label: [data?.label || '', Validators.required],
      envProperty: [data?.envProperty || ''],
      url: [data?.url || ''],
      urlProduction: [data?.urlProduction || ''],
      isproduction: [!!data?.isproduction],
      regenerate: [data && data.regenerate !== undefined ? !!data.regenerate : true],
      output: [data?.output || '']
    });
    this.items.push(g);
  }

  load() {
    this.loading = true;
    this.svc.getConfigs().subscribe({
      next: (res) => {
        this.items.clear();
        (res || []).forEach(r => this.addItem(r));
        if ((res || []).length === 0) this.addItem();
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  addNew() { this.addItem(); }

  remove(i: number) { this.items.removeAt(i); }

  save() {
    if (this.form.invalid) return; // simple guard
    this.saving = true;
    const configs: NswagEntry[] = this.items.value;
    this.svc.saveConfigs(configs).subscribe({
      next: () => { this.saving = false; this.load(); },
      error: () => (this.saving = false)
    });
  }

  // returns all exported properties from environment as [{label, value}]
  getEnvironmentProperties(): Array<{ label: string; value: any }> {
    return Object.keys(environment).map(k => ({ label: k, value: k }));
  }
}
