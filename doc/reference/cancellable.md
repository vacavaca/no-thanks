# cancellable

Create cancellable task

*(task, finalizer, fineGrained)* ⇒ [CancellablePromise](#cancellablepromise)

**Returns**: [CancellablePromise](#cancellablepromise) - cancellable promise  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| task | <code>Promise</code> \| <code>AsyncFunction</code> \| <code>function</code> |  | task to make cancellable |
| finalizer | <code>function</code> |  | finalizer to call after cancel |
| fineGrained | <code>boolean</code> | <code>true</code> | supply "grain" function to the  given task, if task has type of Function |
