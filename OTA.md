# App updates via OTA

When you release a new version of your app... how is it distributed?

## Prerequisites

The two links minted with `pear touch` on the first release (one-time, reused every release):

- **Stage link** `pear://<stage-key>`: For building the app.
  - It's the Hypercore where you store the app
  - You get it in `pear stage` 
  - It's the hypercode where you push builds. 
  - Private to you.
  - Used for releases: `pear stage pear://<stage-link> <dir>` 
- **Provision link** `pear://<provision-key>`: For releasing the app
  - It's the public link of the app.
  - This is `<target-link>` in `pear provision`, and it's stored in `package.json` → `upgrade`.
  - Used for:
    - `package.json#upgrade` to identify the app
    - In those commands:
      - `pear provision`
      - pear seed pear://<provision-link> (keeps updates downloadable)
      - pear install pear://<provision-link> / pear://0.3.zjzce1h… (fresh installs)
      - pear changelog pear://<provision-link>

## 1. Code changes

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

## 2. Build

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

## 3. Save the installer in Hypercode

Save the installer and package files INTO the `Hyperdrive`, so they can be shared in the P2P network

```sh
pear stage --dry-run pear://<stage-link> your-app-1.0.3
# If shows only the 2 files it's OK
# + /package.json (+2.8kB)
# + /by-arch/win32-x64/app/YourApp.msix (+171.4MB)
pear stage pear://<stage-link> your-app-1.0.3
```

The command will generate a [verlink](https://docs.pears.com/pear/reference/pear/cli/#pear-stage-link-dir) with the format: `pear://<fork>.<length>.<stage-link>`

Something like:
```
* Staging pear-place

[  pear://hchzzy6ggkgcx3x7o...  ]
pear://0.5.hchzzy6ggkgcx3x7o...
```
## 4. Provision the new version to all the peers

This triggers the new [production release](https://docs.pears.com/pear/reference/pear/cli/#production-releases) to the peers.

```sh
pear provision <source-verlink> <target-link> <production-verlink>
```

Remember:
- `<source-verlink>`: New released `verlink` in step 3, remember `<fork>.<length>.<stage-link>`
- `<target-link>`: The one and only `<provision-key>`
- `<production-verlink>`: Previously released `verlink`

For example:
```sh
pear provision pear://0.5.hchzzy.... pear://zjzce... pear://0.3.zjzce....```
Where `aaa123` is the stage key and `bbb456` the provision key. On every release the production verlink is `pear://0.0.<provision-key>`.

## Seed the new version

Now we need to seed the new version so peers can update their app. Seed the **provision link** — it is the one apps poll:

```sh
pear seed <provision-link>
```

Peers running the installed app will pick the new version up over the air (the app must advertise a higher version in `package.json`, which is why we bumped it).