import * as path from 'path'
import {
  dummyUiBuildProjectDirname,
  webpackConfigFilename,
  wpStub,
  linkWebpack,
  unlinkWebpack
} from './util/common'
const tape = require('tape')
const sinon = require('sinon')
const ripcord = require('../')
const licenses = require('../src/licenses')
const uiBuild = require('../src/ui-build')
const fs = require('fs')
const counsel = require('counsel')

tape('license check', t => {
  const origHandleGetLicensesCheck = licenses._checkLicenses
  const stub = sinon.stub(licenses, '_checkLicenses', (pkgs, opts, rc) => {
    pkgs = { 'dummy-pkg': { name: 'dummy-pkg', version: '0.0.1', from: ['blah', 'blah'] } }
    return origHandleGetLicensesCheck.apply(licenses, [pkgs, opts, ripcord])
  })
  t.plan(2)
  Promise.resolve()
  .then(() => ripcord.licenses('check', { force: true, throwOnFail: true, uiBuild: false }))
  .then(t.fail)
  .catch(err => {
    t.ok(err.message.match(/unapproved/), 'biffs on unapproved licenses')
  })
  .then(() => stub.restore())
  .then(() => t.pass('license check teardown'))
  .then(t.end, t.end)
})

tape('license dump', t => {
  t.plan(1)
  const destDir = fs.mkdtempSync('/tmp' + path.sep)
  const destFilename = path.join(destDir, 'test-dump.csv')
  Promise.resolve()
  .then(() => ripcord.licenses(
    'dump',
    { csv: true, dev: true, throwOnFail: true, output: destFilename, uiBuild: false }
  ))
  .then(() => t.ok(fs.existsSync(destFilename, 'dump generated')))
  .then(t.end, t.end)
})

tape('license check, web-build', t => {
  const opts = {
    dev: true,
    force: true,
    throwOnFail: true,
    targetProjectRoot: dummyUiBuildProjectDirname,
    webpackConfig: webpackConfigFilename
  }
  t.plan(2)
  const wStub = uiBuild.applyWebBuildTransform
  const transformStub = sinon.stub(uiBuild, 'applyWebBuildTransform', (pkgs, opts) => {
    pkgs.webpack = wpStub
    return wStub.call(uiBuild, pkgs, opts)
  })
  Promise.resolve()
  .then(() => ripcord.licenses('check', opts))
  .then(t.fail)
  .catch(err => t.ok(err.message.match(/unapproved/), 'biffs on unapproved licenses'))
  .then(() => {
    transformStub.restore()
    t.pass('license check teardown')
  })
  .then(t.end, t.end)
})

tape('license dump, web-build', t => {
  const opts = {
    csv: true,
    dev: true,
    force: true,
    _ignoreNonLogicalDependenices: true, // hack around snyk-resolve-deps not finding symlinked webpack child deps
    throwOnFail: true,
    targetProjectRoot: dummyUiBuildProjectDirname,
    webpackConfig: webpackConfigFilename
  }
  t.plan(2)
  const wStub = uiBuild.applyWebBuildTransform
  const stub = sinon.stub(uiBuild, 'applyWebBuildTransform', (pkgs, opts) => {
    pkgs.webpack = wpStub
    return wStub.call(uiBuild, pkgs, opts)
  })
  const oldTargetProjectRoot = counsel.targetProjectRoot
  counsel.targetProjectRoot = dummyUiBuildProjectDirname
  const goldenFilename = path.join(dummyUiBuildProjectDirname, 'ui-license-dump-golden.csv')
  const goldenDump = fs.readFileSync(goldenFilename).toString().trim()

  unlinkWebpack()
  linkWebpack()
  return Promise.resolve()
  .then(() => ripcord.licenses('dump', opts))
  .then(dump => {
    t.equals(dump.trim(), goldenDump, 'ui build dump matches golden dump')
  })
  .then(() => {
    counsel.targetProjectRoot = oldTargetProjectRoot
    stub.restore()
    unlinkWebpack()
    t.pass('teardown!')
  })
  .then(t.end, t.end)
})

