<!-- Shared styles moved to docs/styles.css for consistent Markdown preview -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
   <h1>processRequestsAndPopulate — Explanation (English)</h1>
   <div class="badge">Guide</div>
</div>

<div class="section">
Purpose:
- Build a set of Observables from component config (<span class="code-inline">config.requestsarray</span>), execute them concurrently, process each response, populate selection arrays and finally call <span class="code-inline">populateForm()</span> to initialize the form.
</div>

<div class="doc-body">

When called:
- Invoked in `ngOnInit()` after metadata is loaded when `config.isNew`.

Step-by-step logic:
1. Build requests:
   - `requestBuilder.buildRequestsFromConfig(this.config.requestsarray, this)` returns `Observable<any>[]`.
2. If there are no requests, exit early.
3. Execute requests concurrently:
   - Call `getData(requests)` that returns `forkJoin(requests)` as a single Observable producing an array of responses in the requests' order.
4. Subscribe and process responses:
   - Iterate `responses` with index `idx` to map each response to `this.config.requestsarray[idx]`.
   - For each `resp`:
   - If `resp.isSuccess` and `resp.data` exists:
    - Normalize `resp.data` to an array and assign to `reqConfig.arrValue` (runtime array). Legacy `reqConfig.arr` is kept in sync for compatibility.
       - If `reqConfig.populateMethod` exists: retrieve an invoker via `requestBuilder.getPopulateInvoker(reqConfig, this)` and call it (`invoker(resp.data, reqConfig.populateArgs)`) in a `try/catch`.
       - For each field in `reqConfig.requestsSelectionFields`: call `genericFormService.mapArrayToSelectionArray(fieldName, resp.data)` and push the result into `genericFormService.selectionArrays`.
     - If `resp.isSuccess` is false: collect `resp.errors` and show via `msg.msgError(...)`.
   - After all responses are processed: call `populateForm()`.
   - On general error of the combined Observable show an error via `msg.msgError`.

Dependencies and roles:
- `BuildRequestsFromConfigService.buildRequestsFromConfig`: converts config to Observables (API calls).
- `getData(requests)`: local helper using `forkJoin` to aggregate responses.
- `requestBuilder.getPopulateInvoker`: returns a custom invoker for `populateMethod` if defined.
- `genericFormService.mapArrayToSelectionArray`: maps API arrays into selection options for form controls.
- `genericFormService.selectionArrays`: central store for selection arrays.
   - `populateForm()`: fills `ticketForm` using `messageDto`, `reqConfig.arrValue` (prefer) or legacy `reqConfig.arr`, and `selectionArrays`.
- `msg.msgError(...)`: UI error reporting.
- `forkJoin` (RxJS): run multiple Observables in parallel and collect results.

Design notes:
- Response ordering is preserved by mapping using `idx` to `config.requestsarray[idx]`.
   - `resp.data` is normalized to an array before storing into `reqConfig.arrValue` (and `reqConfig.arr` for compatibility).
- Invoker calls are wrapped in `try/catch` to avoid breaking the whole flow.
- Each failed response surface its errors to the user individually.
- `populateForm()` is called only after processing all responses.

Suggested improvements:
- Document the structure of `config.requestsarray` (fields like `populateMethod`, `requestsSelectionFields`, `populateArgs`, `arr`).
- Add more detailed logging when `invoker` fails (include `reqConfig` and `idx`).
- Show `spinner` while `forkJoin` is executing if requests may take long.
- Support `retry`/`timeout` behavior per-request via `buildRequestsFromConfig`.

Config input examples and body-wrapping best practice:

- Simple ExpressionDto array (recommended):

```json
{
   "method": "publicationsController.getDocumentsList_user",
   "args": [1, 5, [{ "PropertyName": "MENUITEMID", "PropertyIntValue": 139 }]]
}
```

- Simple key/value shorthand (supported when `wrapBodyAsArray` is true):

```json
{
   "method": "publicationsController.getDocumentsList_user",
   "wrapBodyAsArray": true,
   "args": [1, 5, { "MENUITEMID": 139 }]
}
```

Notes:
- Prefer the explicit ExpressionDto array shape for clarity and type-safety.
- Use `wrapBodyAsArray` when you want a concise key/value map in the config; the builder will convert it to `ExpressionDto[]`.
- The builder will still heuristically normalize for `GetDocumentsList*` methods when `wrapBodyAsArray` is not provided, but explicit flag is best practice.

References:
- Source function in repository: [src/app/Modules/top-maganement/components/add-edit-subject/add-edit-subject.component.ts](src/app/Modules/top-maganement/components/add-edit-subject/add-edit-subject.component.ts #L67-L113)

</div>
