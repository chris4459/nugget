/**
 * Utility functions related to dealing with lockfiles
 */

import * as lockfile from '@yarnpkg/lockfile';
import {find, forEach, isEmpty, isNull} from 'lodash';
import {Context} from 'probot';
import {default as rp} from 'request-promise-native';

const FILES_PER_PAGE = 50;
const MAX_NUM_PAGES = 10;

export interface ISerializedPackage {
  versions: string[];
}

const getPackageName = (pkg: string): string => {
  const regex = /.*(?=@)/g;
  const pkgName = pkg.match(regex);
  if (isNull(pkgName)) {
    // If null for some reason, just return back the original pkg name
    return pkg;
  } else {
    return pkgName[0];
  }
};

const getPackageSemver = (pkg: string): string => {
  const regex = /([^@]+)$/g;
  const semver = pkg.match(regex);
  if (isNull(semver)) {
    // If null for some reason, just return back the original pkg name
    return pkg;
  } else {
    return semver[0];
  }
};

const serializeLockfile = (
  lf: Record<string, any>
): Map<string, ISerializedPackage> => {
  const map = new Map<string, ISerializedPackage>();

  forEach(lf, (data, key) => {
    const pkgName = getPackageName(key);
    const serializedData = map.get(pkgName) || {versions: []};

    if (serializedData.versions.indexOf(data.version) < 0) {
      serializedData.versions.push(data.version);
      map.set(pkgName, serializedData);
    }
  });

  // Return a sorted map
  return new Map(Array.from(map.entries()).sort());
};

export const getLockfileChange = async (context: Context) => {
  let page = 1;

  const {number: issueNumber, owner, repo} = context.issue();
  while (page <= MAX_NUM_PAGES) {
    const files = await context.github.pullRequests.listFiles({
      number: issueNumber,
      owner,
      page,
      per_page: FILES_PER_PAGE,
      repo,
    });

    if (isEmpty(files.data)) {
      return;
    }

    const yarnLf = find(files.data, file => {
      return file.filename === 'yarn.lock';
    });

    if (yarnLf) {
      return yarnLf;
    }

    page++;
  }

  return;
};

/**
 * Get a serialized lockfile from a given uri to a lock.file
 * @param uri
 */
export const getSerializedLockFile = async (uri: string) => {
  const parsedLockfile = lockfile.parse(await rp({json: true, uri}));
  return serializeLockfile(parsedLockfile.object);
};
