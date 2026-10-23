# App updates via OTA

When you release a new version of your app... how is it distributed?

## Prerequisites

- The [stage link](https://docs.pears.com/p2p/getting-started/build-a-peer-to-peer-chat/ship/#touch-set-the-upgrade-link-and-seed) of your app when you did `pear touch` shipping your app: `pear://<stage-link>`  shipped your app. This is also called `<target-link>`
  - 

## Code changes

Do your changes in the code. Then Run the app locally and test the changes:
```sh
npm start
```

Update the version in `package.json` and `package-lock.json `
```json
{
  "name": "your-app",
  "productName": "Your App",
  "version": "1.0.3",
  "upgrade": "pear://zjzce1h7...
  ...
```

And finally, commit your changes

## Build

Build the app and the installer
```sh
# Compile the app
npm run make
# Generate the installer outside the repo folder
cd ..
pear build --package=.\your-app\package.json --win32-x64-app .\your-app\out\YourApp-win32-x64\YourApp.msix --target your-app-1.0.3
```

This creates exactly 2 files:
- `package.json` with current version
- `YourApp.msix` the app installer 

## Release

### Save the isntaller in Hypercode

Save the installer and package files INTO the `Hyperdrive`, so they can be shared in the P2P network

```sh
pear stage --dry-run pear://<stage-link> your-app-1.0.3
# If shows only the 2 files it's OK
# + /package.json (+2.8kB)
# + /by-arch/win32-x64/app/YourApp.msix (+171.4MB)
pear stage pear://<stage-link> your-app-1.0.3
```

The command will generate a [verlink](https://docs.pears.com/pear/reference/pear/cli/#pear-stage-link-dir) with the format: `pear://<fork>.<length>.<key>`

Something like:
```
* Staging pear-place

[  pear://hchzzy6ggkgcx3x7o...  ]
pear://0.5.hchzzy6ggkgcx3x7o...
```

### Provision the new version to all the peers

This triggers the new [production release](https://docs.pears.com/pear/reference/pear/cli/#production-releases) to the peers

```sh
pear provision <source-verlink> <target-link> <production-verlink>
```

`<target-link>` = `<stage-link>` from `pear touch`

For example:
```
pear provision pear://0.5.aaa123 pear://bbb456 pear://0.3.aaa123
```

## Seed the new version

Now we need to seed the new version so peers can update their app

```sh
pear seed <stage-link>
```