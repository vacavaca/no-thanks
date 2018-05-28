# API Reference

## CancellablePromise

Cancellable promise - Promise that can be canceled

### Constructor

> **constructor** (**resolver**: Function|Promise, **finalizer**: ?Function = *null*) => [CancellablePromise](#cancellablepromise)

| Param | Type | Description | Default |
| --- | --- | --- | --- |
| resolver | Function&#124;Promise&#124;Object | promise resolver or promise-like value ||
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

> **cancellable** (**task**: Promise|AsyncFunction|Object, **finalizer**: ?Function = null, **fineGrained**: boolean = true) => [CancellablePromise](#cancellablepromise)

Create cancellable task

| Param | Type | Description | Default |
| --- | --- | --- | --- |
| task | Promise&#124;AsyncFunction&#124;Object | task to make cancellable ||
| finalizer | ?Function | finalizer to call after cancel | `null` |
| fineGained | boolean | supply "grain" function to the given task, if the task has a type of AsyncFunction | `true` |

**Returns** [CancellablePromise](#cancellablepromise)

cancellable promise

---

## interruptible

> **interruptible** (**task**: Promise|AsyncFunction|Object, **finalizer**: ?Function = null, **fineGrained**: boolean = true) => [CancellablePromise](#cancellablepromise)

Create interruptible task

| Param | Type | Description | Default |
| --- | --- | --- | --- |
| task | Promise&#124;AsyncFunction&#124;Object | task to make interruptible ||
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

---

## compose

> **compose** (**promise**: Promise|Object) => `Promise`

Wraps a promise into another to safely return it from async functions, then methods and resolvers. Stops javascript from performing automatic chaining

| Param | Type | Description | Default |
| --- | --- | --- | --- |
| promise | Promise&#124;Object | any value to wrap ||

**Returns** `Promise`

wrapped promise

---

## decompose

> **decompose** (**promise**: Object) => `Promise`

Handler to unwrap a value previously wrapped with compose

| Param | Type | Description | Default |
| --- | --- | --- | --- |
| promise | Promise&#124;Object | wrapped value ||

**Returns** `Promise`

unwrapped promise