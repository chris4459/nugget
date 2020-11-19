/**
 * Utility functions related to dealing with lockfiles
 */

import * as lockfile from '@yarnpkg/lockfile';
import {find, forEach, isEmpty, isNull} from 'lodash';
import {Context} from 'probot';
import {default as rp} from 'request-promise-native';

const FILES_PER_PAGE = 50;
const MAX_NUM_PAGES = 60;

export enum LockfileStatus {
  Found,
  NotFound,
  TooManyFiles,
}

export interface ISerializedPackage {
  versions: string[];
}

export interface ILockfileData {
  status: LockfileStatus;
  data?: any;
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

export const getLockfileChange = async (context: Context): Promise<ILockfileData> => {
  let page = 1;

  const {issue_number: issueNumber, owner, repo} = context.issue();
  while (page <= MAX_NUM_PAGES) {
    const files = await context.octokit.pulls.listFiles({
      owner,
      page,
      per_page: FILES_PER_PAGE,
      pull_number: issueNumber,
      repo,
    });

    if (isEmpty(files.data)) {
      return {
        status: LockfileStatus.NotFound,
      };
    }

    const yarnLf = find(files.data, file => {
      return file.filename === 'yarn.lock';
    });

    if (yarnLf) {
      return {
        data: yarnLf,
        status: LockfileStatus.Found,
      }
    }

    page++;
  }

  /**
   *  NOTE:
   * Only includes max of 3000 files https://developer.github.com/v3/pulls/#list-pull-requests-files
   * Thus if page is at max, and still haven't found a yarn lockfile, may be because PR has too many files.
   */

  if (page > MAX_NUM_PAGES) {
    // return something
    return {
      status: LockfileStatus.TooManyFiles,
    };
  }

  return {
    status: LockfileStatus.NotFound,
  };
};

/**
 * Get a serialized lockfile from a given uri to a lock.file
 * @param uri
 */
export const getSerializedLockFile = async (uri: string) => {
  const parsedLockfile = lockfile.parse(await rp({json: true, uri}));
  return serializeLockfile(parsedLockfile.object);
};
