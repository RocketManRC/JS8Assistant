# Build system

Two packages have been installed to help with the build process; [modclean](https://github.com/ModClean/modclean) and [electron-builder](https://github.com/electron-userland/electron-builder). Modclean strips out superfluous files from the `node_modules` directory in order to shrink the final size of the release files, while electron-builder helps to create the release files for the various platforms.

There are MANY configuration options available for electron-builder (set in the `build` section of `package.json`). A good overview can be found [here](https://www.electron.build/configuration/configuration), along with specific info about [Windows](https://www.electron.build/configuration/win), [Mac](https://www.electron.build/configuration/mac), and [Linux](https://www.electron.build/configuration/linux) options. You will need to add some Mac options yourself (at least `"target"=["default"]`) in order to test, as building for Mac is only available _on_ Mac.

NPM scripts have been added to run these 2 tasks (use with `npm run trim_modules` and `npm run dist`), along with a further task (`postversion`) that will run both, after creating a new version.

It's a good idea to do `rm -rf node_modules/ && npm i` before you start, so you have a completely up to date `node_modules/` dir, just like a new user would see.

If you decide you want to commit the binaries to the repo (not sure if this is a good idea or not), the `postversion` script should be modified to be a `version` script instead:

```json
// Current script runs AFTER creating the version auto commit
// and does NOT include the binaries produced:
"postversion": "npm run trim_modules && npm run dist"
// To include the binaries in the repo, modify to be a version script instead,
// and add the resulting files to the index before the version auto commit:
"version": "npm run trim_modules && npm run dist && git add -A ."
```

## Windows installer formats

I tried both the default NSIS installer, and the MSI installer. The NSIS was much faster to both build and install, so I suggest sticking with that.

## Output files

The current settings produce 3 files for Windows:

-   `JS8Assistant <version>.exe` - This is a "portable" file, meaning it takes a few seconds longer to load, but is a single file, and needs no installation. Approx 52MB
-   `JS8Assistant Setup <version>.exe` - This is the NSIS installer, that most users would probably want. Allows choice of install dir, adds desktop icon, uninstaller, all that jazz. Approx 52MB
-   `JS8Assistant-<version>-win.zip` - No installer, just a compressed file with everything you need. Extract and run the `JS8Assistant.exe` file within. Approx 80MB

On my machine, the build process takes around 1m 05s and I guess Mac and Linux would each take a similar time.
