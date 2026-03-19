<!-- Shared styles moved to docs/styles.css; wrappers added to apply shared doc styling -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>توثيق + مقتطفات الشيفرة — processRequestsAndPopulate</h1>
  <div class="badge">مقتطفات</div>
</div>

<div class="doc-body">

هذا الملف يحتوي الشرح العربي المختصر ومقتطف الشيفرة مع رابط للأسطر في الملف المصدر.

**ملف المصدر (رابط الأسطر)**: [src/app/Modules/top-maganement/components/add-edit-subject/add-edit-subject.component.ts](src/app/Modules/top-maganement/components/add-edit-subject/add-edit-subject.component.ts#L67-L113)

**مقتطف الدالة `processRequestsAndPopulate` (الأسطر المشار إليها أعلاه):**

```typescript
  private processRequestsAndPopulate() {
    const requests: Observable<any>[] = this.requestBuilder.buildRequestsFromConfig(this.config.requestsarray, this);
    if (requests.length > 0) {
      const obs = this.getData<any>(requests);
      if (obs) {
        (obs as Observable<any[]>).subscribe({
          next: (responses) => {
            if (responses.length > 0) {
              responses.forEach((resp, idx) => {
                responses[idx] = resp;
                if (resp.isSuccess) {
                  if (Array.isArray(resp.data) || resp.data !== undefined) {
                    const reqConfig = this.config.requestsarray[idx];
                    // store runtime reference in `arrValue` (preferred). Keep legacy `arr` in sync for compatibility.
                    reqConfig.arrValue = Array.isArray(resp.data) ? resp.data : (resp.data !== undefined ? [resp.data] : []);
                    try { reqConfig.arr = reqConfig.arrValue; } catch {}
                    if (reqConfig.populateMethod) {
                      const invoker = this.requestBuilder.getPopulateInvoker(reqConfig, this);
                      if (invoker) {
                        try {
                          invoker(resp.data, reqConfig.populateArgs);
                        } catch (e) {
                          console.warn('populate invoker failed', e);
                        }
                      }
                    }
                    // this.populateUnitTree(resp.data);
                    reqConfig.requestsSelectionFields?.forEach(fieldName => {
                      const selections_arr = this.genericFormService.mapArrayToSelectionArray(fieldName, resp.data);
                      this.genericFormService.selectionArrays.push(selections_arr);
                    });
                  }
                } else {
                  let errr = '';
                  resp.errors?.forEach((e: any) => errr += e.message + "<br>");
                  this.msg.msgError(errr, "هناك خطا ما", true);
                }
              });
              this.populateForm();
            }
          },
          error: (error) => {
            this.msg.msgError('Error', '<h5>' + error + '</h5>', true);
          }
        });
      }
    }
  }
```

شرح مختصر :
- تبني الدالة مصفوفة من الطلبات عبر `requestBuilder.buildRequestsFromConfig` ثم تنفذها مجتمعة عبر `forkJoin` (عن طريق `getData`).
- لكل استجابة ناجحة: تحفظ البيانات في `reqConfig.arr`، وتنفّذ أي `populateMethod` مخصصة، وتحوّل حقول الاختيار إلى `selectionArrays` عبر `genericFormService`.
- تعرض الأخطاء لكل استجابة فاشلة وتستدعي `populateForm()` بعد الانتهاء من معالجة كل النتائج.

---

هل تريد أن أدرج أيضاً مقتطفات `populateForm` و`getData` وروابط للأسطر الخاصة بهما؟

تمت الإضافة: مقتطفات `populateForm` و `getData` مع روابط للأسطر أدناه.

**مقتطف `populateForm` (الأسطر):**

Source: [src/app/Modules/top-maganement/components/add-edit-subject/add-edit-subject.component.ts](src/app/Modules/top-maganement/components/add-edit-subject/add-edit-subject.component.ts#L236-L335)

```typescript
  populateForm() {
    const _key = this.config.tkCategoryCds.find(cd => cd.value === this.messageDto.categoryCd)?.key;

    // If editing and messageDto contains field metadata, build filtered list from messageDto.fields
    if (!this.config?.isNew && this.messageDto?.fields && this.messageDto.fields.length > 0) {
      // Organize fields by groups and initialize form
      this.genericFormService.organizeMessageFieldsByGroups(this.messageDto.fields as TkmendField[]);
      this.initForm();
      this.ticketForm.get('tkCategoryCd')?.patchValue(_key);
      // ... (تفصيل تعبئة الحقول والنسخ المتكررة) ...
      this.ticketForm.get('subject')?.patchValue(this.messageDto.subject);
      this.ticketForm.get('messageID')?.patchValue(this.messageDto.messageId);
      this.ticketForm.get('createdBy')?.patchValue(this.messageDto.createdBy);
    } else {
      // Default behavior: use metadata from service
      this.filtered_CategoryMand = this.genericFormService.cdCategoryMandDto.filter(f =>
        f.mendCategory.toString() == _key?.toString())
    }
  }
```

**مقتطف `getData` (الأسطر):**

Source: [src/app/Modules/top-maganement/components/add-edit-subject/add-edit-subject.component.ts](src/app/Modules/top-maganement/components/add-edit-subject/add-edit-subject.component.ts#L356-L365)

```typescript
  getData<T>(requests?: Observable<any>[], processor?: (resp: any, idx?: number) => T): Observable<T[]> | void {
    // If caller provided requests -> return forkJoin of them mapped through optional processor
    if (Array.isArray(requests) && requests.length > 0) {
      return forkJoin(requests).pipe(
        map((responses: any[]) => responses.map((r, i) => processor ? processor(r, i) : (r as unknown as T)))
      );
    }
  }
```
