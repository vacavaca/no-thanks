const express = require('express')
const app = express()

app.get('/test', (req, res) => {
    setTimeout(() => {
        res.send('test');
    }, 50)
})

app.use(express.static(__dirname))

if (process.argv.find(arg => arg === '--standalone') != null) {
    const portArg = process.argv[process.argv.length - 1]
    const port = !isNaN(portArg) ? portArg : 9000
    app.listen(port, () => {
        /* eslint-disable no-console */
        console.log(`Server is listening on port: ${port}`)
        /* eslint-enable no-console */
    })
}

module.exports = app

