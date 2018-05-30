/* eslint-disable no-console */
const { Builder, Capabilities } = require("selenium-webdriver")
const { Options: ChromeOptions } = require("selenium-webdriver/chrome")
const { red, green, grey } = require("chalk")
const server = require("./slow-server")

const options = new ChromeOptions()
options.headless()
options.addArguments("--no-sandbox")

process.on('uncaughtException', err => {
    console.error(err)
    process.exit(1)
})

const driver = new Builder()
  .withCapabilities(Capabilities.chrome().setLoggingPrefs({ browser: "ALL" }))
  .setChromeOptions(options)
  .build()

const useColor = process.argv.find(arg => arg === "-C") == null

const portArg = process.argv[process.argv.length - 1]
const port = !isNaN(portArg) ? portArg : 9000

const runTests = async () => {
  console.log("Running tests...\n")
  await driver.get(`http://localhost:${port}/?test`)

  let hasFailure = false
  let results = null
  await driver.wait(async () => {
    results = await driver.executeScript("return window.getTestResults()")

    for (const test of results.tests) {
      if (test.passed) reportPassed(test)
      else {
        if (!hasFailure) hasFailure = true
        reportFailure(test)
      }
    }

    return results.finished
  }, 10000)

  await driver.quit()
  console.log("\n")

  if (hasFailure) process.exit(1)
  else process.exit(0)
}

server.listen(port, async () => {
  console.log(`Server is listening on port: ${port}`)

  try {
    await runTests()
  } catch (err) {

    console.error(err)
    process.exit(1)
  }
})

function reportPassed(test) {
  if (useColor) console.log(`\t${green("✓")} ${grey(test.name)}`)
  else console.log(`\t✓ ${test.name}`)
}

function reportFailure(test) {
  const stack = test.stack.replace(/\\n/g, "\n")
  if (useColor) console.log(`\t${red(`× ${test.name}\n${stack}`)}`)
  else console.log(`\t× ${test.name}\n${stack}`)
}

/* eslint-enable no-console */
