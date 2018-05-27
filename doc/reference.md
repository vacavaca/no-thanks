# API Reference

## CancellablePromise

Cancellable promise - Promise that can be canceled

### Constructor

> **constructor** (**resolver**: Function|Promise, **finalizer**: ?Function = *null*) => [CancellablePromise](#cancellablepromise)

| Param | Type | Description | Default |
| --- | --- | --- | --- |
| resolver | Function&#124;Promise | promise resolver ||
| finalizer | ?Function | finalizer | `null` |

### Methods

#### then

> **then** (**onFulfull**: Function, **onReject**: ?Function) => [CancellablePromise](#cancellablepromise)

refer to the [Promise.prototype.then specification](https://www.ecma-international.org/ecma-262/6.0/#sec-promise.prototype.then)

---

#### catch

> **catch** (**onReject**: ?Function) => [CancellablePromise](#cancellablepromise)

refer to the [Promise.prototype.catch specification](https://www.ecma-international.org/ecma-262/6.0/#sec-promise.prototype.catch)


---

#### cancel

> **cancel** () => Promise

Cancel this promise, the promise will not be interrupted by this call but the result (or error) of it will be muted

**Returns** Promise 

cancellation result

---

## cancellable

> **cancellable** (**task**: Promise|AsyncFunction, **finalizer**: ?Function = null, **fineGrained**: boolean = true) => [CancellablePromise](#cancellablepromise)

Create cancellable task

| Param | Type | Description | Default |
| --- | --- | --- | --- |
| task | Promise&#124;AsyncFunction | task to make cancellable ||
| finalizer | ?Function | finalizer to call after cancel | `null` |
| fineGained | boolean | supply "grain" function to the given task, if the task has a type of AsyncFunction | `true` |

**Returns** [CancellablePromise](#cancellablepromise)

cancellable promise

---

## coroutine

> **coroutine** (**generator**: Generator Function, **finalizer**: ?Function = null, **fineGrained**: boolean = true) => [CancellablePromise](#cancellablepromise)

Create cancellable promise from generator that yields other promises

| Param | Type | Description | Default |
| --- | --- | --- | --- |
| generator | Generator Function | generator to make cancellable ||
| finalizer | ?Function | finalizer to call after cancel | `null` |
| fineGained | boolean | stop iteration on cancel or not | `true` |

**Returns** [CancellablePromise](#cancellablepromise)

cancellable promise
