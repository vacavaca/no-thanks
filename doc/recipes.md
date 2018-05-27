# Recipes

## Network Request

Make a cancellable network request

Using `fetch` and `AbortController`

```js
const { cancellable } = require('no-thanks')

const controller = new AbortController()

const request = cancellable(fetch({
    signal: controller.signal,
    /* other request options */
}), controller.abort)
```

or without closure

```js
const { cancellable } = require('no-thanks')

const request = cancellable(async grain => {
    const controller = grain(new AbortController())
    return await fetch({
        signal: controller.signal,
        /* other request options */
    })
}, controller => controller != null && controller.abort())

```

### General Purpose Request Function

It's the same request but it takes options as an argument

```js
const { cancellable } = require('no-thanks')

const request = cancellable(async (grain, url, options = {}) => {
    const controller = grain(new AbortController())
    return await fetch(url, {
        ...options
        signal: controller.signal,
    })
}, controller => controller != null && controller.abort())

const getCurrentBitcoinPrice = () => request('https://api.bitfinex.com/v1/pubticker/btcusd')
    .then(response => response.json())
    .then(({ last_price }) => last_price)

```

---

A few more examples of cancellable requests using **jQuery.ajax** with jquery >= 1.5.1

```js
const { cancellable } = require('no-thanks')

const request = cancellable($.ajax({
    /* request options */
}), request => request != null && request.abort())
```

Using **jQuery.ajax** with jquery <= 1.5

```js
const { cancellable } = require('no-thanks')

const request = cancellable(async grain => {
    return await new Promise((resolve, reject) => grain($.ajax({
        /* request options */
        success: resolve,
        error: (jqXhr, status, errorMessage) => reject(new Error(errorMessage))
    })))
}, request => request != null && request.abort())
```

## Reading Large File

For example let's sum the bytes in a file using **nodejs**

```js
const fs = require('fs')
const { promisify } = require('util')
const { cancellable } = require('no-thanks')

const open = promisify(fs.open)
const stat = promisify(fs.stat)
const read = promisify(fs.read)

const sum = cancellable(async (grain, filename) => {
    const { blksize } = await grain(stat(filename))
    const handle = await grain(open(filename))

    let sum = 0
    let read = null
    while (read == null || read > 0) {
        const buffer = Buffer.alloc(blksize)
        read = await grain(read(handle, buffer, 0, blksize, 0))
        if (read > 0)
            sum += buffer.reduce((a, b) => a + b, 0)
    }

    return sum
}, (_, handle) => handle != null && handle.close())

sum('dir/some-file.dat')
    .then(sum => console.log(`Sum: ${sum}))
```
