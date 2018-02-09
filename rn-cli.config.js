/**
 *       Keep this file in the project root
 *
 * Overrides configuration for metro-bundler so that any
 * symlinked library (npm link) is automatically added
 * to project root (listened for changes). Also all the
 * dependencies and peerDependencies are provided through
 * `extraNodeModules` options (which is the main problem
 * with symlinked libraries in react-native).
 *
 * Make sure you install the library first using npm install
 * so that all the dependencies are available within the project
 * node_modules, after that use npm link to link the library.
 */
const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

// Using arguments check for development mode
function isDevMode() {
  const idx = process.argv.indexOf('--dev');
  if (idx === -1 || idx === process.argv.length - 1) {
    // Dev mode is true by default
    return true;
  }

  return process.argv[idx + 1].toLowerCase() !== 'false';
}

function getKeys(obj) {
  if (!obj) {
    return [];
  }
  return Object.keys(obj);
}

// Get all the libraries that have been sym-linked
function getLinkedLibraries() {
  return Object.keys(pkg.dependencies).reduce((res, lib) => {
    const p = path.resolve('node_modules', lib);
    if (fs.lstatSync(p).isSymbolicLink()) {
      res.libs[lib] = fs.realpathSync(p);

      // Make sure to remove the lib from dependents if already added
      const pos = res.dependents.indexOf(lib);
      if (pos >= -1) {
        res.dependents.splice(pos, 1);
      }

      // Search for all the dependencies/peer-dependencies within the library
      // and include them separately
      const dPkg = JSON.parse(fs.readFileSync(path.resolve(p, 'package.json')));
      const d = getKeys(dPkg.dependencies).concat(getKeys(dPkg.peerDependencies));
      res.dependents = d.reduce((uniques, n) => {
        // Don't include twice and don't inlucde the linked libraries as well
        if (uniques.indexOf(n) === -1 && !res.libs[n]) {
          uniques.push(n);
        }
        return uniques;
      }, res.dependents);
    }
    return res;
  }, {
    libs: {},
    dependents: [],
  });
}

// We do not want to link the libraries in production mode
// Always use the library through npm or git.
// If you have a library that's only kept locally, it's
// a good idea to use npm pack and keep the release inside
// the project for production mode and use that release file
// as dependency. You could always use npm link in development
// mode.
const DEV = isDevMode();

let config = {};

if (DEV) {
  const linked = getLinkedLibraries();

  const libraryRequiredModules = linked.dependents;
  const libRoots = Object.keys(linked.libs).map(k => linked.libs[k]);

  config = {
    extraNodeModules: libraryRequiredModules.reduce((res, lib) => ({
      ...res,
      [lib]: path.resolve(__dirname, 'node_modules', lib),
    }), {}),

    getProjectRoots() {
      return [
        path.resolve(__dirname),
        ...libRoots,
      ];
    },
  };
}

module.exports = config;