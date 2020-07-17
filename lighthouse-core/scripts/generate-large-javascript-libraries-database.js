/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

/* eslint-disable no-console */

const fs = require('fs');
const exec = require('child_process').exec;

const database = {};

const librariesJSON = require('../audits/byte-efficiency/library-suggestions.json');
/** @type {string[]} */
const libraries = Object.keys(librariesJSON).map(key => librariesJSON[key]).flat();

/**
 * Returns a file path that the database should be saved to.
 * If an existing database exists, then save to a (probably) different path.
 * @return {string}
 */
function getFilePathToSaveTo() {
  const savePath = '../audits/byte-efficiency/large-javascript-libraries';
  if (fs.existsSync(savePath + '.json')) {
    return savePath + Math.floor(Math.random() * Math.floor(1000)) + '.json';
  } else {
    return savePath + '.json';
  }
}

/**
 * Returns true if the object represents valid BundlePhobia JSON.
 * The version string must not match this false-positive expression: '{number} packages'.
 * @param {any} library
 * @return {boolean}
 */
function validateLibraryObject(library) {
  return library.hasOwnProperty('name') &&
    library.hasOwnProperty('size') &&
    library.hasOwnProperty('gzip') &&
    library.hasOwnProperty('description') &&
    library.hasOwnProperty('repository') &&
    library.hasOwnProperty('version') &&
    !library.version.match(/^([0-9]+) packages$/);
}

/**
 * Save BundlePhobia stats for a given npm library to the database.
 * @param {string} library
 * @param {number} index
 */
async function collectLibraryStats(library, index) {
  return new Promise(resolve => {
    console.log(`◉ (${index}/${libraries.length}) ${library} `);

    exec(`bundle-phobia ${library} -j -r`, (error, stdout) => {
      if (error) console.log(`    ❌ Failed to run "bundle-phobia ${library}" | ${error}`);

      /** @type {Array<{name: string, version: string, gzip: number, description: string, repository: string}>} */
      const libraries = [];

      for (const libraryString of stdout.split('\n')) {
        try {
          if (libraryString.length > 0) {
            const library = JSON.parse(libraryString);
            if (validateLibraryObject(library)) libraries.push(library);
          }
        } catch (e) {
          console.log(`   ❌ Failed to parse JSON | ${library}`);
        }
      }

      libraries.forEach((library, index) => {
        database[library.name] = {
          ...database[library.name],
          [library.version]: {
            name: library.name,
            version: library.version,
            gzip: library.gzip,
            description: library.description,
            repository: library.repository,
          },
        };

        if (index === 0) {
          database[library.name]['latest'] = database[library.name][library.version];
        }

        console.log(`   ✔ ${library.version}` + (index === 0 ? ' (latest)' : ''));
      });

      resolve();
    });
  });
}

(async () => {
  const startTime = new Date();
  console.log(`Collecting ${libraries.length} libraries...`);

  for (let i = 0; i < libraries.length; i++) {
    await collectLibraryStats(libraries[i], i + 1);
  }

  const filePath = getFilePathToSaveTo();
  console.log(`◉ Saving database to ${filePath}...`);
  fs.writeFile(filePath, JSON.stringify(database, null, 2), (err) => {
    if (err) {
      console.log(`   ❌ Failed saving | ${err}`);
    } else {
      console.log(`   ✔ Done!`);
    }
  });

  const endTime = new Date();
  console.log(`Elapsed Time: ${(endTime - startTime) / 1000}`);
})();